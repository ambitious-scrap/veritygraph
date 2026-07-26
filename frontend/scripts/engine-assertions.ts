import assert from 'node:assert/strict';
import {
  anchorAuditQuotes,
} from '../src/lib/quoteAnchoring.ts';
import {
  analyzeSourceIndependence,
  calculateEvidenceMetrics,
  calculateOverallBuildResult,
  canonicalizeUrl,
  classifyClaimBuildStatus,
  jaccardSimilarity,
  normalizeDomain,
  normalizeTitle,
  tokenizeTitle,
} from '../src/lib/verificationRules.ts';
import { runGeminiWithFallback } from '../src/lib/gemini.ts';
import type { Claim, Evidence } from '../src/lib/types.ts';

const baseEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  id: 'ev-1',
  title: 'Independent report on coffee and mortality outcomes',
  url: 'https://example.org/reports/coffee',
  domain: 'example.org',
  excerpt: 'A source passage.',
  stance: 'support',
  relevanceScore: 0.9,
  evidenceBasis: 'focused-source-extract',
  originGroupId: 'origin-1',
  ...overrides,
});

const baseClaim = (status: Claim['claimBuildStatus']): Claim => ({
  id: `claim-${status}`,
  text: 'A sufficiently specific factual claim for testing.',
  verdict: status === 'fail' ? 'contradicted' : status === 'warning' ? 'partial' : 'supported',
  confidence: status === 'pass' ? 0.9 : 0.5,
  explanation: 'A deterministic explanation for this assertion.',
  evidence: [baseEvidence()],
  confidenceFactors: {
    evidenceCount: 1,
    distinctDomains: 1,
    hasContradiction: status === 'fail',
    appliedCap: null,
  },
  sourceIndependence: {
    sourceCount: 1,
    independentOrigins: status === 'pass' ? 2 : 1,
    duplicateGroups: 0,
    syndicatedSourceCount: 0,
  },
  missingEvidence: 'A stronger independent source.',
  nextBestQuery: 'find a stronger independent source',
  searchQueries: {
    support: 'support query',
    challenge: 'challenge query',
  },
  claimBuildStatus: status,
});

function testQuoteAnchoring() {
  const original = 'Alpha claim is factual. Beta claim is factual.  Gamma\nclaim is factual.';
  const anchors = anchorAuditQuotes(original, [
    { id: 'exact', sourceQuote: 'Alpha claim is factual.' },
    { id: 'case', sourceQuote: 'BETA CLAIM IS FACTUAL.' },
    { id: 'normalized', sourceQuote: 'Gamma claim is factual.' },
    { id: 'missing', sourceQuote: 'No such claim exists.' },
  ]);
  const overlaps = anchorAuditQuotes(original, [
    { id: 'long', sourceQuote: 'Alpha claim is factual. Beta claim is factual.' },
    { id: 'short', sourceQuote: 'Alpha claim is factual.' },
  ]);
  assert.equal(anchors.exact.matchStatus, 'exact');
  assert.equal(anchors.exact.startIndex, 0);
  assert.equal(anchors.case.matchStatus, 'case-insensitive');
  assert.equal(anchors.normalized.matchStatus, 'normalized');
  assert.equal(anchors.missing.matchStatus, 'unmatched');
  assert.equal(overlaps.long.startIndex, 0);
  assert.equal(overlaps.short.matchStatus, 'unmatched');

  const repeated = anchorAuditQuotes('Repeat here. Repeat here.', [
    { id: 'first', sourceQuote: 'Repeat here.' },
    { id: 'second', sourceQuote: 'Repeat here.' },
  ]);
  assert.equal(repeated.first.startIndex, 0);
  assert.equal(repeated.second.startIndex, 13);
}

function testSourceIndependence() {
  assert.equal(canonicalizeUrl('https://WWW.Example.org/a/#fragment'), 'https://example.org/a');
  assert.equal(normalizeDomain('https://www.Example.org/a'), 'example.org');
  assert.equal(normalizeTitle('  A Report: On Coffee! '), 'a report on coffee');
  assert.equal(jaccardSimilarity(tokenizeTitle('Coffee mortality report'), tokenizeTitle('Coffee mortality report results')), 2 / 3);

  const result = analyzeSourceIndependence([
    baseEvidence({ id: 'same-url', url: 'https://example.org/report', title: 'First report' }),
    baseEvidence({ id: 'same-domain-related', url: 'https://example.org/report-2', title: 'First report results' }),
    baseEvidence({ id: 'same-domain-unrelated', url: 'https://example.org/other', title: 'Quantum computing hardware benchmark' }),
    baseEvidence({ id: 'syndicated', url: 'https://other.org/coverage', domain: 'other.org', title: 'First report results' }),
    baseEvidence({ id: 'independent', url: 'https://third.org/study', title: 'Longitudinal sleep intervention trial' }),
  ]);
  assert.equal(result.sourceIndependence.sourceCount, 5);
  assert.ok(result.sourceIndependence.independentOrigins >= 3);
  assert.equal(result.evidenceWithGroups[0].originGroupId, result.evidenceWithGroups[1].originGroupId);
  assert.notEqual(result.evidenceWithGroups[1].originGroupId, result.evidenceWithGroups[2].originGroupId);
  assert.equal(result.sourceIndependence.syndicatedSourceCount, 1);
}

function testBuildRules() {
  assert.equal(classifyClaimBuildStatus('supported', 0.9, 2), 'pass');
  assert.equal(classifyClaimBuildStatus('supported', 0.69, 2), 'warning');
  assert.equal(classifyClaimBuildStatus('supported', 0.9, 1), 'warning');
  assert.equal(classifyClaimBuildStatus('partial', 0.9, 2), 'warning');
  assert.equal(classifyClaimBuildStatus('contradicted', 0.9, 2), 'fail');
  assert.equal(classifyClaimBuildStatus('insufficient', 0.3, 2), 'fail');
  assert.equal(classifyClaimBuildStatus('insufficient', 0.31, 2), 'warning');
  assert.equal(calculateOverallBuildResult([baseClaim('pass'), baseClaim('warning')]).status, 'warning');
  assert.equal(calculateOverallBuildResult([baseClaim('pass'), baseClaim('fail')]).status, 'fail');
  assert.equal(calculateOverallBuildResult([baseClaim('pass')]).status, 'pass');
}

function testMetricsAndManifestInvariants() {
  const metrics = calculateEvidenceMetrics(
    [{ url: 'https://example.org/raw', domain: 'example.org' }],
    [[baseEvidence({ id: 'retained', url: 'https://example.org/retained' })]],
    [baseClaim('pass')],
    42
  );
  assert.equal(metrics.durationMs, 42);
  assert.equal(metrics.searchQueryCount, 1);
  assert.ok(metrics.sourcesScanned >= metrics.retainedEvidenceCount);
  assert.ok(Object.values(metrics).every((value) => typeof value === 'number' && value >= 0));
}
async function testGeminiFallbackBounds() {
  let primaryCalls = 0;
  let secondaryCalls = 0;
  const fallbackResult = await runGeminiWithFallback(
    async () => {
      primaryCalls++;
      throw Object.assign(new Error('temporary failure'), { status: 503 });
    },
    async () => {
      secondaryCalls++;
      return 'secondary-result';
    },
    'verification',
    0
  );
  assert.equal(fallbackResult.data, 'secondary-result');
  assert.equal(fallbackResult.usedFallback, true);
  assert.equal(primaryCalls, 1);
  assert.equal(secondaryCalls, 1);

  let secondarySkipped = 0;
  await assert.rejects(
    () =>
      runGeminiWithFallback(
        async () => {
          throw Object.assign(new Error('invalid request'), { status: 400 });
        },
        async () => {
          secondarySkipped++;
          return 'unexpected';
        },
        'verification',
        0
      ),
    /Gemini service execution failed/
  );
  assert.equal(secondarySkipped, 0);

  let boundedPrimary = 0;
  let boundedSecondary = 0;
  await assert.rejects(
    () =>
      runGeminiWithFallback(
        async () => {
          boundedPrimary++;
          throw Object.assign(new Error('temporary failure'), { status: 503 });
        },
        async () => {
          boundedSecondary++;
          throw Object.assign(new Error('temporary failure'), { status: 503 });
        },
        'verification',
        0
      ),
    /across both configured keys/
  );
  assert.equal(boundedPrimary, 1);
  assert.equal(boundedSecondary, 1);
}


async function main() {
  testQuoteAnchoring();
  testSourceIndependence();
  testBuildRules();
  testMetricsAndManifestInvariants();
  await testGeminiFallbackBounds();
  console.log('engine assertions: PASS');
}

void main();
