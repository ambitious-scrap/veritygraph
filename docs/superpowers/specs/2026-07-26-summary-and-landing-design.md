# VerityGraph Summary and Landing Design

## Goal

Make the first visit legible as a product and make post-run feedback easy to scan before exposing deeper evidence.

## Information Architecture

1. Marketing landing hero: product promise, plain-language value, three outcomes, and one primary CTA.
2. Verification workspace: research/audit mode selection, labeled input, primary run action, example, and demo.
3. Run results: build verdict, plain-language interpretation, concise summary digest, claim digest, then details.

The landing and workspace remain on one page. No new route, API, dependency, or persistence layer.

## Result Summary

The first result view must answer three questions in order:

- Did the verification pass, warn, or fail?
- What is the short, plain-language takeaway?
- Which claims need attention?

The overview contains the build status, its existing explanation, up to three short points derived from the existing summary, and a compact claim digest with verdict, confidence, and one-line explanation.

## Progressive Disclosure

- Claims are collapsed after a run; evidence is never expanded by default.
- `Read reasoning` reveals missing evidence, next-best query, confidence factors, and source-independence context.
- `Read the evidence` reveals source passages, stance, basis, origin, domain, and relevance.
- Existing export actions remain available at the result header.

No result data is removed. The change only changes default visibility and labels.

## Copy Principles

Use calm, direct language. Prefer `What passed`, `What needs review`, `What would change this`, and `Read the evidence` over abstract labels. Do not introduce unsupported claims or new factual content.

## Accessibility and Responsive Behavior

- Keep semantic headings and labels.
- Preserve keyboard-visible focus and `aria-expanded` state on disclosure controls.
- Keep touch targets at least 44px.
- Maintain no horizontal overflow at 375px and desktop widths.
- Preserve reduced-motion behavior.

## README Scope

Rewrite the root README in a generator-style structure informed by `readme-md-generator`: product pitch, features, demo, stack, setup, environment, workflows, pipeline, build rules, exports, structure, scripts, limitations, contributing, and license status. Document only repository-observed behavior; do not invent deployment, license, or test claims.

## Verification

- `npm run lint`
- `npm run build`
- `git diff --check`
- Browser checks at 375px and desktop widths.
- Demo run confirms overview, collapsed details, evidence disclosure, exports, and no overflow.
