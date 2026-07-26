import type { AuditAnchor, WorkflowMode } from './types';

interface NormalizedView {
  text: string;
  originalIndex: number[];
}

interface Match {
  startIndex: number;
  endIndex: number;
  matchStatus: AuditAnchor['matchStatus'];
}

function normalizedView(value: string): NormalizedView {
  const textParts: string[] = [];
  const originalIndex: number[] = [];
  const tokens = value.matchAll(/\S+/g);
  let first = true;

  for (const token of tokens) {
    if (!first) {
      textParts.push(' ');
      originalIndex.push(token.index! - 1);
    }
    first = false;
    for (let offset = 0; offset < token[0].length; offset++) {
      textParts.push(token[0][offset]);
      originalIndex.push(token.index! + offset);
    }
  }

  return { text: textParts.join(''), originalIndex };
}

function findMatch(
  originalText: string,
  quote: string,
  status: Exclude<AuditAnchor['matchStatus'], 'unmatched'>,
  occupied: Array<{ startIndex: number; endIndex: number }>
): Match | null {
  const source = status === 'exact' ? originalText : originalText.toLowerCase();
  const needle = status === 'exact' ? quote : quote.toLowerCase();
  let from = 0;

  while (from <= source.length - needle.length) {
    const index = source.indexOf(needle, from);
    if (index === -1) return null;
    const endIndex = index + needle.length;
    const overlaps = occupied.some(
      (range) => index < range.endIndex && endIndex > range.startIndex
    );
    if (!overlaps) return { startIndex: index, endIndex, matchStatus: status };
    from = index + 1;
  }

  return null;
}

function findNormalizedMatch(
  originalText: string,
  quote: string,
  occupied: Array<{ startIndex: number; endIndex: number }>
): Match | null {
  const source = normalizedView(originalText);
  const needle = normalizedView(quote).text;
  if (!needle) return null;

  let from = 0;
  while (from <= source.text.length - needle.length) {
    const index = source.text.indexOf(needle, from);
    if (index === -1) return null;
    const startIndex = source.originalIndex[index];
    const lastIndex = source.originalIndex[index + needle.length - 1];
    const endIndex = lastIndex + 1;
    const overlaps = occupied.some(
      (range) => startIndex < range.endIndex && endIndex > range.startIndex
    );
    if (!overlaps) {
      return { startIndex, endIndex, matchStatus: 'normalized' };
    }
    from = index + 1;
  }

  return null;
}

function matchClaim(
  originalText: string,
  quote: string,
  occupied: Array<{ startIndex: number; endIndex: number }>
): Match | null {
  for (const status of ['exact', 'case-insensitive'] as const) {
    const match = findMatch(originalText, quote, status, occupied);
    if (match) return match;
  }
  return findNormalizedMatch(originalText, quote, occupied);
}

export function anchorAuditQuotes(
  originalText: string,
  claims: Array<{ id: string; sourceQuote: string }>
): Record<string, AuditAnchor> {
  const result: Record<string, AuditAnchor> = {};
  const occupied: Array<{ startIndex: number; endIndex: number }> = [];
  const orderedClaims = [...claims].sort(
    (a, b) => b.sourceQuote.trim().length - a.sourceQuote.trim().length
  );

  for (const claim of orderedClaims) {
    const quote = claim.sourceQuote;
    const match = quote.trim() ? matchClaim(originalText, quote, occupied) : null;
    if (match) {
      occupied.push({ startIndex: match.startIndex, endIndex: match.endIndex });
      result[claim.id] = { quote, ...match };
    } else {
      result[claim.id] = {
        quote,
        startIndex: null,
        endIndex: null,
        matchStatus: 'unmatched',
      };
    }
  }

  return result;
}

export function attachAuditAnchors<T extends { sourceQuote?: string }>(
  workflowMode: WorkflowMode,
  claims: T[],
  anchors: Record<string, AuditAnchor>
): Array<T & { auditAnchor?: AuditAnchor }> {
  return claims.map((claim, index) => {
    if (workflowMode !== 'audit' || !claim.sourceQuote) return claim;
    return { ...claim, auditAnchor: anchors[`claim-${index + 1}`] };
  });
}
