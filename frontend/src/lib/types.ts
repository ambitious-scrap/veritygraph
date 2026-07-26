export type ClaimVerdict = 'supported' | 'contradicted' | 'partial' | 'insufficient';

export interface Evidence {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  stance: ClaimVerdict;
  relevanceScore: number;
}

export interface Claim {
  id: string;
  text: string;
  verdict: ClaimVerdict;
  confidence: number;
  explanation: string;
  evidence: Evidence[];
}

export interface ResearchRun {
  id: string;
  query: string;
  summary: string;
  claims: Claim[];
  createdAt: string;
}
