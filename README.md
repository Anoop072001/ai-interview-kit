# AI Interview Prep Kit

Turns a pasted job description + company URL into a structured interview prep kit — company brief, role breakdown, categorized question bank, flashcards, and a day-by-day schedule — built through a sequenced retrieval → extraction → generation → coverage-check pipeline.

**Status: backend complete, frontend in progress.** This README covers what's built so far; sections that depend on the frontend/deployment are marked accordingly and will be filled in as that work lands.

## Tech stack

- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB (Mongoose)
- **Frontend:** Next.js + Tailwind CSS (in progress)
- **LLM:** OpenAI (see "Known limitations" — this is a deliberate deviation from the brief's "genuine free tier" requirement, mitigated by a provider-agnostic interface)
- **Search:** Tavily (public discussion of a company's interview process)
- **Monorepo:** npm workspaces (`apps/api`, `apps/web`, `packages/shared`)

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env   # fill in the values described below
npm run dev:api                          # starts the Express API on :4000
```

Requires a running MongoDB instance — `MONGODB_URI` in `.env` can point at a local `mongod`, a local Docker container, or an Atlas free-tier cluster.

### Environment variables (`apps/api/.env.example`)

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Signs the session cookie |
| `LLM_PROVIDER` | `openai` (current) or `gemini` (free-tier stub — see below) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI credentials/model |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini credentials/model, if `LLM_PROVIDER=gemini` |
| `TAVILY_API_KEY` | Public-discussion search |
| `USE_JEV_CLASSIFIER`, `JEV_API_KEY` | Optional page classifier upgrade — see below, never required |
| `ALLOW_LOCAL_HOSTS` | SSRF guard override for local dev; the batch CLI always allows local hosts regardless of this flag (see Section 9 of the brief) |
| `MAX_CRAWL_PAGES`, `MAX_COVERAGE_PASSES`, `BATCH_CONCURRENCY` | Pipeline tuning |

### Batch entry point

```bash
npm run evaluate -- --input cases.json --output kits.json
```

Runs from a clean clone with only `npm install` + a filled-in `.env`. Reuses the exact same pipeline code (`apps/api/src/pipeline/orchestrator.ts`) the HTTP API calls — not a parallel implementation. Company sites for this command may be served from `localhost` (the SSRF guard is bypassed only here and in local dev, never for the deployed app handling real user submissions).

## Architecture

```
apps/api/src/
  auth/        registration/login/logout, session middleware
  retrieval/   URL validation (SSRF guard), robots.txt, page fetching, HTML cleaning,
               site crawling, page classification, public-discussion search
  llm/         provider-agnostic client (OpenAI now, Gemini stub) + JSON-schema validation/repair
  pipeline/    the sequenced steps (extraction, brief, questions, flashcards, coverage,
               schedule) + the orchestrator that sequences them + section regeneration
  kits/        REST routes, per-item edit/reorder service, practice-mode ordering
  models/      Mongoose schemas (User, Kit)
  batch/       the `evaluate` CLI entry point
packages/shared/   the Appendix A kit shape + Appendix B batch shape as zod schemas (single
                    source of truth, imported by both the API and — later — the frontend)
```

### Retrieval approach and sources used

- **Company site crawling** (`retrieval/siteCrawler.ts`): fetches the homepage, extracts same-origin links, and ranks them by keyword heuristics on the URL and anchor text (`career`, `jobs`, `hiring`, `about`, `team`, `interview`, etc. — see `LINK_KEYWORDS`). No hardcoded path list. Fetches the top-ranked candidates, classifies each as a hiring page or not, and follows one more level from whichever page looks most like the hiring page (careers index pages often link one hop deeper to the actual process/handbook page). Bounded by `MAX_CRAWL_PAGES` total fetches.
- **Public discussion of the interview process** (`retrieval/publicDiscovery.ts`): a Tavily search for `"<company> interview process questions experience"`, which returns already-cleaned content snippets from wherever is publicly indexed (Glassdoor/Blind/Reddit-style sources included). Finding nothing is treated as a valid, honestly-reported outcome, not an error.
- Both respect `robots.txt` (`retrieval/robots.ts`), rate-limit per origin, retry with backoff on 429/5xx, and are capped on content-type and size (`retrieval/fetchPage.ts`).

### Sequencing — what each step is responsible for

1. **Extract requirements** (`pipeline/steps/extractRequirements.ts`) — pure text, no retrieval. One LLM call against the pasted JD only.
2. **Crawl the company site** — independent of the JD; an unreachable/broken site does not fail the run, it just produces a thinner, honestly-labeled brief.
3. **Search public discussion** — independent of both of the above.
4. **Analyze hiring-process signal** (`pipeline/steps/analyzeHiringProcess.ts`) — deterministic keyword detection over whatever was crawled/found (take-home? system-design round? phone screen?). This is what makes a company that publishes a detailed process produce a different kit from one that says nothing: it gates whether a `system-design` question category gets generated at all, and feeds its notes into that category's prompt.
5. **Generate the company brief** — from crawled pages + discussion snippets, grounded-only (see "Edge cases").
6. **Generate questions per (requirement-cluster, category)** (`pipeline/steps/generateQuestions.ts`, `pipeline/categoryMapping.ts`) — never one mega-prompt. Technical requirements get technical-interview prompts, behavioural requirements get STAR-style behavioural prompts, domain requirements get company-fit prompts, and (only when step 4 found evidence for it) a subset of must-have technical requirements gets system-design questions grounded in the actual hiring-process notes.
7. **Check coverage** (`pipeline/steps/checkCoverage.ts`) — **deterministic, no LLM**: a set difference between every requirement id and the union of ids referenced by generated questions.
8. **Gap-fill loop** — targeted regeneration only for the specific uncovered requirements (must-priority first), re-checking after each pass, capped at `MAX_COVERAGE_PASSES` (default 3). Anything still uncovered after that is recorded honestly in `coverage.uncovered_requirement_ids` rather than forced.
9. **Generate flashcards** — derived from the finalized requirement set.
10. **Build the schedule** (`pipeline/steps/buildSchedule.ts`) — **deterministic, no LLM**: sorts must-priority/harder questions to the front, chunks them into contiguous front-loaded blocks across exactly the requested number of days. If there are more days than content (e.g. a 60-day request), trailing days become spaced-review passes over the must-have material rather than being left empty.

Steps 7 and 10 are explicitly kept out of the model's hands per the brief — they're pure functions, unit tested (`apps/api/tests/checkCoverage.test.ts`, `buildSchedule.test.ts`).

### Coverage passes

Capped at 3 total (1 initial generation + up to 2 gap-fill passes), configurable via `MAX_COVERAGE_PASSES`. In practice most kits close all gaps in the first gap-fill pass; the cap exists so a pathological case (e.g. a requirement the model consistently can't phrase a question for) can't loop indefinitely against a rate-limited provider. Whatever remains uncovered after the cap is reported honestly, never fabricated.

### State model — generated / edited / pinned

The hardest state problem in the brief: regenerating one section must not discard edits made elsewhere, and a hand-written/hand-edited question or flashcard must survive a regeneration of its own category.

Every question and flashcard carries a `state: "generated" | "edited" | "pinned"` field — an allowed extension of the Appendix A structure (field names/required fields are unchanged; this is additive). Hand-added items start `pinned`; editing a `generated` item marks it `edited`; editing a `pinned` item leaves it `pinned`. Regenerating a category (`pipeline/regenerate.ts`) only ever replaces items still in `generated` state for that category's requirements — `edited`/`pinned` items, and everything in other categories, are left untouched and simply merged back into the result. The company brief and schedule are singular objects rather than itemized lists, so regenerating those is a full, expected replacement (the user explicitly asked for it) — the protection matters specifically at the per-item level for questions/flashcards.

### Practice mode ordering

A confidence-weighted sort (Section 7 explicitly allows this over a full spaced-repetition interval): the next session orders flashcards by their most recent confidence rating, ascending, with never-attempted cards treated as *less* confident than a rating of 1 — "not yet covered" is a stronger signal to practice next than "rated low once." See `kits/practiceService.ts`. A proper spaced-repetition scheduler (interval growth per card) would be the natural upgrade path if this needed to get more precise.

### Duplicate submissions

`(userId, jd, company_url)` is hashed on kit creation; a duplicate returns the existing kit rather than re-running the pipeline.

### Generation lifecycle / failure handling

Generation runs in-process (no external queue — not reliable on free-tier hosting) and persists progress after every pipeline step to `Kit.generation.steps`, polled via `GET /kits/:id/status`. A failure partway through a step is caught at that step's boundary; most steps degrade gracefully (an unreachable company site → thinner brief, not a failed run) rather than aborting. Only a failure to extract requirements at all — the one input every other step depends on — fails the whole kit, because at that point there is nothing meaningful left to build.

## Known limitations

- **LLM provider (OpenAI) does not have an ongoing free tier**, contrary to the brief's "genuine free tier" requirement — this was a deliberate choice made with an existing funded credit balance in mind. The LLM client is behind a provider-agnostic interface (`llm/client.ts`, `llm/providers/`) specifically so this is a one-file + one-env-var swap to the working Gemini free-tier implementation already included (`LLM_PROVIDER=gemini`), not a rewrite, if a genuinely free run is needed.
- **Jev AI page classifier is optional and best-effort.** It's a newly released (Sept 2026), non-free model; it is never load-bearing — `USE_JEV_CLASSIFIER` defaults off, and any failure (missing key, bad response, timeout) falls straight back to the zero-cost heuristic classifier that the crawler actually depends on.
- Company-site crawling goes two levels deep from the homepage, capped at `MAX_CRAWL_PAGES` total fetches — deep enough to reliably find a careers page and one hop past it (e.g. a linked hiring-process/handbook page), bounded to stay well inside the batch command's 15-minute budget for 5 cases.

## Edge cases (Section 10)

| Case | Behaviour |
|---|---|
| Invalid/404/timeout company URL | Crawl step fails independently; kit still generates from the JD alone with an honest, sparse company brief |
| No discoverable hiring page | `source.pages_used` reflects only what was actually found; no hiring-page content is fabricated |
| Thin/two-line JD | Extraction returns however few requirements are actually grounded in the text — the prompt explicitly forbids padding |
| No public discussion found | `company_brief`/questions proceed without it; recorded as "not searched successfully" or "no results," never invented |
| Invalid/incomplete LLM JSON | One repair retry with the validation error fed back to the model; a second failure surfaces as a structured step failure, not a malformed save |
| LLM rate-limited / transient failure | Exponential backoff with jitter on every outbound LLM/search/fetch call (`utils/retry.ts`), respecting `Retry-After` when present |
| Duplicate submission | Returns the existing kit instead of regenerating |
| 1-day / 60-day schedule | 1 day packs everything into a single (larger) day; 60 days fills content days first, then spaced-review days over the must-have material — never an empty or fabricated day |

## Testing

```bash
npm run test --workspace apps/api
```

Covers the schedule allocator, the coverage checker, Appendix A structure validation, and the generated/edited/pinned merge logic on the edit service — the behaviours Section 14 calls out as most worth protecting.
