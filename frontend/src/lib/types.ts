export type ClaimVerdict = 'supported' | 'contradicted' | 'partial' | 'insufficient';

export type EvidenceStance = 'support' | 'contradict' | 'neutral';

export interface Evidence {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  stance: EvidenceStance;
  relevanceScore: number;
}

export interface ConfidenceFactors {
  evidenceCount: number;
  distinctDomains: number;
  hasContradiction: boolean;
  appliedCap: string | null;
}

export interface Claim {
  id: string;
  text: string;
  verdict: ClaimVerdict;
  confidence: number;
  explanation: string;
  evidence: Evidence[];
  confidenceFactors: ConfidenceFactors;
}

export interface ResearchMetrics {
  durationMs: number;
  sourcesScanned: number;
  distinctDomains: number;
  supportedClaims: number;
  challengedClaims: number;
  insufficientClaims: number;
}

export interface ProviderMetadata {
  fallbackUsed: boolean;
}

export interface ResearchRun {
  id: string;
  query: string;
  summary: string;
  claims: Claim[];
  metrics: ResearchMetrics;
  mode: 'live' | 'demo';
  providerMetadata: ProviderMetadata;
  createdAt: string;
}

export type PipelineStage =
  | 'initial-search'
  | 'claim-extraction'
  | 'evidence-search'
  | 'verification'
  | 'synthesis';

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
