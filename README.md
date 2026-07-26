# VerityGraph

> **Every claim must earn its evidence.**

VerityGraph is an evidence-first verification compiler for research questions and AI-generated answers. It extracts atomic claims, retrieves supporting and challenging sources, verifies each claim, and makes uncertainty visible before a report is exported.

[Live demo](https://veritygraph.vercel.app) · [GitHub repository](https://github.com/ambitious-scrap/veritygraph)

## Why VerityGraph?

AI answers can sound convincing before anyone checks the individual claims. VerityGraph turns an answer into a reviewable evidence trail:

- **Understand the claim** — break broad answers into atomic, checkable statements.
- **See the evidence** — compare supporting and challenging source passages.
- **Know what to do next** — surface missing evidence and a recommended follow-up query.

## Features

- Research mode for questions and hypotheses.
- Audit mode for pasted AI answers or reports.
- Deterministic demo mode with no API calls.
- Gemini-powered claim extraction, verification, and synthesis.
- Tavily Search and Tavily Extract evidence retrieval.
- Support, contradiction, partial, and insufficient verdicts.
- Confidence scores with visible heuristic factors.
- PASS, WARNING, and FAIL verification build results.
- Source-independence grouping and origin badges.
- Expandable reasoning and evidence details.
- Markdown and JSON proof-report exports.

## Tech stack

- [Next.js](https://nextjs.org/) App Router
- [React](https://react.dev/) and TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Gemini](https://ai.google.dev/) via `@google/genai`
- [Tavily Search and Extract](https://tavily.com/)
- [Zod](https://zod.dev/) for runtime validation
- [Lucide](https://lucide.dev/) for interface icons

## Getting started

### Prerequisites

- Node.js 20 or newer.
- A Gemini API key for live research and audit runs.
- A Tavily API key for live research and audit runs.

### Install

```bash
cd frontend
npm install
cp .env.example .env.local
```

Add keys to `frontend/.env.local`:

```env
GEMINI_API_KEY_PRIMARY=
GEMINI_API_KEY_SECONDARY=
GEMINI_MODEL=gemini-3.6-flash
TAVILY_API_KEY=
```

API keys are read by server-side route handlers and are never exposed to client components.

### Run locally

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The demo path works without API keys. Live Research and Audit runs require valid keys and network access.

## Workflows

### Research mode

Enter a research question or claim. The pipeline searches for context, extracts three atomic claims, retrieves evidence for each claim, verifies the supplied evidence, and synthesizes a concise report.

### Audit mode

Paste an AI-generated answer or report between 100 and 6,000 characters. VerityGraph extracts and verifies only claims found in the pasted text; it does not add claims from outside the answer.

### Demo mode

Select **See a demo** or **Load demo** to load deterministic sample results without making API calls.

## Verification pipeline

1. **Initial search** — gathers query context with Tavily Advanced Search. Audit mode skips this stage.
2. **Claim extraction** — Gemini extracts exactly three factual, check-worthy claims and search queries.
3. **Evidence search** — Tavily Basic Search retrieves support and challenge candidates.
4. **Focused extraction** — Tavily Extract reads selected source pages; snippets remain a fallback.
5. **Claim verification** — Gemini evaluates only supplied evidence and returns verdict, confidence, missing evidence, and a next-best query.
6. **Report synthesis** — Gemini writes a concise summary without introducing new facts.

## Verification build rules

Each claim receives a deterministic build status:

- **PASS** — supported, confidence at least 70%, and at least two independent evidence origins.
- **WARNING** — partial support, insufficient evidence above 30%, supported evidence with weak source independence, or supported confidence below 70%.
- **FAIL** — contradicted, or insufficient evidence with confidence at or below 30%.

The overall build fails when any claim fails. A warning without a failure produces a warning build. Otherwise, the build passes.

Confidence is a heuristic based on evidence agreement, source diversity, evidence basis, and deterministic caps. It is not a probability of truth.

## Source independence

VerityGraph keeps related sources visible while grouping likely duplicates:

- Canonicalizes URLs.
- Normalizes domains and titles.
- Groups near-duplicate titles with token Jaccard similarity of at least 0.72.
- Treats same-domain sources as one origin unless titles are clearly unrelated.
- Shows source counts, independent origins, duplicate groups, and origin badges.

## Exports

The current run can be downloaded from the result header:

- `veritygraph-proof-report.md`
- `veritygraph-proof-report.json`

Exports include the query, workflow mode, build result, synthesis, metrics, claims, confidence factors, source-independence data, missing evidence, recommended next searches, and source URLs.

## Project structure

```text
.
├── frontend/
│   ├── src/app/
│   │   ├── api/health/       # Health route
│   │   ├── api/research/     # Research and audit route handler
│   │   ├── globals.css       # VerityGraph design tokens and motion
│   │   └── page.tsx          # Landing page, verifier, and results UI
│   ├── src/lib/
│   │   ├── gemini.ts         # Gemini extraction, verification, synthesis
│   │   ├── research.ts       # Six-stage verification pipeline
│   │   ├── tavily.ts         # Tavily search and extraction helpers
│   │   └── types.ts          # Shared result contracts
│   └── package.json
├── docs/
│   └── superpowers/          # Design and implementation specifications
├── sample-data/
└── README.md
```

## Scripts

Run these from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |

## Limitations

- Full PDF parsing is not implemented.
- Confidence and source independence are deterministic heuristics, not a citation graph or probability model.
- Results are calculated on demand; there is no persistent history database.
- Verification depends on pages returned by Tavily Search and Extract.
- Outputs assist research workflows and do not replace expert review.

## Contributing

1. Create a focused branch.
2. Make the smallest change that improves the verification workflow.
3. Run `npm run lint`, `npm run build`, and `git diff --check` from `frontend/` or the repository root as appropriate.
4. Explain behavior changes and verification evidence in the pull request.

## License

No license file has been added yet. All rights remain with the repository owner until a license is published.
