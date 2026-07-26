# Summary and Landing Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make VerityGraph read like a product before interaction and make post-run feedback scannable before revealing evidence detail.

**Architecture:** Keep the existing single-page Next.js client and API contracts. Reorganize `page.tsx` into a stacked marketing hero, verification workspace, and result overview; use existing run data and local disclosure state for progressive detail. Rewrite only the root README for project onboarding.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons, existing CSS custom properties.

## Global Constraints

- No new route, API contract, dependency, database, authentication, or persistence layer.
- Keep existing `ResearchRun`, `BuildResult`, `Claim`, and evidence fields as the source of truth.
- Preserve keyboard-visible focus, semantic labels, `aria-expanded`, 44px touch targets, reduced motion, and no overflow at 375px.
- Use calm, direct copy; do not introduce unsupported factual claims.
- Evidence is closed by default after a run; no result data is removed.

---

### Task 1: Add summary and disclosure helpers

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Add `summaryPoints(summary: string): string[]`, returning at most three trimmed sentence points and falling back to the original summary when sentence parsing yields none.
- Add `claimDigestText(claim: Claim): string`, returning the existing explanation collapsed to one readable line for the overview.

- [ ] **Step 1: Add pure helpers near the existing percentage helper.**

```tsx
function summaryPoints(summary: string) {
  const points = summary
    .split(/(?<=[.!?])\s+/)
    .map((point) => point.trim())
    .filter(Boolean)
    .slice(0, 3);
  return points.length ? points : [summary.trim()];
}

function claimDigestText(claim: Claim) {
  return claim.explanation.replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 2: Change run initialization so claim evidence is collapsed by default.**

```tsx
setRun(data as ResearchRun);
setOpen({});
```

Use the same empty disclosure state for demo data while preserving the run itself.

- [ ] **Step 3: Keep `aria-expanded` truthful on every disclosure button and remove no data fields.**

- [ ] **Step 4: Run `npm run lint` and confirm no TypeScript or lint errors.**

---

### Task 2: Reorganize landing, workspace, and result overview

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/globals.css` only if the existing token utilities cannot express the approved states.

**Interfaces:**
- No API changes.
- Existing `handleVerify`, `loadExample`, `loadDemo`, `exportReport`, `toggle`, and `toggleWhy` remain the event boundaries.

- [ ] **Step 1: Replace the current side-by-side first section with a stacked flow.**

Landing content must contain:

```tsx
<section aria-labelledby="landing-title">
  <span>Evidence checker for research and AI answers</span>
  <h1 id="landing-title">Make every claim carry its evidence.</h1>
  <p>Turn a research query or AI answer into a clear evidence trail you can inspect.</p>
  <button type="button">Start verifying</button>
  <button type="button">Load demo</button>
</section>
```

The `Start verifying` action focuses and scrolls to the workspace input. The marketing section includes three short outcome statements but no duplicate technical explanation panel.

- [ ] **Step 2: Add a distinct verification workspace section below the landing section.**

Use an `h2` such as `Run a verification`, a short helper sentence, the existing Research/Audit tabs, visible mode-specific input label, and existing actions. Keep the form behavior unchanged.

- [ ] **Step 3: Make the result overview answer these questions in order.**

1. Build verdict: existing `BuildBadge`, headline, counts, and explanation.
2. Plain-language takeaway: an `In brief` panel rendering `summaryPoints(run.summary)` as a short list.
3. Claim digest: each claim shows verdict, build status, confidence, text, and `claimDigestText(claim)`.

- [ ] **Step 4: Move detailed claim context behind `Read reasoning`.**

The expanded reasoning block contains `missingEvidence`, `nextBestQuery`, confidence factors, and source-independence counts. Label the control `Read reasoning` / `Hide reasoning` and retain copy-query behavior.

- [ ] **Step 5: Label evidence disclosure `Read the evidence` / `Hide the evidence`.**

Keep source title, URL, stance, basis, origin, domain, excerpt, and relevance unchanged inside the expanded region.

- [ ] **Step 6: Add semantic section headings and ensure only one primary action is visually dominant.**

- [ ] **Step 7: Run `npm run build` and `git diff --check`.**

---

### Task 3: Rewrite the generator-style README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Preserve verified project facts.**

Document the existing Next.js frontend, Gemini, Tavily Search/Extract, research/audit/demo workflows, six pipeline stages, build rules, exports, environment variables, scripts, limitations, and no-license status.

- [ ] **Step 2: Use a generator-style structure.**

Sections: title/tagline, overview, demo link, features, tech stack, getting started, environment, usage, pipeline, verification rules, exports, project structure, scripts, limitations, contributing, and license.

- [ ] **Step 3: Keep setup commands runnable from the repository root and state that API keys remain server-side.**

- [ ] **Step 4: Remove stale or unsupported claims.**

Do not claim automated CI, a license, persistent storage, PDF parsing, or a test suite that does not exist.

---

### Task 4: Validate and wrap up

**Files:**
- No additional files.

- [ ] **Step 1: Run `npm run lint`.**

- [ ] **Step 2: Run `npm run build`.**

- [ ] **Step 3: Run `git diff --check`.**

- [ ] **Step 4: Browser-check 375px and desktop.**

Verify landing copy, CTA focus/scroll, research/audit tabs, demo result, build overview, three-point summary, collapsed evidence, reasoning disclosure, exports, keyboard focus, and no horizontal overflow.

- [ ] **Step 5: Commit and push the implementation.**

```bash
git add README.md frontend/src/app/page.tsx frontend/src/app/globals.css
git commit -m "feat: clarify verification results"
git push origin main
```
