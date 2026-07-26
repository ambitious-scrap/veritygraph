import { getEnv } from './env';
import {
  searchInitialSources,
  searchClaimEvidence,
  extractFocusedEvidence,
} from './tavily';
import {
  extractClaimsWithGemini,
  verifyClaimWithGemini,
  synthesizeReportWithGemini,
} from './gemini';
import { EvidenceBasis, ResearchMetrics, ResearchRun } from './types';

export interface ResearchPipelineResult {
  run: ResearchRun;
  usedFallback: boolean;
}

export async function runResearchPipeline(query: string): Promise<ResearchPipelineResult> {
  const startTime = Date.now();
  const env = getEnv();

  let usedFallback = false;

  // Stage 1: Initial Research
  const initialSources = await searchInitialSources(query, env.TAVILY_API_KEY);

  // Stage 2: Claim Extraction
  const extractionResult = await extractClaimsWithGemini(
    query,
    initialSources,
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

  // Stage 5: Claim Verification (Parallel for each claim)
  const verificationPromises = extractedClaims.map((claim, idx) =>
    verifyClaimWithGemini(
      claim.text,
      idx + 1,
      enrichedCandidatesPerClaim[idx],
      env.GEMINI_API_KEY_PRIMARY,
      env.GEMINI_API_KEY_SECONDARY,
      env.GEMINI_MODEL
    )
  );

  const verificationResults = await Promise.all(verificationPromises);
  const verifiedClaims = verificationResults.map((r) => {
    if (r.usedFallback) usedFallback = true;
    return r.claim;
  });

  // Stage 6: Synthesis
  const synthesisResult = await synthesizeReportWithGemini(
    query,
    verifiedClaims,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY_SECONDARY,
    env.GEMINI_MODEL
  );
  if (synthesisResult.usedFallback) usedFallback = true;
  const summary = synthesisResult.data;

  const durationMs = Date.now() - startTime;

  // Calculate metrics
  const allSourcesMap = new Map<string, string>(); // url -> domain
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

  // Calculate extractedSources vs snippetFallbackSources across unique retained evidence URLs
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
    if (basis === 'full-source-extract') {
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
    query,
    summary,
    claims: verifiedClaims,
    metrics,
    mode: 'live',
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
