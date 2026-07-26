export type ClaimVerdict = 'supported' | 'contradicted' | 'partial' | 'insufficient';

export type EvidenceStance = 'support' | 'contradict' | 'neutral';

export type EvidenceBasis = 'focused-source-extract' | 'search-snippet';

export type VerificationBuildStatus = 'pass' | 'warning' | 'fail';

export type WorkflowMode = 'research' | 'audit';

export interface Evidence {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  stance: EvidenceStance;
  relevanceScore: number;
  evidenceBasis: EvidenceBasis;
  originGroupId: string;
}

export interface ConfidenceFactors {
  evidenceCount: number;
  distinctDomains: number;
  hasContradiction: boolean;
  appliedCap: string | null;
}

export interface SourceIndependence {
  sourceCount: number;
  independentOrigins: number;
  duplicateGroups: number;
  syndicatedSourceCount: number;
}

export interface AuditAnchor {
  quote: string;
  startIndex: number | null;
  endIndex: number | null;
  matchStatus: 'exact' | 'case-insensitive' | 'normalized' | 'unmatched';
}

export interface Claim {
  id: string;
  text: string;
  verdict: ClaimVerdict;
  sourceQuote?: string;
  confidence: number;
  explanation: string;
  evidence: Evidence[];
  confidenceFactors: ConfidenceFactors;
  sourceIndependence: SourceIndependence;
  missingEvidence: string;
  nextBestQuery: string;
  searchQueries: {
    support: string;
    challenge: string;
  };
  claimBuildStatus: VerificationBuildStatus;
  auditAnchor?: AuditAnchor;
}

export interface ResearchMetrics {
  durationMs: number;
  sourcesScanned: number;
  extractedSources: number;
  snippetFallbackSources: number;
  distinctDomains: number;
  supportedClaims: number;
  challengedClaims: number;
  insufficientClaims: number;
}

export interface ProviderMetadata {
  fallbackUsed: boolean;
}

export interface BuildResult {
  status: VerificationBuildStatus;
  headline: string;
  explanation: string;
  passedClaims: number;
  warningClaims: number;
  failedClaims: number;
}

export type AgentRole =
  | 'researcher'
  | 'claim-decomposer'
  | 'challenger'
  | 'source-reader'
  | 'verifier'
  | 'synthesizer';

export interface AgentTraceStep {
  id: string;
  role: AgentRole;
  label: string;
  status: 'completed' | 'skipped' | 'fallback';
  durationMs: number;
  inputCount?: number;
  outputCount?: number;
  note: string;
}

export interface ReproducibilityManifest {
  manifestVersion: '1.0';
  pipelineVersion: string;
  workflowMode: WorkflowMode;
  generatedAt: string;
  model: string;
  buildRulesVersion: string;
  sourceIndependenceVersion: string;
  claimCount: number;
  sourcesScanned: number;
  retainedEvidenceCount: number;
  focusedExtractCount: number;
  snippetFallbackCount: number;
  distinctDomains: number;
  fallbackUsed: boolean;
  stageDurationsMs: Record<string, number>;
  searchQueries: Array<{
    claimId: string;
    supportQuery: string;
    challengeQuery: string;
  }>;
}

export interface SummaryMetadata {
  generatedAt: string;
  stale: boolean;
  staleReason: string | null;
}

export interface ResearchRun {
  id: string;
  query: string;
  summary: string;
  claims: Claim[];
  metrics: ResearchMetrics;
  mode: 'live' | 'demo';
  workflowMode: WorkflowMode;
  buildResult: BuildResult;
  providerMetadata: ProviderMetadata;
  agentTrace: AgentTraceStep[];
  manifest: ReproducibilityManifest;
  summaryMetadata: SummaryMetadata;
  createdAt: string;
}

export type ResearchApiRequest =
  | { mode?: 'research'; query: string }
  | { mode: 'audit'; text: string };

export interface ReverifyRequest {
  claimId: string;
  claimText: string;
  supportQuery: string;
  challengeQuery: string;
  nextBestQuery: string;
}

export type PipelineStage =
  | 'initial-search'
  | 'claim-extraction'
  | 'evidence-search'
  | 'focused-extraction'
  | 'verification'
  | 'synthesis'
  | 'reverification';

export class PipelineError extends Error {
  stage: PipelineStage;
  safeMessage: string;

  constructor(stage: PipelineStage, safeMessage: string) {
    super(safeMessage);
    this.name = 'PipelineError';
    this.stage = stage;
    this.safeMessage = safeMessage;
  }
}
