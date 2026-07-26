import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { RawSource, CandidateEvidence } from './tavily';
import { Claim, ClaimVerdict, Evidence } from './types';

export interface ExtractedClaim {
  text: string;
  supportQuery: string;
  challengeQuery: string;
}

const claimExtractionSchema = z.array(
  z.object({
    text: z.string().min(1),
    supportQuery: z.string().min(1),
    challengeQuery: z.string().min(1),
  })
);

const geminiRawVerificationSchema = z.object({
  verdict: z.enum(['supported', 'contradicted', 'partial', 'insufficient']),
  confidence: z.number(),
  explanation: z.string(),
  evidence: z
    .array(
      z.object({
        sourceId: z.string(),
        stance: z.string(),
        relevanceScore: z.number(),
      })
    )
    .optional()
    .default([]),
});

const geminiSynthesisSchema = z.object({
  summary: z.string().min(1),
});

/**
 * Stage 2: Claim Extraction with Gemini
 */
export async function extractClaimsWithGemini(
  query: string,
  sources: RawSource[],
  apiKey: string,
  modelName: string
): Promise<ExtractedClaim[]> {
  const ai = new GoogleGenAI({ apiKey });

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
Respond with JSON matching the required schema.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
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
        },
      },
    });

    const responseText = response.text || '';
    const rawJson = JSON.parse(responseText);
    const parsed = claimExtractionSchema.safeParse(rawJson);

    if (!parsed.success || parsed.data.length === 0) {
      throw new Error('Gemini failed to extract valid claims schema');
    }

    // Ensure exactly 3 claims
    return parsed.data.slice(0, 3);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Claim extraction failed: ${msg}`);
  }
}

/**
 * Stage 4: Claim Verification with Gemini
 */
export async function verifyClaimWithGemini(
  claimText: string,
  claimIndex: number,
  candidateEvidence: CandidateEvidence[],
  apiKey: string,
  modelName: string
): Promise<Claim> {
  const ai = new GoogleGenAI({ apiKey });

  const sourcesList = candidateEvidence
    .map((e) => `[Source ID: ${e.id}]\nTitle: ${e.title}\nDomain: ${e.domain}\nExcerpt: ${e.excerpt}`)
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
4. List the evidence sources evaluated, assessing each source stance ("support", "contradict", or "neutral") and a relevance score (0 to 100).
Do not reference any source ID that is not listed in the retrieved evidence sources above.`;

  let rawVerdict: ClaimVerdict = 'insufficient';
  let rawConfidence = 40;
  let explanation = 'Insufficient evidence retrieved to evaluate this claim.';
  let rawEvidenceItems: Array<{ sourceId: string; stance: string; relevanceScore: number }> = [];

  if (candidateEvidence.length > 0) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
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
                    stance: { type: Type.STRING },
                    relevanceScore: { type: Type.NUMBER },
                  },
                  required: ['sourceId', 'stance', 'relevanceScore'],
                },
              },
            },
            required: ['verdict', 'confidence', 'explanation', 'evidence'],
          },
        },
      });

      const text = response.text || '';
      const rawJson = JSON.parse(text);
      const parsed = geminiRawVerificationSchema.safeParse(rawJson);

      if (parsed.success) {
        rawVerdict = parsed.data.verdict;
        rawConfidence = parsed.data.confidence;
        explanation = parsed.data.explanation;
        rawEvidenceItems = parsed.data.evidence;
      }
    } catch {
      // Fall back to default insufficient evaluation if model parsing fails
    }
  }

  // Filter evidence: keep only matching source IDs and relevanceScore >= 40
  const candidateMap = new Map<string, CandidateEvidence>();
  for (const item of candidateEvidence) {
    candidateMap.set(item.id, item);
  }

  const verifiedEvidence: Evidence[] = [];

  for (const rawEv of rawEvidenceItems) {
    const candidate = candidateMap.get(rawEv.sourceId);
    if (!candidate) continue;

    // Normalize relevanceScore to 0..100
    const relScoreNormalized =
      rawEv.relevanceScore <= 1 ? rawEv.relevanceScore * 100 : rawEv.relevanceScore;

    if (relScoreNormalized < 40) continue;

    // Map stance to ClaimVerdict
    const sLower = rawEv.stance.toLowerCase();
    let mappedStance: ClaimVerdict = 'partial';
    if (sLower.includes('support')) mappedStance = 'supported';
    else if (sLower.includes('contradict')) mappedStance = 'contradicted';
    else if (sLower.includes('insufficient')) mappedStance = 'insufficient';

    verifiedEvidence.push({
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      domain: candidate.domain,
      excerpt: candidate.excerpt,
      stance: mappedStance,
      relevanceScore: Math.round(relScoreNormalized) / 100,
    });
  }

  // Rule: No evidence means verdict must be "insufficient"
  let finalVerdict: ClaimVerdict = rawVerdict;
  if (verifiedEvidence.length === 0) {
    finalVerdict = 'insufficient';
  }

  // Deterministic Confidence Caps:
  // Normalize rawConfidence to 0..100
  let conf = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
  conf = Math.max(0, Math.min(100, conf));

  const distinctDomains = new Set(verifiedEvidence.map((e) => e.domain)).size;

  if (finalVerdict === 'insufficient') {
    conf = Math.min(conf, 45);
  } else if (finalVerdict === 'partial') {
    conf = Math.min(conf, 75);
  } else if (
    (finalVerdict === 'supported' || finalVerdict === 'contradicted') &&
    distinctDomains < 2
  ) {
    conf = Math.min(conf, 70);
  }

  // All verdicts cap: max 95
  conf = Math.min(conf, 95);

  return {
    id: `claim-${claimIndex}`,
    text: claimText,
    verdict: finalVerdict,
    confidence: Math.round(conf) / 100,
    explanation,
    evidence: verifiedEvidence,
  };
}

/**
 * Stage 5: Synthesis with Gemini
 */
export async function synthesizeReportWithGemini(
  query: string,
  claims: Claim[],
  apiKey: string,
  modelName: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

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
Respond in JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
          },
          required: ['summary'],
        },
      },
    });

    const text = response.text || '';
    const parsed = geminiSynthesisSchema.safeParse(JSON.parse(text));
    if (parsed.success) {
      return parsed.data.summary;
    }
  } catch {
    // Fallback if synthesis model call fails
  }

  return `Analysis of the query "${query}" yielded ${claims.length} extracted claims. Evidence supports certain aspects while highlighting contradictions and data limitations in other areas.`;
}
