# BrainGrow Architecture — AI Growth Operating System

Status document covering the repository audit (Phase 0), the implementation map, the
dependency-ordered roadmap, and the honest feature classification.

## 1. Stack inventory

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16.3.3 (App Router, Turbopack), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 (`@theme` OKLCH tokens), Radix primitives, lucide icons, framer-motion, recharts |
| Backend | Next.js Route Handlers under `src/app/api` |
| Database / ORM | Prisma 5 + SQLite (`prisma/dev.db`) |
| Auth | jose JWT (Bearer + httpOnly cookie, stale-bearer fallback), bcryptjs, Google OAuth (optional) |
| Validation | zod v4 |
| Runtime | Node; dev/build/start configured to port **8080** |
| Tests | Node `.mjs` API end-to-end scripts (`scripts/*.mjs`); no unit framework yet |

## 2. Module map

### AUTHENTICATION — IMPLEMENTED (solid)
`src/lib/auth-server.ts`, `src/app/api/auth/{register,login,logout,me,callback/google}`.
JWT signed HS256; accepted via `Authorization: Bearer` or httpOnly `token` cookie.
A failing Bearer token no longer masks a valid cookie (root-caused 401 fix). All
company-scoped routes call `requireAuth(request)` → 401.

### TENANT ISOLATION — IMPLEMENTED
`src/lib/tenant.ts` `assertMembership(userId, companyId, allowedRoles?)` → 403.
Every company route verifies membership before any query; scoping to `companyId`
is the convention. E2E tests verify IDOR (non-member → 403).

### WORKSPACE MODEL — IMPLEMENTED
User → `Membership` (role) → `Company` (profileType BUSINESS | CREATOR |
PERSONAL_BRAND | AGENCY). Workspace creation grants `role: "OWNER"`, creates the
appropriate profile (CompanyProfile / CreatorProfile), and auto-seeds demo data
(client-side in `company-context.tsx`, server endpoint `POST /api/companies/[id]/seed`).

### DATA MODEL — EXTENSIVE
40+ models in `prisma/schema.prisma`: content, calendar, approvals, media,
documents (+chunks), memory, brain sources (trends, competitors, contentDNA,
experiments), analytics (events, performanceMetrics, leads, conversions, ROI),
growth (opportunities, recommendations, nextBestActions), agents (runs, tasks,
toolCalls), model registry (Provider, Model), generation (jobs, assets),
business (goals, products, services, brandRules, audiences), creator (profile,
pillars, collaborations, brandDeals, monetizationChannels), system (auditLog,
notifications, messagingIdentity).

### ROLES & PERMISSIONS — IMPLEMENTED
`src/lib/rbac.ts`: roles OWNER/ADMIN/EDITOR/ANALYST/VIEWER, permission→role-level
map, `hasPermission`, `assertPermission(userId, companyId, permission)`.
Enforced on memory mutations (`memory.manage`), approval decisions
(`approval.manage`) and lead updates. Verified by e2e (VIEWER → 403).

### AI LAYER — IMPLEMENTED (dev adapters live; real providers optional)
- Provider adapters: `src/lib/providers/types.ts` + mock (DEV-labeled) +
  real HTTP adapters in `src/lib/providers/http.ts` (`openaiLLM`,
  `anthropicLLM`, `ProviderUnavailableError`, `fetchWithTimeout`, `estimateCost`).
- Registry + capability routing + policies: `src/lib/models/registry.ts`
  (now also `getAllModelsUnfiltered`, `getModelsForCapabilityAll`, `getModelById`).
- **Gateway:** `src/lib/ai/gateway.ts` `aiGenerate()` — rank candidates by policy,
  per-attempt retry, provider fallback (mock last), per-attempt AiUsage recording
  (modelId, provider, status, tokens, cost, latency). 503 when all exhausted.
- Usage model: `AiUsage` (+ indexes) migrated; generation jobs record `tokensUsed`.
- Wired end-to-end: `ai/chat`, `generation` (text), `agents/orchestrator` all route
  through the gateway.
- **Blocked (by external keys):** live OpenAI/Anthropic calls need
  `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`. Until set, the router falls back to the
  clearly-labeled mock adapter.

### BACKGROUND JOBS — IMPLEMENTED
`src/lib/jobs/processor.ts` `processGenerationJobs()`: claims QUEUED jobs,
reclaims stale RUNNING (5-min timeout), retries up to 3 attempts with backoff,
records attempts/tokens/cost, creates assets. Generation POST enqueues and
processes near-sync; `POST /api/jobs/process` (+ `scripts/worker.mjs` loop or
`npm run worker`) drains the whole queue outside the HTTP path. Auth: job
endpoint requires a member JWT or `x-worker-key` = `WORKER_KEY`.

### ANALYTICS / DASHBOARD — IMPLEMENTED
Dashboard home + analytics/content/audience/growth sub-pages read real,
tenant-scoped data (aggregate endpoint `GET /api/companies/[id]/dashboard`).
Seed generator (`src/lib/seed.ts`) creates demo data, idempotently.

### DESIGN SYSTEM — IMPLEMENTED
Full OKLCH token set with intentional light/dark (`globals.css`), typography
scale, focus visibility, reduced motion, bento grid, micro-interactions,
`ThemeProvider` + `ThemeToggle`. `Sidebar`/`Header` re-themed on tokens and all
fake data removed: workspace card now shows real company count + member role,
usage card shows real content count + AI calls/tokens/spend from a new
`GET /api/companies/[id]/usage` endpoint, approvals nav badge is the real pending
count, and notifications are real pending approvals.

### OBSERVABILITY — PARTIAL
`auditLog` exists. No structured logger, no AI/provider failure diagnostics.

## 3. Fake / placeholder data (must not remain)

- `Sidebar`: "6 Brands • Premium", "Enterprise Plan", "2,450 / 5,000" posts,
  "78,650 / 100,000" AI credits, nav badges `12` and `7`.
- `Header`: notification badge `3`, "3 New", three fake notifications
  ("5 Healthy Breakfast Ideas", "Behind the Scenes", "Industry Trends 2025"),
  "Super Admin" hardcode, fallback email `priyanshu@braingrow.ai`.
- These are cosmetic mock numbers — being replaced with real counts or removed.

## 4. Implementation map (quick classification)

| Module | Status |
| --- | --- |
| Auth (JWT+cookie, register/login/logout/me+patch, Google hook) | IMPLEMENTED |
| Tenant isolation (+tests) | IMPLEMENTED |
| Workspaces + profiles + auto-seed | IMPLEMENTED |
| Dashboard + sub-page analytics (real data) | IMPLEMENTED |
| Model registry + policies | IMPLEMENTED |
| Provider adapter *interfaces* + mock adapters | IMPLEMENTED |
| Company Brain retrieval + harness | IMPLEMENTED |
| Agent orchestrator scaffolding | PARTIALLY IMPLEMENTED (mock outputs) |
| Generation jobs lifecycle | PARTIALLY IMPLEMENTED (inline, no queue) |
| AI usage / cost tracking | MISSING |
| Model-router gateway (fallback/retry/health) | MISSING |
| Real OpenAI/Anthropic/fal adapters | MISSING (blocked: no keys) |
| RBAC permission map + enforcement | PARTIALLY IMPLEMENTED |
| Structured logging | MISSING |
| Brain/Memory UI (editable/inspectable) | MISSING (API exists) |
| Approvals UI | MISSING (API exists) |
| Calendar UI | MISSING (API exists) |
| Competitors UI | MISSING (API exists) |
| Leads API + UI | MISSING |
| Campaigns / Inbox / Social listening / CRM | NOT IMPLEMENTED (external APIs) |
| Creator commerce (deals, monetization, media kit) | API models exist; UI MISSING |
| AI Search/GEO, citations, market intel | NOT IMPLEMENTED |
| Dark/light theme on sidebar/header | NEEDS REFACTOR |
| Unit tests / CI | MISSING |

## 5. Roadmap (dependency order)

- **Phase 1 — Foundation:** AI gateway + usage tracking + real adapters; RBAC;
  structured logging; background job worker; de-fake UI; `.env.example`.
- **Phase 2 — Core Intelligence:** Brain/Memory manager UI; approvals; analytics
  agent; next-best-action execution.
- **Phase 3 — Content + Publishing:** AI Studio generator (strategy → content →
  quality score → draft → approval), adaptive calendar, repurposing.
- **Phase 4 — Engagement + Business:** Unified inbox, comment intelligence,
  suggested replies, social listening, leads/CRM/revenue (provider-abstracted).
- **Phase 5 — Campaign + Creator:** Campaign OS, creator CRM/discovery/matches,
  collaborations, brand deals, media kit, monetization dashboard.
- **Phase 6 — Advanced AI:** autonomy controls, experiments, predictive
  performance, growth simulator, crisis detection/response, growth memory.
- **Phase 7 — Advanced Intelligence:** AI Search/GEO, share of answer,
  citations, market intelligence, cross-platform graph, customer voice.

## 6. Security posture

- IDs: JWT signed HS256; `JWT_SECRET` from env; dev fallback only non-production.
- Server-enforced membership on every company route (401/403); no frontend-owned
  identifiers trusted.
- Prompt-injection sanitization + policy gating in harness.
- No secrets logged; audit log never stores passwords/tokens.
- AI actions gated by `requireApproval` workspace policy.
- Password hashing via bcrypt (cost 10).

## 7. Environment variables

See `.env.example`. `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `NODE_ENV`,
`NEXT_PUBLIC_APP_URL`, `LOG_LEVEL`, optional `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
Google OAuth keys, `LOCAL_STORAGE_PATH`.

## 8. Testing

API E2E scripts (all use a fresh random user and clean up afterwards):
- `scripts/auth-flow-test.mjs` — auth, stale-bearer fix, cookie correctness.
- `scripts/e2e-creator-flow.mjs` — creator workspace + profile flow.
- `scripts/e2e-dashboard-features.mjs` — dashboard full stack, isolation, AI chat.

Run: `PORT=8080 node scripts/<name>.mjs` with the server running on 8080.