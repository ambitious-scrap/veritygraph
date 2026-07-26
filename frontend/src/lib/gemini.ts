import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { RawSource, CandidateEvidence } from './tavily';
import { Claim, ClaimVerdict, Evidence, PipelineError, PipelineStage } from './types';

export interface ExtractedClaim {
  text: string;
  supportQuery: string;
  challengeQuery: string;
}

export interface GeminiCallResult<T> {
  data: T;
  usedFallback: boolean;
}

const claimExtractionSchema = z
  .array(
    z.object({
      text: z.string().min(1),
      supportQuery: z.string().min(1),
      challengeQuery: z.string().min(1),
    })
  )
  .length(3);

const rawVerificationSchema = z.object({
  verdict: z.string(),
  confidence: z.number(),
  explanation: z.string(),
  evidence: z
    .array(
      z.object({
        sourceId: z.string().optional(),
        id: z.string().optional(),
        stance: z.string().optional().default('neutral'),
        relevanceScore: z.number().optional(),
        relevance: z.number().optional(),
      })
    )
    .optional()
    .default([]),
});

const synthesisSchema = z.object({
  summary: z.string().min(1),
});

/**
 * Executes a Gemini model call with primary key, falling back to secondary key on failure.
 */
async function callGeminiJson<T>(
  prompt: string,
  stage: PipelineStage,
  schema: z.ZodSchema<T>,
  primaryKey: string,
  secondaryKey: string,
  modelName: string,
  responseSchema?: Record<string, unknown>
): Promise<GeminiCallResult<T>> {
  const tryCall = async (apiKey: string): Promise<T> => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(responseSchema ? { responseSchema } : {}),
      },
    });

    const text = response.text || '';
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(text);
    } catch {
      throw new Error('Malformed JSON output');
    }

    const parsed = schema.safeParse(rawJson);
    if (!parsed.success) {
      throw new Error('Schema validation failed');
    }

    return parsed.data;
  };

  // 1. Try Primary Key
  try {
    const data = await tryCall(primaryKey);
    return { data, usedFallback: false };
  } catch {
    // 2. Retry once using Secondary Key
    try {
      const data = await tryCall(secondaryKey);
      return { data, usedFallback: true };
    } catch {
      // 6. Throw sanitized PipelineError if both keys fail
      throw new PipelineError(
        stage,
        `Gemini provider execution failed during ${stage} across both primary and secondary keys.`
      );
    }
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
Respond ONLY with a JSON array of EXACTLY 3 objects containing "text", "supportQuery", and "challengeQuery".`;

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

  return callGeminiJson(
    prompt,
    'claim-extraction',
    claimExtractionSchema,
    primaryKey,
    secondaryKey,
    modelName,
    responseSchema
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
        `[Source ID: ${e.id}] (Candidate Type: ${e.candidateType})\nTitle: ${e.title}\nDomain: ${e.domain}\nExcerpt: ${e.excerpt}`
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
4. List the evidence sources evaluated. Each item in the "evidence" array MUST contain: "sourceId" (the exact source ID string like c1-ev-s-1), "stance" ("support", "contradict", or "neutral"), and "relevanceScore" (number 0 to 100).
Do not assume a challenge candidate source is automatically contradictory; classify its actual stance.
Do not reference any source ID that is not listed in the retrieved evidence sources above.
Respond ONLY with JSON containing "verdict", "confidence", "explanation", and "evidence" array.`;

  const verificationResponseSchema = {
    type: Type.OBJECT,
    properties: {
      verdict: { type: Type.STRING },
      confidence: { type: Type.NUMBER },
      explanation: { type: Type.STRING },
      evidence: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sourceId: { type: Type.STRING },
            stance: { type: Type.STRING },
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

  const vLower = parsed.verdict.toLowerCase();
  let rawVerdict: ClaimVerdict = 'insufficient';
  if (vLower.includes('support')) rawVerdict = 'supported';
  else if (vLower.includes('contradict')) rawVerdict = 'contradicted';
  else if (vLower.includes('partial')) rawVerdict = 'partial';

  const candidateMap = new Map<string, CandidateEvidence>();
  for (const item of candidateEvidence) {
    candidateMap.set(item.id, item);
  }

  const verifiedEvidence: Evidence[] = [];

  for (const rawEv of parsed.evidence) {
    const sId = rawEv.sourceId || rawEv.id;
    if (!sId) continue;
    const candidate = candidateMap.get(sId);
    if (!candidate) continue;

    const rawRel = rawEv.relevanceScore ?? rawEv.relevance ?? 0;
    const relScoreClamped = Math.max(0, Math.min(100, rawRel));
    if (relScoreClamped < 40) continue;

    const sLower = rawEv.stance.toLowerCase();
    let mappedStance: ClaimVerdict = 'partial';
    if (sLower.includes('support')) mappedStance = 'supported';
    else if (sLower.includes('contradict')) mappedStance = 'contradicted';
    else if (sLower.includes('neutral')) mappedStance = 'partial';

    verifiedEvidence.push({
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      domain: candidate.domain,
      excerpt: candidate.excerpt,
      stance: mappedStance,
      relevanceScore: Math.round(relScoreClamped) / 100,
    });
  }

  let finalVerdict: ClaimVerdict = rawVerdict;
  if (verifiedEvidence.length === 0) {
    finalVerdict = 'insufficient';
  }

  const conf = Math.max(0, Math.min(100, parsed.confidence));
  const evidenceCount = verifiedEvidence.length;
  const distinctDomains = new Set(verifiedEvidence.map((e) => e.domain)).size;
  const hasContradiction =
    finalVerdict === 'contradicted' ||
    verifiedEvidence.some((e) => e.stance === 'contradicted');

  let cappedConf = conf;
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
      confidence: Math.round(cappedConf) / 100,
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
