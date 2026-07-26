import { getEnv } from './env';
import {
  searchInitialSources,
  searchClaimEvidence,
  extractFocusedEvidence,
  RawSource,
} from './tavily';
import {
  extractClaimsWithGemini,
  verifyClaimWithGemini,
  synthesizeReportWithGemini,
} from './gemini';
import {
  BuildResult,
  Claim,
  ClaimVerdict,
  Evidence,
  EvidenceBasis,
  ResearchApiRequest,
  ResearchMetrics,
  ResearchRun,
  SourceIndependence,
  VerificationBuildStatus,
  WorkflowMode,
} from './types';

export interface ResearchPipelineResult {
  run: ResearchRun;
  usedFallback: boolean;
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'in',
  'of',
  'to',
  'with',
  'on',
  'at',
  'for',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'from',
  'as',
  'it',
  'that',
  'this',
  'these',
  'those',
  'study',
  'report',
  'review',
  'journal',
  'article',
]);

function tokenizeTitle(title: string): Set<string> {
  const normalized = title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized
    .split(' ')
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

interface OriginGroup {
  id: string;
  domain: string;
  tokens: Set<string>;
  members: Evidence[];
}

/**
 * Deterministic source-independence heuristic algorithm
 */
function analyzeSourceIndependence(evidenceList: Evidence[]): {
  evidenceWithGroups: Evidence[];
  sourceIndependence: SourceIndependence;
} {
  const groups: OriginGroup[] = [];
  const GROUP_NAMES = [
    'Group A',
    'Group B',
    'Group C',
    'Group D',
    'Group E',
    'Group F',
    'Group G',
  ];

  const updatedEvidence: Evidence[] = [];

  for (const ev of evidenceList) {
    const evTokens = tokenizeTitle(ev.title);
    let matchedGroup: OriginGroup | null = null;

    for (const g of groups) {
      const sim = jaccardSimilarity(evTokens, g.tokens);
      // Rule 4: Group two sources when title-token Jaccard similarity is >= 0.72
      if (sim >= 0.72) {
        matchedGroup = g;
        break;
      }
      // Rule 5: Sources from same canonical domain belong to same origin group unless title similarity is < 0.20
      if (ev.domain === g.domain && sim >= 0.20) {
        matchedGroup = g;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.members.push(ev);
      for (const t of evTokens) matchedGroup.tokens.add(t);
      updatedEvidence.push({ ...ev, originGroupId: matchedGroup.id });
    } else {
      const newGroupId = GROUP_NAMES[groups.length] || `Group ${groups.length + 1}`;
      const newGroup: OriginGroup = {
        id: newGroupId,
        domain: ev.domain,
        tokens: evTokens,
        members: [ev],
      };
      groups.push(newGroup);
      updatedEvidence.push({ ...ev, originGroupId: newGroupId });
    }
  }

  const sourceCount = evidenceList.length;
  const independentOrigins = groups.length;
  const duplicateGroups = groups.filter((g) => g.members.length > 1).length;

  return {
    evidenceWithGroups: updatedEvidence,
    sourceIndependence: {
      sourceCount,
      independentOrigins,
      duplicateGroups,
    },
  };
}

/**
 * Claim Build Status Classification (PASS / WARNING / FAIL)
 */
function classifyClaimBuildStatus(
  verdict: ClaimVerdict,
  confidence: number,
  independentOrigins: number
): VerificationBuildStatus {
  // FAIL:
  // - Verdict is contradicted
  // - Or verdict is insufficient with confidence <= 0.30
  if (verdict === 'contradicted' || (verdict === 'insufficient' && confidence <= 0.30)) {
    return 'fail';
  }

  // PASS:
  // - Verdict is supported
  // - AND confidence is at least 0.70 (>= 0.70)
  // - AND at least two independent origins exist (>= 2)
  if (verdict === 'supported' && confidence >= 0.70 && independentOrigins >= 2) {
    return 'pass';
  }

  // WARNING:
  // - Verdict is partial
  // - Verdict is insufficient above 0.30 (> 0.30)
  // - Verdict is supported but has fewer than two independent origins (< 2)
  // - Verdict is supported with confidence below 0.70 (< 0.70)
  return 'warning';
}

/**
 * Overall Build Result Calculation
 */
function calculateOverallBuildResult(claims: Claim[]): BuildResult {
  let passedClaims = 0;
  let warningClaims = 0;
  let failedClaims = 0;

  for (const claim of claims) {
    if (claim.claimBuildStatus === 'pass') passedClaims++;
    else if (claim.claimBuildStatus === 'warning') warningClaims++;
    else if (claim.claimBuildStatus === 'fail') failedClaims++;
  }

  if (failedClaims > 0) {
    return {
      status: 'fail',
      headline: 'Verification build failed',
      explanation:
        'One or more extracted claims failed verification or were directly contradicted by evidence.',
      passedClaims,
      warningClaims,
      failedClaims,
    };
  }

  if (warningClaims > 0) {
    return {
      status: 'warning',
      headline: 'Verification build passed with warnings',
      explanation:
        'All claims avoided direct failure, but some claims lack strong independent evidence or rely on partial support.',
      passedClaims,
      warningClaims,
      failedClaims,
    };
  }

  return {
    status: 'pass',
    headline: 'Verification build passed',
    explanation:
      'Every extracted claim earned strong, independent supporting evidence across multiple origins.',
    passedClaims,
    warningClaims,
    failedClaims,
  };
}

export async function runResearchPipeline(
  request: ResearchApiRequest
): Promise<ResearchPipelineResult> {
  const startTime = Date.now();
  const env = getEnv();

  let usedFallback = false;

  const workflowMode: WorkflowMode = request.mode === 'audit' ? 'audit' : 'research';
  const inputQueryOrText =
    workflowMode === 'audit'
      ? request.text || request.query || ''
      : request.query || request.text || '';

  // Stage 1: Initial Research (Skipped in Audit Mode)
  let initialSources: RawSource[] = [];
  if (workflowMode === 'research') {
    initialSources = await searchInitialSources(inputQueryOrText, env.TAVILY_API_KEY);
  }

  // Stage 2: Claim Extraction
  const extractionResult = await extractClaimsWithGemini(
    inputQueryOrText,
    initialSources,
    workflowMode,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY_SECONDARY,
    env.GEMINI_MODEL
  );
  if (extractionResult.usedFallback) usedFallback = true;
  const extractedClaims = extractionResult.data;

  // Stage 3: Evidence Search (Parallel for each claim)
  const candidateEvidencePromises = extractedClaims.map((claim, idx) =>
    searchClaimEvidence(
      claim.supportQuery,
      claim.challengeQuery,
      env.TAVILY_API_KEY,
      idx + 1
    )
  );
  const rawCandidatesPerClaim = await Promise.all(candidateEvidencePromises);

  // Stage 4: Focused Evidence Extraction (Parallel for each claim via Tavily Extract)
  const extractionPromises = extractedClaims.map((claim, idx) =>
    extractFocusedEvidence(claim.text, rawCandidatesPerClaim[idx], env.TAVILY_API_KEY)
  );
  const enrichedCandidatesPerClaim = await Promise.all(extractionPromises);

  // Stage 5: Claim Verification (Sequential per claim to avoid rate limit bursts)
  const baseClaims: Array<Omit<Claim, 'sourceIndependence' | 'claimBuildStatus'>> = [];

  for (let idx = 0; idx < extractedClaims.length; idx++) {
    const claim = extractedClaims[idx];
    const result = await verifyClaimWithGemini(
      claim.text,
      idx + 1,
      enrichedCandidatesPerClaim[idx],
      env.GEMINI_API_KEY_PRIMARY,
      env.GEMINI_API_KEY_SECONDARY,
      env.GEMINI_MODEL
    );
    if (result.usedFallback) usedFallback = true;
    baseClaims.push(result.claim);
  }

  // Analyze Source Independence & Classify Build Status for each claim
  const verifiedClaims: Claim[] = baseClaims.map((baseClaim) => {
    const { evidenceWithGroups, sourceIndependence } = analyzeSourceIndependence(
      baseClaim.evidence
    );
    const claimBuildStatus = classifyClaimBuildStatus(
      baseClaim.verdict,
      baseClaim.confidence,
      sourceIndependence.independentOrigins
    );

    return {
      ...baseClaim,
      evidence: evidenceWithGroups,
      sourceIndependence,
      claimBuildStatus,
    };
  });

  // Stage 6: Synthesis & Overall Build Result
  const synthesisResult = await synthesizeReportWithGemini(
    inputQueryOrText,
    baseClaims,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY_SECONDARY,
    env.GEMINI_MODEL
  );
  if (synthesisResult.usedFallback) usedFallback = true;
  const summary = synthesisResult.data;

  const buildResult = calculateOverallBuildResult(verifiedClaims);

  const durationMs = Date.now() - startTime;

  // Calculate metrics
  const allSourcesMap = new Map<string, string>();
  for (const s of initialSources) {
    allSourcesMap.set(s.url, s.domain);
  }
  for (const claimEvList of enrichedCandidatesPerClaim) {
    for (const ev of claimEvList) {
      allSourcesMap.set(ev.url, ev.domain);
    }
  }

  const sourcesScanned = allSourcesMap.size;
  const distinctDomains = new Set(allSourcesMap.values()).size;

  const retainedUrlBasisMap = new Map<string, EvidenceBasis>();
  for (const claim of verifiedClaims) {
    for (const ev of claim.evidence) {
      const canonical = ev.url.toLowerCase().replace(/\/$/, '');
      if (!retainedUrlBasisMap.has(canonical)) {
        retainedUrlBasisMap.set(canonical, ev.evidenceBasis);
      }
    }
  }

  let extractedSources = 0;
  let snippetFallbackSources = 0;
  for (const basis of retainedUrlBasisMap.values()) {
    if (basis === 'focused-source-extract') {
      extractedSources++;
    } else {
      snippetFallbackSources++;
    }
  }

  const supportedClaims = verifiedClaims.filter((c) => c.verdict === 'supported').length;
  const challengedClaims = verifiedClaims.filter(
    (c) => c.verdict === 'contradicted' || c.verdict === 'partial'
  ).length;
  const insufficientClaims = verifiedClaims.filter(
    (c) => c.verdict === 'insufficient'
  ).length;

  const metrics: ResearchMetrics = {
    durationMs,
    sourcesScanned,
    extractedSources,
    snippetFallbackSources,
    distinctDomains,
    supportedClaims,
    challengedClaims,
    insufficientClaims,
  };

  const run: ResearchRun = {
    id: `run-${Date.now()}`,
    query: inputQueryOrText,
    summary,
    claims: verifiedClaims,
    metrics,
    mode: 'live',
    workflowMode,
    buildResult,
    providerMetadata: {
      fallbackUsed: usedFallback,
    },
    createdAt: new Date().toISOString(),
  };

  return {
    run,
    usedFallback,
  };
}
