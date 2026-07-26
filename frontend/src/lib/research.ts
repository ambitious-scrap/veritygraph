import { getEnv } from './env';
import { anchorAuditQuotes, attachAuditAnchors } from './quoteAnchoring';
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
  AgentTraceStep,
  Claim,
  ResearchApiRequest,
  ResearchRun,
  ReverifyRequest,
  WorkflowMode,
} from './types';
import {
  analyzeSourceIndependence,
  calculateEvidenceMetrics,
  calculateOverallBuildResult,
  classifyClaimBuildStatus,
  EvidenceMetrics,
} from './verificationRules';
export const PIPELINE_VERSION = '2.0';
export const BUILD_RULES_VERSION = '1.0';
export const SOURCE_INDEPENDENCE_VERSION = '1.0';

export interface ResearchPipelineResult {
  run: ResearchRun;
  usedFallback: boolean;
}

function traceStep(
  id: string,
  role: AgentTraceStep['role'],
  label: string,
  status: AgentTraceStep['status'],
  durationMs: number,
  note: string,
  inputCount?: number,
  outputCount?: number
): AgentTraceStep {
  return {
    id,
    role,
    label,
    status,
    durationMs: Math.max(0, durationMs),
    ...(inputCount === undefined ? {} : { inputCount }),
    ...(outputCount === undefined ? {} : { outputCount }),
    note,
  };
}

function buildManifest(
  workflowMode: WorkflowMode,
  model: string,
  run: Pick<ResearchRun, 'claims' | 'providerMetadata'> & { metrics: EvidenceMetrics },
  trace: AgentTraceStep[]
) {
  const { retainedEvidenceCount, extractedSources, snippetFallbackSources } = run.metrics;
  return {
    manifestVersion: '1.0' as const,
    pipelineVersion: PIPELINE_VERSION,
    workflowMode,
    generatedAt: new Date().toISOString(),
    model,
    buildRulesVersion: BUILD_RULES_VERSION,
    sourceIndependenceVersion: SOURCE_INDEPENDENCE_VERSION,
    claimCount: run.claims.length,
    sourcesScanned: run.metrics.sourcesScanned,
    retainedEvidenceCount,
    focusedExtractCount: extractedSources,
    snippetFallbackCount: snippetFallbackSources,
    distinctDomains: run.metrics.distinctDomains,
    fallbackUsed: run.providerMetadata.fallbackUsed,
    stageDurationsMs: Object.fromEntries(trace.map((step) => [step.role, step.durationMs])),
    searchQueries: run.claims.map((claim) => ({
      claimId: claim.id,
      supportQuery: claim.searchQueries.support,
      challengeQuery: claim.searchQueries.challenge,
    })),
  };
}

function attachClaimBuildState(claim: Omit<Claim, 'sourceIndependence' | 'claimBuildStatus'>): Claim {
  const { evidenceWithGroups, sourceIndependence } = analyzeSourceIndependence(claim.evidence);
  return {
    ...claim,
    evidence: evidenceWithGroups,
    sourceIndependence,
    claimBuildStatus: classifyClaimBuildStatus(
      claim.verdict,
      claim.confidence,
      sourceIndependence.independentOrigins
    ),
  };
}


export async function runResearchPipeline(
  request: ResearchApiRequest
): Promise<ResearchPipelineResult> {
  const startedAt = Date.now();
  const env = getEnv();
  const workflowMode: WorkflowMode = request.mode === 'audit' ? 'audit' : 'research';
  const inputText = request.mode === 'audit' ? request.text : request.query;
  let usedFallback = false;

  const trace: AgentTraceStep[] = [];
  let initialSources: RawSource[] = [];
  const searchStartedAt = Date.now();
  if (workflowMode === 'research') {
    initialSources = await searchInitialSources(inputText, env.TAVILY_API_KEY);
    trace.push(traceStep('stage-1', 'researcher', 'Initial Tavily research search', 'completed', Date.now() - searchStartedAt, 'Initial research context retrieved.', 1, initialSources.length));
  } else {
    trace.push(traceStep('stage-1', 'researcher', 'Initial Tavily research search', 'skipped', 0, 'Audit mode uses the pasted answer as its source context.', 0, 0));
  }

  const extractionStartedAt = Date.now();
  const extraction = await extractClaimsWithGemini(
    inputText,
    initialSources,
    workflowMode,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY_SECONDARY,
    env.GEMINI_MODEL
  );
  usedFallback ||= extraction.usedFallback;
  const extractedClaims = extraction.data;
  trace.push(traceStep('stage-2', 'claim-decomposer', 'Gemini atomic claim extraction', extraction.usedFallback ? 'fallback' : 'completed', Date.now() - extractionStartedAt, workflowMode === 'audit' ? 'Claims were extracted from the pasted answer only.' : 'Claims were extracted from the query and initial sources.', 1, extractedClaims.length));
  const auditAnchors = workflowMode === 'audit'
    ? anchorAuditQuotes(
        inputText,
        extractedClaims.map((claim, index) => ({
          id: `claim-${index + 1}`,
          sourceQuote: claim.sourceQuote ?? '',
        }))
      )
    : {};
  const claimsWithAnchors = attachAuditAnchors(workflowMode, extractedClaims, auditAnchors);

  const evidenceSearchStartedAt = Date.now();
  const rawCandidatesPerClaim = await Promise.all(
    claimsWithAnchors.map((claim, index) => searchClaimEvidence(claim.supportQuery, claim.challengeQuery, env.TAVILY_API_KEY, index + 1))
  );
  trace.push(traceStep('stage-3', 'challenger', 'Support and challenge evidence retrieval', 'completed', Date.now() - evidenceSearchStartedAt, 'Support and challenge searches ran in parallel.', extractedClaims.length * 2, rawCandidatesPerClaim.reduce((count, candidates) => count + candidates.length, 0)));

  const focusedExtractionStartedAt = Date.now();
  const enrichedCandidatesPerClaim = await Promise.all(
    claimsWithAnchors.map((claim, index) => extractFocusedEvidence(claim.text, rawCandidatesPerClaim[index], env.TAVILY_API_KEY))
  );
  trace.push(traceStep('stage-4', 'source-reader', 'Tavily focused source extraction', 'completed', Date.now() - focusedExtractionStartedAt, 'Focused source passages were retained with snippet fallback where needed.', rawCandidatesPerClaim.reduce((count, candidates) => count + candidates.length, 0), enrichedCandidatesPerClaim.reduce((count, candidates) => count + candidates.length, 0)));

  const verificationStartedAt = Date.now();
  let verifierFallback = false;
  const verifiedClaims: Claim[] = [];
  for (let index = 0; index < claimsWithAnchors.length; index++) {
    const extractedClaim = claimsWithAnchors[index];
    const verification = await verifyClaimWithGemini(
      extractedClaim.text,
      index + 1,
      enrichedCandidatesPerClaim[index],
      env.GEMINI_API_KEY_PRIMARY,
      env.GEMINI_API_KEY_SECONDARY,
      env.GEMINI_MODEL,
      { support: extractedClaim.supportQuery, challenge: extractedClaim.challengeQuery }
    );
    usedFallback ||= verification.usedFallback;
    verifierFallback ||= verification.usedFallback;
    const claim = attachClaimBuildState(verification.claim);
    verifiedClaims.push(extractedClaim.auditAnchor ? { ...claim, sourceQuote: extractedClaim.sourceQuote, auditAnchor: extractedClaim.auditAnchor } : claim);
  }
  trace.push(traceStep('stage-5', 'verifier', 'Gemini evidence verification', verifierFallback ? 'fallback' : 'completed', Date.now() - verificationStartedAt, 'All extracted claims were verified against retained evidence.', enrichedCandidatesPerClaim.reduce((count, candidates) => count + candidates.length, 0), verifiedClaims.length));

  const buildResult = calculateOverallBuildResult(verifiedClaims);
  const metrics = calculateEvidenceMetrics(initialSources, enrichedCandidatesPerClaim, verifiedClaims, Date.now() - startedAt);

  const synthesisStartedAt = Date.now();
  const synthesis = await synthesizeReportWithGemini(
    inputText,
    verifiedClaims,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY_SECONDARY,
    env.GEMINI_MODEL
  );
  usedFallback ||= synthesis.usedFallback;
  trace.push(traceStep('stage-6', 'synthesizer', 'Final synthesis', synthesis.usedFallback ? 'fallback' : 'completed', Date.now() - synthesisStartedAt, 'Summary compiled from verified claim decisions only.', verifiedClaims.length, 1));

  const providerMetadata = { fallbackUsed: usedFallback };
  const finalMetrics = { ...metrics, durationMs: Date.now() - startedAt };
  const runBase = {
    id: `run-${Date.now()}`,
    query: inputText,
    summary: synthesis.data,
    claims: verifiedClaims,
    metrics: finalMetrics,
    mode: 'live' as const,
    workflowMode,
    buildResult,
    providerMetadata,
    agentTrace: trace,
    summaryMetadata: {
      generatedAt: new Date().toISOString(),
      stale: false,
      staleReason: null,
    },
    createdAt: new Date().toISOString(),
  };
  const manifest = buildManifest(workflowMode, env.GEMINI_MODEL, runBase, trace);
  const run: ResearchRun = { ...runBase, manifest };

  return { run, usedFallback };
}

export interface ReverificationResult {
  claim: Claim;
  trace: AgentTraceStep[];
  usedFallback: boolean;
  manifestPatch: {
    generatedAt: string;
    model: string;
    evidenceCount: number;
    focusedExtractCount: number;
    snippetFallbackCount: number;
  };
}

export async function reverifyClaim(request: ReverifyRequest): Promise<ReverificationResult> {
  const env = getEnv();
  const trace: AgentTraceStep[] = [];
  const searchStartedAt = Date.now();
  const candidates = await searchClaimEvidence(
    [request.supportQuery, request.nextBestQuery],
    request.challengeQuery,
    env.TAVILY_API_KEY,
    1
  );
  trace.push(traceStep('reverify-1', 'challenger', 'Focused support and challenge search', 'completed', Date.now() - searchStartedAt, 'Only the requested claim queries were searched.', 3, candidates.length));

  const extractStartedAt = Date.now();
  const focused = await extractFocusedEvidence(request.claimText, candidates, env.TAVILY_API_KEY);
  trace.push(traceStep('reverify-2', 'source-reader', 'Focused source extraction', 'completed', Date.now() - extractStartedAt, 'Focused passages were refreshed for the requested claim.', candidates.length, focused.length));

  const verifyStartedAt = Date.now();
  const verification = await verifyClaimWithGemini(
    request.claimText,
    1,
    focused,
    env.GEMINI_API_KEY_PRIMARY,
    env.GEMINI_API_KEY_SECONDARY,
    env.GEMINI_MODEL,
    { support: request.supportQuery, challenge: request.challengeQuery }
  );
  const claim = attachClaimBuildState({ ...verification.claim, id: request.claimId });
  trace.push(traceStep('reverify-3', 'verifier', 'Focused claim verification', verification.usedFallback ? 'fallback' : 'completed', Date.now() - verifyStartedAt, 'The selected claim was recalculated without synthesis.', focused.length, 1));

  return {
    claim,
    trace,
    usedFallback: verification.usedFallback,
    manifestPatch: {
      generatedAt: new Date().toISOString(),
      model: env.GEMINI_MODEL,
      evidenceCount: claim.evidence.length,
      focusedExtractCount: claim.evidence.filter((evidence) => evidence.evidenceBasis === 'focused-source-extract').length,
      snippetFallbackCount: claim.evidence.filter((evidence) => evidence.evidenceBasis === 'search-snippet').length,
    },
  };
}
