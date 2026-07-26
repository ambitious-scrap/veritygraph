import { getEnv } from './env';
import { searchInitialSources, searchClaimEvidence } from './tavily';
import {
  extractClaimsWithOpenRouter,
  verifyClaimWithOpenRouter,
  synthesizeReportWithOpenRouter,
} from './openrouter';
import { ResearchMetrics, ResearchRun } from './types';

export async function runResearchPipeline(query: string): Promise<ResearchRun> {
  const startTime = Date.now();
  const env = getEnv();

  // Stage 1: Initial Research
  const initialSources = await searchInitialSources(query, env.TAVILY_API_KEY);

  // Stage 2: Claim Extraction
  const extractedClaims = await extractClaimsWithOpenRouter(
    query,
    initialSources,
    env.OPENROUTER_API_KEY,
    env.LLM_MODEL
  );

  // Stage 3: Evidence Search (Parallel for each claim)
  const evidencePromises = extractedClaims.map((claim, idx) =>
    searchClaimEvidence(
      claim.supportQuery,
      claim.challengeQuery,
      env.TAVILY_API_KEY,
      idx + 1
    )
  );

  const candidateEvidencePerClaim = await Promise.all(evidencePromises);

  // Stage 4: Claim Verification (Parallel for each claim)
  const verificationPromises = extractedClaims.map((claim, idx) =>
    verifyClaimWithOpenRouter(
      claim.text,
      idx + 1,
      candidateEvidencePerClaim[idx],
      env.OPENROUTER_API_KEY,
      env.LLM_MODEL
    )
  );

  const verifiedClaims = await Promise.all(verificationPromises);

  // Stage 5: Synthesis
  const summary = await synthesizeReportWithOpenRouter(
    query,
    verifiedClaims,
    env.OPENROUTER_API_KEY,
    env.LLM_MODEL
  );

  const durationMs = Date.now() - startTime;

  // Calculate deterministic metrics
  const allSourcesMap = new Map<string, string>(); // url -> domain
  for (const s of initialSources) {
    allSourcesMap.set(s.url, s.domain);
  }
  for (const claimEvList of candidateEvidencePerClaim) {
    for (const ev of claimEvList) {
      allSourcesMap.set(ev.url, ev.domain);
    }
  }

  const sourcesScanned = allSourcesMap.size;
  const distinctDomains = new Set(allSourcesMap.values()).size;

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
    distinctDomains,
    supportedClaims,
    challengedClaims,
    insufficientClaims,
  };

  return {
    id: `run-${Date.now()}`,
    query,
    summary,
    claims: verifiedClaims,
    metrics,
    createdAt: new Date().toISOString(),
  };
}
