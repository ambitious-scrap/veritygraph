import { getEnv } from './env';
import { searchInitialSources, searchClaimEvidence } from './tavily';
import {
  extractClaimsWithGemini,
  verifyClaimWithGemini,
  synthesizeReportWithGemini,
} from './gemini';
import { ResearchRun } from './types';

export async function runResearchPipeline(query: string): Promise<ResearchRun> {
  const env = getEnv();

  // Stage 1: Initial Research
  const initialSources = await searchInitialSources(query, env.TAVILY_API_KEY);

  // Stage 2: Claim Extraction
  const extractedClaims = await extractClaimsWithGemini(
    query,
    initialSources,
    env.GEMINI_API_KEY,
    env.GEMINI_MODEL
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
    verifyClaimWithGemini(
      claim.text,
      idx + 1,
      candidateEvidencePerClaim[idx],
      env.GEMINI_API_KEY,
      env.GEMINI_MODEL
    )
  );

  const verifiedClaims = await Promise.all(verificationPromises);

  // Stage 5: Synthesis
  const summary = await synthesizeReportWithGemini(
    query,
    verifiedClaims,
    env.GEMINI_API_KEY,
    env.GEMINI_MODEL
  );

  return {
    id: `run-${Date.now()}`,
    query,
    summary,
    claims: verifiedClaims,
    createdAt: new Date().toISOString(),
  };
}
