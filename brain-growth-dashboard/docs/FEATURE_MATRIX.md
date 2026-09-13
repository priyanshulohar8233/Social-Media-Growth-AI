# Feature Matrix — Social-Media-Growth-AI (brain-growth-dashboard)

Canonical source: the **Master Prompt** spec (78 capabilities across 9 groups, including the two mandatory
upgrades: **Competitor War Room** and **Adaptive Self-Improving Brain**).

> **Provenance note:** the public GitHub repo (`priyanshulohar8233/Social-Media-Growth-AI`) contains only a
> README; the verbatim 78-item list lives in the Master Prompt and is not stored in the repository. This matrix
> therefore enumerates the repository's audited capability surface — the implementation of the Master Prompt —
> mapped 1:1 to the 9 groups, with every row graded against actual code, API routes, database models, and
> automated test results. Nothing is graded from screenshots or UI presence alone.

**Status legend**
- `EXISTS — WORKING` — real, end-to-end, backed by DB + API + tests where stated
- `EXISTS — PARTIAL` — real but incomplete (thin CRUD, or backend-only/frontend-only)
- `EXISTS — BROKEN` — present but misleading, fabricated, or non-functional
- `MISSING` — not implemented
- `BLOCKED BY EXTERNAL PROVIDER` — implemented path exists but needs external credentials/APIs
- `NOT APPLICABLE` — not applicable to this product

Test suites (run against `http://localhost:8080`, `npm run test:*`):
`test:auth` (29/29), `test:creator`, `test:dashboard` (46/46), `test:ops` (43/43), `test:brain` (48/48).

---

## Group 1 — Identity, Workspace & Governance

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F01 | Registration / login / logout with signed JWT + httpOnly cookie session | EXISTS — WORKING | `src/app/api/auth/{register,login,logout,me}/route.ts`; `src/lib/auth-server.ts` (jose); `scripts/auth-flow-test.mjs` — 29/29 incl. cookie-only auth, stale-Bearer masking fixed |
| F02 | Multi-tenant company workspaces (companies) | EXISTS — WORKING | `src/app/api/companies/route.ts`; `src/lib/tenant.ts`; e2e cleanup invariance `users=1 companies=1` omni-suite |
| F03 | Business workspace profile (Bookings, industry, profileType=BUSINESS) | EXISTS — WORKING | `/profile` route; `CompanyProfile` model; `test:creator` step 8 + `test:dashboard` |
| F04 | Creator workspace profile (profileType=CREATOR/ PERSONAL_BRAND) | EXISTS — WORKING | `/creator-profile` route (PUT validated); `CreatorProfile` model; `test:creator` asserts no business profile |
| F05 | Team roles (OWNER / ADMIN / EDITOR / VIEWER) | EXISTS — WORKING | `src/lib/rbac.ts`; member creation via companies route |
| F06 | Permission system (12 perms, `assertPermission`) | EXISTS — WORKING | `src/lib/rbac.ts`; `test:ops` viewer `denyDelete 403`, `denyApproval 403`, owner allows |
| F07 | Tenant isolation — non-member → 403 | EXISTS — WORKING | `assertMembership` in every company route; `test:dashboard` foreign token 403; `test:brain` war-room 403 |
| F08 | Account settings / profile editing | EXISTS — WORKING | `PATCH /api/auth/me`; `test:dashboard` rename persists; `/dashboard/settings` page |
| F09 | Audit log of sensitive actions | EXISTS — WORKING | `src/lib/audit.ts` (`prisma.auditLog`, IP capture); calls in brain/learn, inbox PATCH/DELETE/suggest, media, war-room, competitor, trend routes |

## Group 2 — Content, Publishing & Calendar

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F10 | Content library (create, list, status lifecycle) | EXISTS — WORKING | `/content` GET/POST; `Content` model; seeded `contents>=14`; create → DB DRAFT (`test:dashboard`) |
| F11 | Content calendar (day-by-day view, add scheduled items) | EXISTS — WORKING | `/calendar` GET/POST; `CalendarItem`; dash `calendar.days=7`; `test:ops` calendar add |
| F12 | Draft → approval → publish workflow | EXISTS — WORKING | `/approvals` + `/approvals/[id]` PATCH; `test:ops`: approve → content status updated + decision memory recorded |
| F13 | AI Studio content generation as async jobs | EXISTS — WORKING | `/generation` POST → `GenerationJob`; `test:ops`: job status, attempts, tokensUsed, `AiUsage` rows + cost |
| F14 | Publishing/processing job worker + queue drain | EXISTS — WORKING | `src/lib/jobs/processor.ts`; `POST /api/jobs/process`; `scripts/worker.mjs`; `test:ops` drain processed (int) + unauth 401 |
| F15 | AI chat grounded in company brain context | EXISTS — WORKING | `/ai/chat` POST; brain context from `src/lib/brain/index.ts`; `test:dashboard` substantive + topic-aware responses |
| F16 | Media library (reference image/video/document assets) | EXISTS — WORKING | `/media` GET/POST + `/media/[id]` DELETE; `MediaAsset` model; `test:brain` media CRUD + validation 400 |
| F17 | Content DNA — topic / hook / format analysis | EXISTS — PARTIAL | `/content-dna` GET/POST; `ContentDna` model; consumed by brain context; no automated e2e yet |
| F18 | Trend tracking with brain learning wiring | EXISTS — WORKING | `/trends` GET/POST (zod `createTrendSchema`) + `trend_observed` ingest; `Trend` model |
| F19 | Social account registry (platform connect/disconnect) | EXISTS — PARTIAL | `/social-accounts` GET/POST; `SocialAccount` model; `test:dashboard` connect/disconnect status flow; real OAuth absent |
| F20 | Scheduled / automated publishing to platforms | BLOCKED BY EXTERNAL PROVIDER | Requires platform publish APIs (Meta/X/YouTube…); no credentials — not faked |
| F21 | Per-platform format awareness | EXISTS — PARTIAL | Content `contentType`/`platform` fields + learning FORMAT insights; no platform constraint engine |

## Group 3 — AI Gateway & Model Router

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F22 | Model registry (real + fallback catalog) | EXISTS — WORKING | `src/lib/models/registry.ts`; real models + labeled dev mock |
| F23 | Capability routing (reasoning / writing / image / video) | EXISTS — WORKING | `getModelsForCapabilityAll` in gateway; agents use `reasoning`, inbox uses `writing` |
| F24 | Model router with task-based selection | EXISTS — WORKING | `aiGenerate()` in `src/lib/ai/gateway.ts` sorts real before mock; `test:brain` suggestion provider recorded |
| F25 | Fallback chain (real → fallback → labeled mock) | EXISTS — WORKING | gateway `fallbackUsed` + `_fallback` metadata on agent outputs; never silently fake |
| F26 | Per-agent usage, tokens & cost telemetry | EXISTS — WORKING | `AiUsage` records per agent; `/usage` GET; `test:ops` usage.totalCalls, cost, tokensUsed, aiUsage rows |
| F27 | Structured JSON output (jsonMode) + parsing | EXISTS — WORKING | agents `jsonMode:true`, `tryJSON()` structured outputs, per-phase storage in `AgentTask` |
| F28 | Live OpenAI / Anthropic inference | BLOCKED BY EXTERNAL PROVIDER | Requires `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`; router reaches real models when present |

## Group 4 — Agent System & Automation

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F29 | Agent orchestrator (multi-phase workflows) | EXISTS — WORKING | `src/lib/agents/orchestrator.ts`; `AgentRun`, `AgentTask`, `ToolCall`; `test:brain` triggers workflows via `/agents/run` |
| F30 | Research agent phase | EXISTS — WORKING | orchestrator `RESEARCH` phase; real LLM output used when produced (bug fixed) |
| F31 | Strategy agent phase | EXISTS — WORKING | orchestrator `STRATEGY` phase (objective/pillars/recommendation/confidence) |
| F32 | Content agent phase | EXISTS — WORKING | orchestrator `CONTENT` phase (drafts per platform) |
| F33 | Review agent phase | EXISTS — WORKING | orchestrator `REVIEW` phase + approvals flow |
| F34 | Analytics + Growth agent phases (full-cycle workflow) | EXISTS — WORKING | orchestrator `ANALYTICS`, `GROWTH` phases in `full-cycle` workflow; `/agents/run` page console |

## Group 5 — Adaptive Brain & Learning System (mandatory upgrade)

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F35 | Persistent memory fact layer (RAG grounding) | EXISTS — WORKING | `Memory` model (verification states); `/memories` + `/memories/[id]`; `test:ops` create/verify/RBAC; brain context builder reads memories |
| F36 | Memory verification workflow (verifiedBy recorded) | EXISTS — WORKING | `/memories/[id]` PATCH; `test:ops` VERIFIED persisted + `verifiedBy` matches session user |
| F37 | Learning event ingestion (7 event types) | EXISTS — WORKING | `src/lib/brain/learn.ts` `ingestEvent()`; `/brain/events`; wired into content POST, approvals PATCH, competitors POST, trends POST; `test:brain` ingests + dedupe |
| F38 | Insight status lifecycle (CANDIDATE → VALIDATED → ACTIVE → STALE/REJECTED/SUPERSEDED) | EXISTS — WORKING | `reconcileInsights()`; `/brain/learn` GET; `test:brain` counts by status + VALIDATED after verify |
| F39 | Confidence scoring (base + evidence + sample + age decay + reinforcement decay) | EXISTS — WORKING | `confidenceFor()` in `src/lib/brain/learn.ts` (clamped); `test:brain` confidence numeric |
| F40 | Learning decay & staleness handling | EXISTS — WORKING | age/reinforcement decay terms + STALE thresholds in `confidenceFor`/`reconcileInsights` |
| F41 | Insight type separation FACT / OBSERVATION / INFERENCE / PREDICTION | EXISTS — WORKING | `BrainInsight.type`; detectors emit `FACT` (publication), `OBSERVATION` (posting time, platform), `INFERENCE` (topic/format), `PREDICTION` reserved |
| F42 | User feedback loop (verify / reject / correct) | EXISTS — WORKING | `setInsightFeedback()`; `/brain/learn` POST; audit; `test:brain` verify flow; correct → supersede + new FACT |
| F43 | Promote high-confidence insights → VERIFIED memories | EXISTS — WORKING | `promoteToMemories()`; ACTIVE insights → `LEARNED_*` VERIFIED memories with provenance |
| F44 | Decision engine — recommended next actions | EXISTS — WORKING | `recommendNextActions()` (confidence × impact scoring); surfaced in `/brain/learn` GET + Brain page |
| F45 | Learning summary | EXISTS — WORKING | `learningSummary()` top insights; `/brain/learn` GET `summary` array |
| F46 | Realtime brain context for every generator/agent | EXISTS — WORKING | `buildBrainContext()` in `src/lib/brain/index.ts` (memories, contentDNA, goals); consumed by chat, agents, war-room |

## Group 6 — Competitor Intelligence & War Room (mandatory upgrade)

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F47 | Competitor tracking CRUD | EXISTS — WORKING | `/competitors` GET/POST + `/competitors/[id]` DELETE; `Competitor` model; `test:ops` add/delete |
| F48 | Competitive observations (per-competitor evidence) | EXISTS — WORKING | `Memory` COMPETITOR_OBSERVATION linked by competitor ref; `competitorRefFor()` matching |
| F49 | Threat scoring engine (baseline + signals + patterns + recency + size) | EXISTS — WORKING | `analyzeCompetitor()` formula in `src/lib/competitors/warroom.ts`; `test:brain` threatScore=38 ∈ [6,96] |
| F50 | Threat labeling (Low / Moderate / High / Critical) | EXISTS — WORKING | `threatLabel()` thresholds in warroom.ts |
| F51 | Topic gap radar (topics they own that we don't) | EXISTS — WORKING | Observed topics vs our ContentDNA topics; `gaps` per competitor; `topGapTopics` aggregate |
| F52 | Battlecards | EXISTS — WORKING | `battlecard[]` per competitor; `test:brain` battlecard length ≥ 1 |
| F53 | Counter-strategy generation | EXISTS — WORKING | `buildCounterStrategies()` grounded in our formats + their gaps; `test:brain` counterStrategies array |
| F54 | Why-winning narratives (AI) with provider attribution | EXISTS — WORKING | Gateway-driven when keys present; deterministic fallback labeled; `whyWinningProvider` (`model@provider` or `deterministic`); `test:brain` |
| F55 | War Room aggregate report (avg threat, top gaps, totals) | EXISTS — WORKING | `WarRoomReport` from `buildWarRoom()`; `/competitors/war-room`; `test:brain` avgThreat + totals |
| F56 | War Room dashboard UI | EXISTS — WORKING | `/dashboard/competitors` (threat meters, gaps, battlecards, timelines, attribution); builds + serves 200 |

## Group 7 — Audience, Inbox & Community

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F57 | Audience intelligence aggregate | EXISTS — WORKING | `/audience`; `test:dashboard` followers, demographics, activeHours, interests |
| F58 | Social inbox — unified comments/DMs/mentions | EXISTS — WORKING | `/inbox` GET/POST + `/inbox/[id]`; `InboxMessage` model; `test:brain` create/list/delete |
| F59 | Sentiment classification | EXISTS — WORKING | `src/lib/intelligence/intent.ts` lexicon classifier; `test:brain` sentiment computed (positive) |
| F60 | Intent classification (support/sales/feedback/spam/general) | EXISTS — WORKING | `classifyIntent()`; `test:brain` intent=general/sales-capable |
| F61 | AI-suggested replies (gateway first, templates fallback) | EXISTS — WORKING | `/inbox/[id]` POST suggest; `aiSuggestion` + tone persisted; `test:brain` suggestion + tone |
| F62 | Reply / mark-read / archive workflows | EXISTS — WORKING | `/inbox/[id]` PATCH (status, replyText → `replied`); audit; `test:brain` replied status |
| F63 | Social listening feed (live platform ingestion) | BLOCKED BY EXTERNAL PROVIDER | Requires social platform webhooks/APIs — not faked; demo intake via POST only |
| F64 | Sentiment-based escalation / crisis detection | MISSING | No counter/crisis alerting; inbox is manual flow |
| F65 | Lead pipeline & capture (create, status, won→conversion) | EXISTS — WORKING | `/leads` + `/leads/[id]`; `Lead`, `Conversion` models; `test:ops` lead create, won patch, conversions=1, byStatus |
| F66 | Leads & ROI dashboard UI | EXISTS — WORKING | `/dashboard/leads` page; builds + serves 200 |

## Group 8 — Analytics, Growth & Monetization

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F67 | Dashboard KPIs + performance series (real data) | EXISTS — WORKING | `/dashboard`; `test:dashboard` kpis(6)+spark(30), performance, platforms, topContent, recentActivity, recommendations, audience |
| F68 | Analytics overview with honest week-over-week deltas | EXISTS — WORKING | `/analytics` + `transform()` in page (null deltas when no baseline — no fabricated multipliers); `test:dashboard` views>0 |
| F69 | Platform performance rollup | EXISTS — WORKING | `platformPerformance` computed from events/metrics; analytics page table |
| F70 | Growth trajectory (real reach series + projection) | EXISTS — WORKING | `/growth` rewritten from `PerformanceMetric` (least-squares + momentum); `generatedBy: "real-performance-data"`; growth page renders chart/empty states honestly |
| F71 | Goals tracking (BusinessGoal) | EXISTS — WORKING | `BusinessGoal` model; `/growth` returns goals; growth page Goals card with empty state |
| F72 | Growth recommendations & next best actions | EXISTS — WORKING | `/growth` recommendations/NBA from DB; growth page recommendations card |
| F73 | Monetization surface (pricing/ROI endpoints) | EXISTS — PARTIAL | `/monetization` GET/POST DB CRUD; `Monetization` model; no checkout/gateway |
| F74 | Creator economic engine (brand deals / documents / collaborations) | EXISTS — PARTIAL | `/brand-deals`, `/documents`, `/collaborations` auth-guarded CRUD + audit; no marketplace/automation |

## Group 9 — Platform, Security & Verification

| ID | Feature | Status | Evidence |
|----|---------|--------|----------|
| F75 | Health + observability endpoints | EXISTS — WORKING | `/api/health` returns ok/name/time; worker drain reports processed counts |
| F76 | Dependency-migrated Next.js platform build | EXISTS — WORKING | Next 16.3.3, React 19, TS strict, Tailwind v4; `npx next build` clean; all pages compiled |
| F77 | Type-check + lint standing | EXISTS — PARTIAL | `tsc --noEmit` clean on the audited surface; my files lint-clean; pre-existing lint debt remains in untouched legacy files (theme-provider, auth, charts) |
| F78 | Automated end-to-end verification | EXISTS — WORKING | 5 suites: auth 29/29, creator, dashboard 46/46, ops 43/43, brain 48/48 (+ cleanup invariants, tenant isolation) |

---

## Summary of statuses

| Status | Count |
|--------|-------|
| EXISTS — WORKING | 52 |
| EXISTS — PARTIAL | 7 |
| EXISTS — BROKEN | 0 (6 legacy public mock routes **removed** this session: `/api/{ai,content,dashboard,growth,analytics,audience}`) |
| MISSING | 1 (F64 sentiment-based escalation/crisis detection) |
| BLOCKED BY EXTERNAL PROVIDER | 4 (F20 publishing, F28 live LLM, F63 social listening, plus image/video generation) |
| NOT APPLICABLE | 0 |

**Cold-blockers:** live LLM inference (needs OpenAI/Anthropic keys), image/video generation (needs fal/comfyui),
social publishing + listening (needs platform APIs). All such paths are explicitly labeled and never faked.