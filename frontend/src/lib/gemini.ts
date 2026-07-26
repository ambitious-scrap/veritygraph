import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { RawSource, CandidateEvidence } from './tavily';
import { canonicalizeUrl } from './verificationRules';
import {
  Claim,
  ClaimVerdict,
  Evidence,
  EvidenceStance,
  PipelineError,
  PipelineStage,
  WorkflowMode,
} from './types';

export interface ExtractedClaim {
  text: string;
  sourceQuote?: string;
  supportQuery: string;
  challengeQuery: string;
}

export interface GeminiCallResult<T> {
  data: T;
  usedFallback: boolean;
}

type GeminiFailureKind = 'retryable-provider' | 'non-retryable-provider' | 'invalid-output';

interface CategorizedError {
  kind: GeminiFailureKind;
  message: string;
}

const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_FALLBACK_DELAY_MS = 250;

const researchClaimSchema = z
  .array(
    z
      .object({
        text: z.string().min(10).max(500),
        supportQuery: z.string().min(3).max(300),
        challengeQuery: z.string().min(3).max(300),
      })
      .strict()
  )
  .length(3);

const auditClaimSchema = z
  .array(
    z
      .object({
        text: z.string().min(10).max(500),
        sourceQuote: z.string().min(10).max(600),
        supportQuery: z.string().min(3).max(300),
        challengeQuery: z.string().min(3).max(300),
      })
      .strict()
  )
  .length(3);

const rawVerificationSchema = z
  .object({
    verdict: z.enum(['supported', 'contradicted', 'partial', 'insufficient']),
    confidence: z.number().min(0).max(100),
    explanation: z.string().min(10).max(800),
    missingEvidence: z.string().min(10).max(400),
    nextBestQuery: z.string().min(3).max(300),
    evidence: z
      .array(
        z
          .object({
            sourceId: z.string().min(1),
            stance: z.enum(['support', 'contradict', 'neutral']),
            relevanceScore: z.number().min(0).max(100),
          })
          .strict()
      )
      .max(6),
  })
  .strict();

const synthesisSchema = z
  .object({
    summary: z.string().min(40).max(1200),
  })
  .strict();

function withTimeout<T>(promise: Promise<T>, timeoutMs = GEMINI_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error('Gemini request timed out');
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function numericStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  for (const key of ['status', 'statusCode', 'httpStatus']) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  }
  return null;
}

function classifyError(error: unknown): CategorizedError {
  if (
    error &&
    typeof error === 'object' &&
    'kind' in error &&
    (error.kind === 'invalid-output' ||
      error.kind === 'non-retryable-provider' ||
      error.kind === 'retryable-provider')
  ) {
    return error as CategorizedError;
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const status = numericStatus(error);
  if ([429, 500, 502, 503].includes(status ?? -1)) {
    return { kind: 'retryable-provider', message: 'Temporary Gemini provider failure' };
  }
  if (name === 'TimeoutError') {
    return { kind: 'retryable-provider', message: 'Gemini provider timeout' };
  }

  const lower = message.toLowerCase();
  if (
    /\b(?:429|500|502|503)\b/.test(lower) ||
    /\b(?:econnreset|etimedout|econnrefused|enotfound|eai_again)\b/.test(lower) ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('connection')
  ) {
    return { kind: 'retryable-provider', message: 'Temporary Gemini provider failure' };
  }
  if ([400, 401, 403, 404].includes(status ?? -1)) {
    return { kind: 'non-retryable-provider', message: 'Invalid Gemini request or permissions' };
  }
  if (/\b(?:400|401|403|404)\b/.test(lower) || lower.includes('invalid model') || lower.includes('key not valid')) {
    return { kind: 'non-retryable-provider', message: 'Invalid Gemini request or permissions' };
  }
  return { kind: 'invalid-output', message: 'Gemini response processing failure' };
}
export async function runGeminiWithFallback<T>(
  primaryCall: () => Promise<T>,
  secondaryCall: () => Promise<T>,
  stage: PipelineStage,
  fallbackDelayMs = GEMINI_FALLBACK_DELAY_MS
): Promise<GeminiCallResult<T>> {
  try {
    return { data: await primaryCall(), usedFallback: false };
  } catch (primaryError) {
    if (classifyError(primaryError).kind !== 'retryable-provider') {
      throw new PipelineError(stage, `Gemini service execution failed during ${stage}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, fallbackDelayMs));
    try {
      return { data: await secondaryCall(), usedFallback: true };
    } catch {
      throw new PipelineError(stage, `Gemini service failed during ${stage} across both configured keys.`);
    }
  }
}


async function callGeminiJson<T>(
  prompt: string,
  stage: PipelineStage,
  schema: z.ZodType<T>,
  primaryKey: string,
  secondaryKey: string,
  modelName: string,
  responseSchema?: Record<string, unknown>,
  customValidator?: (value: T) => void
): Promise<GeminiCallResult<T>> {
  const tryCall = async (apiKey: string): Promise<T> => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await withTimeout(
      ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema } : {}),
        },
      })
    );
    const text = response.text || '';
    if (!text.trim()) {
      throw { kind: 'invalid-output', message: 'Empty model response' } as CategorizedError;
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(text);
    } catch {
      throw { kind: 'invalid-output', message: 'Invalid JSON model response' } as CategorizedError;
    }

    const parsed = schema.safeParse(rawJson);
    if (!parsed.success) {
      throw { kind: 'invalid-output', message: 'Invalid model response schema' } as CategorizedError;
    }
    customValidator?.(parsed.data);
    return parsed.data;
  };

  return runGeminiWithFallback(() => tryCall(primaryKey), () => tryCall(secondaryKey), stage);
}

function normalizeClaim(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function claimTokens(value: string): Set<string> {
  return new Set(
    normalizeClaim(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function claimSimilarity(a: string, b: string): number {
  const left = claimTokens(a);
  const right = claimTokens(b);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / (left.size + right.size - intersection);
}

function validateClaims(claims: ExtractedClaim[]) {
  for (const claim of claims) {
    claim.text = normalizeClaim(claim.text);
    claim.sourceQuote = claim.sourceQuote ? normalizeClaim(claim.sourceQuote) : undefined;
    claim.supportQuery = normalizeClaim(claim.supportQuery);
    claim.challengeQuery = normalizeClaim(claim.challengeQuery);
    if (!claim.text || !claim.supportQuery || !claim.challengeQuery || (claim.sourceQuote !== undefined && !claim.sourceQuote)) {
      throw { kind: 'invalid-output', message: 'Empty normalized claim field' } as CategorizedError;
    }
  }

  if (new Set(claims.map((claim) => claim.text.toLowerCase())).size !== 3) {
    throw { kind: 'invalid-output', message: 'Duplicate claims' } as CategorizedError;
  }
  if (claims.some((claim, index) => claims.slice(index + 1).some((other) => claimSimilarity(claim.text, other.text) >= 0.72))) {
    throw { kind: 'invalid-output', message: 'Paraphrased duplicate claims' } as CategorizedError;
  }
  if (new Set(claims.map((claim) => claim.supportQuery.toLowerCase())).size === 1) {
    throw { kind: 'invalid-output', message: 'Identical support queries' } as CategorizedError;
  }
  if (new Set(claims.map((claim) => claim.challengeQuery.toLowerCase())).size === 1) {
    throw { kind: 'invalid-output', message: 'Identical challenge queries' } as CategorizedError;
  }
}

const researchResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      supportQuery: { type: Type.STRING },
      challengeQuery: { type: Type.STRING },
    },
    required: ['text', 'supportQuery', 'challengeQuery'],
  },
};

const auditResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      sourceQuote: { type: Type.STRING },
      supportQuery: { type: Type.STRING },
      challengeQuery: { type: Type.STRING },
    },
    required: ['text', 'sourceQuote', 'supportQuery', 'challengeQuery'],
  },
};

export async function extractClaimsWithGemini(
  inputQueryOrText: string,
  sources: RawSource[],
  workflowMode: WorkflowMode,
  primaryKey: string,
  secondaryKey: string,
  modelName: string
): Promise<GeminiCallResult<ExtractedClaim[]>> {
  const prompt = workflowMode === 'audit'
    ? `You are an AI answer verification compiler.\n\nPasted AI Answer to Audit:\n"""\n${inputQueryOrText}\n"""\n\nExtract EXACTLY three important factual claims found only in the pasted answer. Ignore opinions, advice, rhetoric, and vague predictions. Copy sourceQuote verbatim from the answer; never paraphrase it. Do not introduce external facts. Return only the strict JSON array.`
    : `You are a scientific fact-verification system.\nUser Query: "${inputQueryOrText}"\n\nInitial Sources:\n${sources.length ? sources.map((source) => `[${source.id}] ${source.title} (${source.domain})\n${source.excerpt}`).join('\n\n') : 'No external web sources retrieved.'}\n\nExtract EXACTLY three atomic, specific, independently verifiable factual claims derived from the query and supplied sources. Return distinct supportQuery and challengeQuery values for each claim. Do not include citations or URLs. Return only the strict JSON array.`;

  return callGeminiJson(
    prompt,
    'claim-extraction',
    workflowMode === 'audit' ? auditClaimSchema : researchClaimSchema,
    primaryKey,
    secondaryKey,
    modelName,
    workflowMode === 'audit' ? auditResponseSchema : researchResponseSchema,
    validateClaims
  );
}

export async function verifyClaimWithGemini(
  claimText: string,
  claimIndex: number,
  candidateEvidence: CandidateEvidence[],
  primaryKey: string,
  secondaryKey: string,
  modelName: string,
  searchQueries: { support: string; challenge: string }
): Promise<{
  claim: Omit<Claim, 'sourceIndependence' | 'claimBuildStatus'>;
  usedFallback: boolean;
}> {
  const sourcesList = candidateEvidence
    .map((evidence) => `[Source ID: ${evidence.id}]\nCandidate Type: ${evidence.candidateType}\nEvidence Basis: ${evidence.evidenceBasis}\nTitle: ${evidence.title}\nDomain: ${evidence.domain}\nPassage: ${evidence.excerpt}`)
    .join('\n\n');
  const prompt = `You are a strict evidence verifier.\nClaim to verify: "${claimText}"\n\nRetrieved Evidence Sources:\n${sourcesList || 'No evidence sources available.'}\n\nEvaluate the claim ONLY using supplied passages. Return verdict, confidence from 0 to 100, concise explanation, missingEvidence, nextBestQuery, and evidence items containing only supplied source IDs, stance, and relevanceScore. A support candidate is not automatically supporting evidence. A challenge candidate is not automatically contradictory evidence. Return only JSON.`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      verdict: { type: Type.STRING, enum: ['supported', 'contradicted', 'partial', 'insufficient'] },
      confidence: { type: Type.NUMBER },
      explanation: { type: Type.STRING },
      missingEvidence: { type: Type.STRING },
      nextBestQuery: { type: Type.STRING },
      evidence: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sourceId: { type: Type.STRING },
            stance: { type: Type.STRING, enum: ['support', 'contradict', 'neutral'] },
            relevanceScore: { type: Type.NUMBER },
          },
          required: ['sourceId', 'stance', 'relevanceScore'],
        },
      },
    },
    required: ['verdict', 'confidence', 'explanation', 'missingEvidence', 'nextBestQuery', 'evidence'],
  };

  const { data: parsed, usedFallback } = await callGeminiJson(
    prompt,
    'verification',
    rawVerificationSchema,
    primaryKey,
    secondaryKey,
    modelName,
    responseSchema
  );

  const candidateMap = new Map(candidateEvidence.map((candidate) => [candidate.id, candidate]));
  const verifiedEvidence: Evidence[] = [];
  const seenUrls = new Set<string>();
  for (const rawEvidence of parsed.evidence) {
    const candidate = candidateMap.get(rawEvidence.sourceId);
    if (!candidate || rawEvidence.relevanceScore < 40) continue;
    const url = canonicalizeUrl(candidate.url);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    verifiedEvidence.push({
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      domain: candidate.domain,
      excerpt: candidate.excerpt,
      stance: rawEvidence.stance as EvidenceStance,
      relevanceScore: Math.round(rawEvidence.relevanceScore) / 100,
      evidenceBasis: candidate.evidenceBasis,
      originGroupId: 'origin-0',
    });
  }

  let verdict: ClaimVerdict = parsed.verdict;
  if (!verifiedEvidence.length) verdict = 'insufficient';
  const distinctDomains = new Set(verifiedEvidence.map((evidence) => evidence.domain)).size;
  let confidence = Math.max(0, Math.min(100, parsed.confidence));
  let appliedCap: string | null = null;
  if (verdict === 'insufficient' && confidence > 45) {
    confidence = 45;
    appliedCap = 'Capped at 45% (Insufficient evidence limits score)';
  } else if (verdict === 'partial' && confidence > 75) {
    confidence = 75;
    appliedCap = 'Capped at 75% (Partial support limits score)';
  } else if ((verdict === 'supported' || verdict === 'contradicted') && distinctDomains < 2 && confidence > 70) {
    confidence = 70;
    appliedCap = 'Capped at 70% (Fewer than 2 distinct domains)';
  }
  if (confidence > 95) {
    confidence = 95;
    appliedCap = 'Capped at 95% (Global confidence upper bound)';
  }

  return {
    claim: {
      id: `claim-${claimIndex}`,
      text: claimText,
      verdict,
      confidence: Math.round(confidence) / 100,
      explanation: parsed.explanation.trim(),
      missingEvidence: parsed.missingEvidence.trim(),
      nextBestQuery: parsed.nextBestQuery.trim(),
      searchQueries,
      evidence: verifiedEvidence,
      confidenceFactors: {
        evidenceCount: verifiedEvidence.length,
        distinctDomains,
        hasContradiction: verdict === 'contradicted' || verifiedEvidence.some((evidence) => evidence.stance === 'contradict'),
        appliedCap,
      },
    },
    usedFallback,
  };
}

export async function synthesizeReportWithGemini(
  query: string,
  claims: Array<Pick<Claim, 'text' | 'verdict' | 'confidence' | 'explanation'>>,
  primaryKey: string,
  secondaryKey: string,
  modelName: string
): Promise<GeminiCallResult<string>> {
  const claimSummary = claims
    .map((claim) => `- Claim: "${claim.text}"\n  Verdict: ${claim.verdict.toUpperCase()} (${Math.round(claim.confidence * 100)}%)\n  Explanation: ${claim.explanation}`)
    .join('\n\n');
  const prompt = `You are a research synthesis agent.\nUser Query / Audited Topic: "${query}"\n\nVerified Claims:\n${claimSummary}\n\nWrite a concise 2–4 sentence executive summary. Acknowledge uncertainty and contradictions. Do not introduce facts not listed above. Return only JSON with summary.`;
  const responseSchema = {
    type: Type.OBJECT,
    properties: { summary: { type: Type.STRING } },
    required: ['summary'],
  };
  const { data, usedFallback } = await callGeminiJson(
    prompt,
    'synthesis',
    synthesisSchema,
    primaryKey,
    secondaryKey,
    modelName,
    responseSchema
  );
  return { data: data.summary, usedFallback };
}
