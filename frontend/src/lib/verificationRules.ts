import type {
  BuildResult,
  Claim,
  Evidence,
  ResearchMetrics,
  SourceIndependence,
  VerificationBuildStatus,
  ClaimVerdict,
} from './types';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'of', 'to', 'with', 'on', 'at', 'for', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'from', 'as', 'it', 'that', 'this',
  'these', 'those', 'study', 'report', 'review', 'journal', 'article',
]);

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
]);

export function canonicalizeUrl(value: string): string {
  const input = value.trim();
  try {
    const url = new URL(input);
    url.hash = '';
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol === 'https:' && url.port === '443') url.port = '';
    if (url.protocol === 'http:' && url.port === '80') url.port = '';

    const query = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
      );
    const search = new URLSearchParams(query).toString();
    const pathname = url.pathname === '/' ? '' : url.pathname;
    return `${url.protocol}//${url.host}${pathname}${search ? `?${search}` : ''}`;
  } catch {
    return input;
  }
}

export function normalizeDomain(value: string): string {
  try {
    const hostname = value.includes('://') ? new URL(value).hostname : value.split('/')[0];
    return hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return value.trim().toLowerCase().replace(/^www\./, '');
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeTitle(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(' ')
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

interface OriginGroup {
  id: string;
  canonicalUrls: Set<string>;
  domains: Set<string>;
  tokens: Set<string>;
  members: Evidence[];
}

export function analyzeSourceIndependence(evidenceList: Evidence[]): {
  evidenceWithGroups: Evidence[];
  sourceIndependence: SourceIndependence;
} {
  const groups: OriginGroup[] = [];
  const updatedEvidence: Evidence[] = [];

  for (const evidence of evidenceList) {
    const canonicalUrl = canonicalizeUrl(evidence.url);
    const domain = normalizeDomain(evidence.domain || evidence.url);
    const tokens = tokenizeTitle(evidence.title);
    const matchedGroup = groups.find((group) => {
      if (group.canonicalUrls.has(canonicalUrl)) return true;
      const titleSimilarity = jaccardSimilarity(tokens, group.tokens);
      if (titleSimilarity >= 0.72) return true;
      return group.domains.has(domain) && titleSimilarity >= 0.20;
    });

    if (matchedGroup) {
      matchedGroup.canonicalUrls.add(canonicalUrl);
      matchedGroup.domains.add(domain);
      for (const token of tokens) matchedGroup.tokens.add(token);
      matchedGroup.members.push(evidence);
      updatedEvidence.push({ ...evidence, originGroupId: matchedGroup.id });
    } else {
      const group: OriginGroup = {
        id: `origin-${groups.length + 1}`,
        canonicalUrls: new Set([canonicalUrl]),
        domains: new Set([domain]),
        tokens,
        members: [evidence],
      };
      groups.push(group);
      updatedEvidence.push({ ...evidence, originGroupId: group.id });
    }
  }

  const syndicatedSourceCount = groups.reduce((count, group) => {
    if (group.domains.size < 2) return count;
    const primaryDomain = normalizeDomain(group.members[0].domain || group.members[0].url);
    return count + group.members.filter(
      (member) => normalizeDomain(member.domain || member.url) !== primaryDomain
    ).length;
  }, 0);

  return {
    evidenceWithGroups: updatedEvidence,
    sourceIndependence: {
      sourceCount: evidenceList.length,
      independentOrigins: groups.length,
      duplicateGroups: groups.filter((group) => group.members.length > 1).length,
      syndicatedSourceCount,
    },
  };
}

export function classifyClaimBuildStatus(
  verdict: ClaimVerdict,
  confidence: number,
  independentOrigins: number
): VerificationBuildStatus {
  if (verdict === 'contradicted' || (verdict === 'insufficient' && confidence <= 0.30)) {
    return 'fail';
  }
  if (verdict === 'supported' && confidence >= 0.70 && independentOrigins >= 2) {
    return 'pass';
  }
  return 'warning';
}

export function calculateOverallBuildResult(claims: Pick<Claim, 'claimBuildStatus'>[]): BuildResult {
  const passedClaims = claims.filter((claim) => claim.claimBuildStatus === 'pass').length;
  const warningClaims = claims.filter((claim) => claim.claimBuildStatus === 'warning').length;
  const failedClaims = claims.filter((claim) => claim.claimBuildStatus === 'fail').length;

  if (failedClaims > 0) {
    return {
      status: 'fail',
      headline: 'Verification build failed',
      explanation: 'One or more extracted claims failed verification or were directly contradicted by evidence.',
      passedClaims,
      warningClaims,
      failedClaims,
    };
  }
  if (warningClaims > 0) {
    return {
      status: 'warning',
      headline: 'Verification build passed with warnings',
      explanation: 'All claims avoided direct failure, but some claims lack strong independent evidence or rely on partial support.',
      passedClaims,
      warningClaims,
      failedClaims,
    };
  }
  return {
    status: 'pass',
    headline: 'Verification build passed',
    explanation: 'Every extracted claim earned strong, independent supporting evidence across multiple origins.',
    passedClaims,
    warningClaims,
    failedClaims,
  };
}

export interface MetricSource {
  url: string;
  domain: string;
}

export interface EvidenceMetricInput extends MetricSource {
  evidenceBasis: Evidence['evidenceBasis'];
}

export interface EvidenceMetrics extends ResearchMetrics {
  retainedEvidenceCount: number;
  focusedExtractCount: number;
  searchQueryCount: number;
}

export function calculateEvidenceMetrics(
  initialSources: MetricSource[],
  candidateEvidence: EvidenceMetricInput[][],
  claims: Pick<Claim, 'evidence' | 'verdict' | 'searchQueries'>[],
  durationMs: number
): EvidenceMetrics {
  const scanned = new Map<string, string>();
  for (const source of initialSources) scanned.set(canonicalizeUrl(source.url), normalizeDomain(source.domain || source.url));
  for (const candidates of candidateEvidence) {
    for (const source of candidates) scanned.set(canonicalizeUrl(source.url), normalizeDomain(source.domain || source.url));
  }

  const retained = new Map<string, Evidence['evidenceBasis']>();
  for (const claim of claims) {
    for (const evidence of claim.evidence) {
      const url = canonicalizeUrl(evidence.url);
      const currentBasis = retained.get(url);
      if (!currentBasis || (currentBasis === 'search-snippet' && evidence.evidenceBasis === 'focused-source-extract')) {
        retained.set(url, evidence.evidenceBasis);
      }
    }
  }

  const focusedExtractCount = [...retained.values()].filter((basis) => basis === 'focused-source-extract').length;
  const snippetFallbackCount = retained.size - focusedExtractCount;
  return {
    durationMs: Math.max(0, durationMs),
    sourcesScanned: scanned.size,
    extractedSources: focusedExtractCount,
    snippetFallbackSources: snippetFallbackCount,
    distinctDomains: new Set(scanned.values()).size,
    supportedClaims: claims.filter((claim) => claim.verdict === 'supported').length,
    challengedClaims: claims.filter((claim) => claim.verdict === 'contradicted' || claim.verdict === 'partial').length,
    insufficientClaims: claims.filter((claim) => claim.verdict === 'insufficient').length,
    retainedEvidenceCount: retained.size,
    focusedExtractCount,
    searchQueryCount: claims.length,
  };
}
