import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { RawSource, CandidateEvidence, fetchWithTimeout } from './tavily';
import {
  Claim,
  ClaimVerdict,
  Evidence,
  EvidenceStance,
  PipelineError,
  PipelineStage,
} from './types';

export interface ExtractedClaim {
  text: string;
  supportQuery: string;
  challengeQuery: string;
}

export interface GeminiCallResult<T> {
  data: T;
  usedFallback: boolean;
}

type GeminiFailureKind =
  | 'retryable-provider'
  | 'non-retryable-provider'
  | 'invalid-output';

interface CategorizedError {
  kind: GeminiFailureKind;
  message: string;
}

const claimExtractionSchema = z
  .array(
    z.object({
      text: z.string().transform((s) => s.replace(/\s+/g, ' ').trim()),
      supportQuery: z.string().transform((s) => s.replace(/\s+/g, ' ').trim()),
      challengeQuery: z.string().transform((s) => s.replace(/\s+/g, ' ').trim()),
    })
  )
  .length(3);

const rawVerificationSchema = z
  .object({
    verdict: z.enum(['supported', 'contradicted', 'partial', 'insufficient']),
    confidence: z.number().min(0).max(100),
    explanation: z.string().min(10).max(800),
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

const openRouterCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
        }),
      })
    )
    .optional()
    .default([]),
});

const GEMINI_TIMEOUT_MS = 20000;

/**
 * Promise-based 20-second timeout wrapper for Gemini calls
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs = GEMINI_TIMEOUT_MS): Promise<T> {
  let timeoutId: NodeJS.Timeout | number;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error('Gemini request timed out after 20 seconds');
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Classifies an error into retryable, non-retryable, or invalid output
 */
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

  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const lowerMsg = msg.toLowerCase();

  if (
    name === 'TimeoutError' ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('500') ||
    lowerMsg.includes('502') ||
    lowerMsg.includes('503') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('overloaded') ||
    lowerMsg.includes('unavailable') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout')
  ) {
    return { kind: 'retryable-provider', message: 'Provider temporary unavailability or rate limit' };
  }

  if (
    lowerMsg.includes('400') ||
    lowerMsg.includes('401') ||
    lowerMsg.includes('403') ||
    lowerMsg.includes('404') ||
    lowerMsg.includes('invalid model') ||
    lowerMsg.includes('not found') ||
    lowerMsg.includes('key not valid')
  ) {
    return { kind: 'non-retryable-provider', message: 'Invalid model configuration or key permissions' };
  }

  return { kind: 'invalid-output', message: msg || 'Model output processing failure' };
}

/**
 * Gemini JSON caller with strict failure classification and dual-key failover logic
 */
async function callGeminiJson<T>(
  prompt: string,
  stage: PipelineStage,
  schema: z.ZodSchema<T>,
  primaryKey: string,
  secondaryKey: string,
  modelName: string,
  responseSchema?: Record<string, unknown>,
  customValidator?: (val: T) => void
): Promise<GeminiCallResult<T>> {
  const tryCall = async (apiKey: string): Promise<T> => {
    let text = '';
    if (apiKey.startsWith('sk-or-v1-')) {
      const targetModel = modelName.includes('/') ? modelName : `google/${modelName}`;
      const resPromise = fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 2000,
        }),
      });

      const res = await withTimeout(resPromise);
      if (!res.ok) {
        throw new Error(`OpenRouter HTTP error status (${res.status})`);
      }

      const data = await res.json();
      const openRouterParsed = openRouterCompletionSchema.safeParse(data);
      if (openRouterParsed.success) {
        text = openRouterParsed.data.choices[0]?.message?.content || '';
      }
    } else {
      const ai = new GoogleGenAI({ apiKey });
      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema } : {}),
        },
      });

      const response = await withTimeout(apiPromise);
      text = response.text || '';
    }
    if (!text.trim()) {
      throw { kind: 'invalid-output', message: 'Empty model response text' } as CategorizedError;
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(text);
    } catch {
      throw { kind: 'invalid-output', message: 'JSON parsing failure' } as CategorizedError;
    }

    const parsed = schema.safeParse(rawJson);
    if (!parsed.success) {
      throw { kind: 'invalid-output', message: 'Zod schema validation failure' } as CategorizedError;
    }

    if (customValidator) {
      customValidator(parsed.data);
    }

    return parsed.data;
  };

  // 1. Try Primary Key
  try {
    const data = await tryCall(primaryKey);
    return { data, usedFallback: false };
  } catch (primaryErr) {
    const categorized = classifyError(primaryErr);

    // Fallback ONLY for retryable provider errors (429, 500, 502, 503, timeout, network)
    if (categorized.kind === 'retryable-provider') {
      // Pause 3s before trying secondary key
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const data = await tryCall(secondaryKey);
        return { data, usedFallback: true };
      } catch {
        // Pause 20s and retry primary key
        await new Promise((resolve) => setTimeout(resolve, 20000));
        try {
          const data = await tryCall(primaryKey);
          return { data, usedFallback: false };
        } catch {
          // Pause 20s and retry secondary key final time
          await new Promise((resolve) => setTimeout(resolve, 20000));
          try {
            const data = await tryCall(secondaryKey);
            return { data, usedFallback: true };
          } catch {
            throw new PipelineError(
              stage,
              `Gemini service failed during ${stage} across both primary and secondary keys.`
            );
          }
        }
      }
    }

    // Non-retryable provider error or invalid output -> fail immediately without fallback
    throw new PipelineError(
      stage,
      `Gemini service execution failed during ${stage}.`
    );
  }
}

/**
 * Stage 2: Claim Extraction with Gemini
 */
export async function extractClaimsWithGemini(
  query: string,
  sources: RawSource[],
  primaryKey: string,
  secondaryKey: string,
  modelName: string
): Promise<GeminiCallResult<ExtractedClaim[]>> {
  const prompt = `You are a scientific fact-verification system.
User Query: "${query}"

Initial Sources:
${
  sources.length > 0
    ? sources.map((s) => `[${s.id}] Title: ${s.title} (${s.domain})\nExcerpt: ${s.excerpt}`).join('\n\n')
    : 'No external web sources retrieved.'
}

Task: Extract EXACTLY 3 atomic, specific, independently verifiable, important claims derived from the user query and initial sources.
For each claim, generate a target search query to find supporting evidence (supportQuery) and a target search query to find challenging/opposing evidence (challengeQuery).

Do NOT include citations, URLs, or external markdown in any field.
Respond ONLY with a JSON array of EXACTLY 3 objects matching the schema.`;

  const responseSchema = {
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

  // Custom validator to normalize strings & reject duplicate claims
  const validateAndNormalizeClaims = (claims: ExtractedClaim[]) => {
    for (const c of claims) {
      c.text = c.text.replace(/\s+/g, ' ').trim();
      c.supportQuery = c.supportQuery.replace(/\s+/g, ' ').trim();
      c.challengeQuery = c.challengeQuery.replace(/\s+/g, ' ').trim();
    }

    const uniqueNormalized = new Set(claims.map((c) => c.text.toLowerCase()));
    if (uniqueNormalized.size !== 3) {
      throw { kind: 'invalid-output', message: 'Model returned duplicate claims' } as CategorizedError;
    }
  };

  return callGeminiJson(
    prompt,
    'claim-extraction',
    claimExtractionSchema,
    primaryKey,
    secondaryKey,
    modelName,
    responseSchema,
    validateAndNormalizeClaims
  );
}

/**
 * Stage 4: Claim Verification with Gemini
 */
export async function verifyClaimWithGemini(
  claimText: string,
  claimIndex: number,
  candidateEvidence: CandidateEvidence[],
  primaryKey: string,
  secondaryKey: string,
  modelName: string
): Promise<{ claim: Claim; usedFallback: boolean }> {
  const sourcesList = candidateEvidence
    .map(
      (e) =>
        `[Source ID: ${e.id}]\nCandidate Type: ${e.candidateType}\nEvidence Basis: ${e.evidenceBasis === 'focused-source-extract' ? 'Focused source extract' : 'Search snippet'}\nTitle: ${e.title}\nDomain: ${e.domain}\nPassage: ${e.excerpt}`
    )
    .join('\n\n');

  const prompt = `You are a strict evidence verifier.
Claim to verify: "${claimText}"

Retrieved Evidence Sources:
${sourcesList.length > 0 ? sourcesList : 'No evidence sources available.'}

Instructions:
Evaluate the claim ONLY using the supplied evidence sources above.
1. Determine verdict: "supported", "contradicted", "partial", or "insufficient".
2. Assign a confidence score from 0 to 100.
3. Provide a concise 1-2 sentence explanation of the reasoning.
4. List the evidence sources evaluated. Each item in the "evidence" array MUST contain: "sourceId" (exact source ID string like c1-ev-s-1), "stance" ("support", "contradict", or "neutral"), and "relevanceScore" (number 0 to 100).

Guidelines:
* A support candidate is not automatically supporting evidence.
* A challenge candidate is not automatically contradictory evidence.
* Search snippets may contain less context than full-source extracts.
* Evaluate only the supplied passage; do not infer claims from the title alone.
* Return only supplied source IDs.
Respond ONLY with JSON containing "verdict", "confidence", "explanation", and "evidence" array.`;

  const verificationResponseSchema = {
    type: Type.OBJECT,
    properties: {
      verdict: {
        type: Type.STRING,
        enum: ['supported', 'contradicted', 'partial', 'insufficient'],
      },
      confidence: { type: Type.NUMBER },
      explanation: { type: Type.STRING },
      evidence: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sourceId: { type: Type.STRING },
            stance: {
              type: Type.STRING,
              enum: ['support', 'contradict', 'neutral'],
            },
            relevanceScore: { type: Type.NUMBER },
          },
          required: ['sourceId', 'stance', 'relevanceScore'],
        },
      },
    },
    required: ['verdict', 'confidence', 'explanation', 'evidence'],
  };

  const { data: parsed, usedFallback } = await callGeminiJson(
    prompt,
    'verification',
    rawVerificationSchema,
    primaryKey,
    secondaryKey,
    modelName,
    verificationResponseSchema
  );

  // Strict validated Enum values used directly
  const rawVerdict: ClaimVerdict = parsed.verdict;

  const candidateMap = new Map<string, CandidateEvidence>();
  for (const item of candidateEvidence) {
    candidateMap.set(item.id, item);
  }

  const verifiedEvidence: Evidence[] = [];
  const seenSourceIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const rawEv of parsed.evidence) {
    const sId = rawEv.sourceId;
    if (!sId || seenSourceIds.has(sId)) continue;
    const candidate = candidateMap.get(sId);
    if (!candidate) continue;

    // Deduplicate by URL as well
    const canonicalUrl = candidate.url.toLowerCase().replace(/\/$/, '');
    if (seenUrls.has(canonicalUrl)) continue;

    // Exclude evidence with relevanceScore < 40
    if (rawEv.relevanceScore < 40) continue;

    seenSourceIds.add(sId);
    seenUrls.add(canonicalUrl);

    // Stance is validated Enum: 'support' | 'contradict' | 'neutral'
    const stance: EvidenceStance = rawEv.stance;

    verifiedEvidence.push({
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      domain: candidate.domain,
      excerpt: candidate.excerpt,
      stance,
      relevanceScore: Math.round(rawEv.relevanceScore) / 100, // Decimal 0..1
      evidenceBasis: candidate.evidenceBasis,
    });
  }

  // Rule: No retained evidence means verdict must be "insufficient"
  let finalVerdict: ClaimVerdict = rawVerdict;
  if (verifiedEvidence.length === 0) {
    finalVerdict = 'insufficient';
  }

  const evidenceCount = verifiedEvidence.length;
  const distinctDomains = new Set(verifiedEvidence.map((e) => e.domain)).size;
  const hasContradiction =
    finalVerdict === 'contradicted' ||
    verifiedEvidence.some((e) => e.stance === 'contradict');

  // Deterministic Confidence Caps:
  let cappedConf = parsed.confidence;
  let appliedCap: string | null = null;

  if (finalVerdict === 'insufficient') {
    if (cappedConf > 45) {
      cappedConf = 45;
      appliedCap = 'Capped at 45% (Insufficient evidence limits score)';
    }
  } else if (finalVerdict === 'partial') {
    if (cappedConf > 75) {
      cappedConf = 75;
      appliedCap = 'Capped at 75% (Partial support limits score)';
    }
  } else if (
    (finalVerdict === 'supported' || finalVerdict === 'contradicted') &&
    distinctDomains < 2
  ) {
    if (cappedConf > 70) {
      cappedConf = 70;
      appliedCap = 'Capped at 70% (Fewer than 2 distinct domains)';
    }
  }

  if (cappedConf > 95) {
    cappedConf = 95;
    appliedCap = 'Capped at 95% (Global confidence upper bound)';
  }

  return {
    claim: {
      id: `claim-${claimIndex}`,
      text: claimText,
      verdict: finalVerdict,
      confidence: Math.round(cappedConf) / 100, // Decimal 0..1
      explanation: parsed.explanation,
      evidence: verifiedEvidence,
      confidenceFactors: {
        evidenceCount,
        distinctDomains,
        hasContradiction,
        appliedCap,
      },
    },
    usedFallback,
  };
}

/**
 * Stage 5: Synthesis with Gemini
 */
export async function synthesizeReportWithGemini(
  query: string,
  claims: Claim[],
  primaryKey: string,
  secondaryKey: string,
  modelName: string
): Promise<GeminiCallResult<string>> {
  const claimSummary = claims
    .map(
      (c) =>
        `- Claim: "${c.text}"\n  Verdict: ${c.verdict.toUpperCase()} (Confidence: ${Math.round(c.confidence * 100)}%)\n  Explanation: ${c.explanation}`
    )
    .join('\n\n');

  const prompt = `You are a research synthesis agent.
User Query: "${query}"

Verified Claims Summary:
${claimSummary}

Task: Write a concise 2–4 sentence executive summary of the research findings.
Requirements:
1. Acknowledge uncertainty and any contradictions in the evidence.
2. Do NOT introduce any new facts or claims not listed above.
Respond ONLY with a JSON object containing "summary".`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
    },
    required: ['summary'],
  };

  const { data: parsed, usedFallback } = await callGeminiJson(
    prompt,
    'synthesis',
    synthesisSchema,
    primaryKey,
    secondaryKey,
    modelName,
    responseSchema
  );

  return { data: parsed.summary, usedFallback };
}
