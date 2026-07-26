import { z } from 'zod';
import { RawSource, CandidateEvidence, fetchWithTimeout } from './tavily';
import { Claim, ClaimVerdict, Evidence, PipelineError, PipelineStage } from './types';

export interface ExtractedClaim {
  text: string;
  supportQuery: string;
  challengeQuery: string;
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
/**
 * Unified JSON generation helper using OpenRouter API
 */
async function callOpenRouterJson<T>(
  prompt: string,
  apiKey: string,
  modelName: string,
  stage: PipelineStage,
  schema: z.ZodSchema<T>
): Promise<T> {
  const targetModel = modelName.includes('/') ? modelName : `google/${modelName}`;

  let res: Response;
  try {
    res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
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
  } catch {
    throw new PipelineError(
      stage,
      `Network failure attempting to reach LLM provider during ${stage}.`
    );
  }

  if (!res.ok) {
    throw new PipelineError(
      stage,
      `LLM provider returned HTTP error status (${res.status}) during ${stage}.`
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new PipelineError(
      stage,
      `Failed to parse JSON response envelope from LLM during ${stage}.`
    );
  }

  const openRouterParsed = openRouterCompletionSchema.safeParse(data);
  if (!openRouterParsed.success) {
    throw new PipelineError(
      stage,
      `LLM provider returned malformed response envelope during ${stage}.`
    );
  }

  const content = openRouterParsed.data.choices[0]?.message.content;

  if (!content) {
    throw new PipelineError(
      stage,
      `LLM provider returned empty completion content during ${stage}.`
    );
  }
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(content);
  } catch {
    throw new PipelineError(
      stage,
      `LLM provider produced malformed, unparseable JSON during ${stage}.`
    );
  }

  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    throw new PipelineError(
      stage,
      `LLM provider output failed strict schema validation during ${stage}.`
    );
  }

  return parsed.data;
}

/**
 * Stage 2: Claim Extraction
 */
export async function extractClaimsWithOpenRouter(
  query: string,
  sources: RawSource[],
  apiKey: string,
  modelName: string
): Promise<ExtractedClaim[]> {
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

  return callOpenRouterJson(
    prompt,
    apiKey,
    modelName,
    'claim-extraction',
    claimExtractionSchema
  );
}

/**
 * Stage 4: Claim Verification
 */
export async function verifyClaimWithOpenRouter(
  claimText: string,
  claimIndex: number,
  candidateEvidence: CandidateEvidence[],
  apiKey: string,
  modelName: string
): Promise<Claim> {
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

  const parsed = await callOpenRouterJson(
    prompt,
    apiKey,
    modelName,
    'verification',
    rawVerificationSchema
  );

  const vLower = parsed.verdict.toLowerCase();
  let rawVerdict: ClaimVerdict = 'insufficient';
  if (vLower.includes('support')) rawVerdict = 'supported';
  else if (vLower.includes('contradict')) rawVerdict = 'contradicted';
  else if (vLower.includes('partial')) rawVerdict = 'partial';

  // Filter evidence: match candidate IDs, clamp relevanceScore, filter >= 40
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
    // Clamp relevanceScore 0..100
    const relScoreClamped = Math.max(0, Math.min(100, rawRel));
    if (relScoreClamped < 40) continue;

    // Map stance to ClaimVerdict
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

  // Rule: No evidence means verdict must be "insufficient"
  let finalVerdict: ClaimVerdict = rawVerdict;
  if (verifiedEvidence.length === 0) {
    finalVerdict = 'insufficient';
  }

  // Confidence calculation and deterministic caps
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
  };
}

/**
 * Stage 5: Synthesis
 */
export async function synthesizeReportWithOpenRouter(
  query: string,
  claims: Claim[],
  apiKey: string,
  modelName: string
): Promise<string> {
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

  const parsed = await callOpenRouterJson(
    prompt,
    apiKey,
    modelName,
    'synthesis',
    synthesisSchema
  );

  return parsed.summary;
}
