# Social Media Growth AI

AI-powered social media growth platform for businesses and creators, combining intelligent AI agents, content automation, audience intelligence, competitor war rooms, analytics, and adaptive growth strategies.

This repository is a **monorepo** containing two main components:

| Component | Description |
|-----------|-------------|
| [`brain-growth-dashboard/`](#braingrow-dashboard) | **BrainGrow** — AI social media growth operating system (Next.js web app) |
| [`freellmapi/`](#freellmapi) | **FreeLLMAPI** — free LLM API aggregator (OpenAI-compatible `/v1` endpoint) |

---

## BrainGrow Dashboard

An AI-powered social media growth operating system for businesses, creators, personal brands, and agencies. It combines intelligent AI agents, content automation, audience intelligence, competitor war rooms, analytics, and adaptive growth strategies into a single multi-tenant workspace.

### ✨ Key Features

- **Identity, Workspace & Governance** — JWT + httpOnly cookie auth, Google OAuth, multi-tenant company workspaces, team roles (OWNER / ADMIN / EDITOR / ANALYST / VIEWER), 12-permission RBAC, tenant isolation, audit logging
- **Content, Publishing & Calendar** — content library, content calendar, draft → approval → publish workflow, AI Studio content generation as async jobs, media library, content DNA, trend tracking, social account registry
- **AI Gateway & Model Router** — model registry with capability routing, provider policies, per-attempt retry and fallback, per-request usage/cost tracking
- **Competitor War Room** — threat scoring, topic gap radar, battlecards, counter-strategies, AI "why-winning" narratives
- **Adaptive Self-Improving Brain** — learning events, insight lifecycle (CANDIDATE → VALIDATED → ACTIVE), confidence scoring, memory fact layer that grounds every prompt
- **Analytics & Growth** — real performance metrics, audience analytics, leads & ROI, growth projections, next-best-action recommendations
- **AI Agents Console** — workflow triggers (content-generation / research / strategy / full-cycle) with phase-by-phase outputs and audit trails
- **Social Inbox** — message sentiment/intent classification with AI-suggested replies

### 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, Radix primitives, lucide icons, framer-motion, recharts |
| Backend | Next.js Route Handlers (`src/app/api`) |
| Database / ORM | Prisma 5 + SQLite (Postgres-ready) |
| Auth | jose JWT (Bearer + httpOnly cookie), bcryptjs, Google OAuth |
| Validation | zod v4 |
| Runtime | Node — dev/build/start on port **8080** |

### 🚀 Getting Started (BrainGrow)

```bash
cd brain-growth-dashboard
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

### 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | ✅ | Session signing secret — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `DATABASE_URL` | ✅ | `file:./dev.db` for SQLite, or a Postgres URL in production |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public app URL (e.g. `http://localhost:8080`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⬜ | For Google OAuth login |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | ⬜ | Real LLM providers (falls back to labeled mock adapter when absent) |

### 🧪 Testing (BrainGrow)

```bash
npm run test:auth       # auth flow (29/29)
npm run test:creator    # creator flow
npm run test:dashboard  # dashboard features (46/46)
npm run test:ops        # AI operations (43/43)
npm run test:brain      # brain + war room (48/48)
npm run worker          # background job worker
```

### ☁️ Deployment (BrainGrow → Vercel)

The app is Vercel-ready:

- **Database:** Postgres required (SQLite was replaced for serverless). Use a free hosted Postgres — [Neon](https://neon.tech), [Supabase](https://supabase.com), or Vercel Postgres — and set `DATABASE_URL`.
- **Build:** `vercel-build` script runs `prisma generate && prisma migrate deploy && next build` (see `vercel.json`).
- **Background jobs:** a Vercel Cron Job (`*/5 * * * *`) calls `/api/cron/process-jobs` to drain the generation queue. Set `CRON_SECRET` in the Vercel dashboard.
- **Storage:** media/documents are stored by URL reference, so no blob storage is required today. If you add real file uploads, use [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).

Required env vars in Vercel: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` (plus `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for OAuth).

---

## FreeLLMAPI

Aggregate free tiers from dozens of LLM providers — **7.4 billion tokens/month, 34 free providers, 635 free model endpoints** — behind a single OpenAI-compatible `/v1` endpoint. Keys are stored encrypted; a router picks the best available model, falls over to the next provider on rate limits, and tracks per-key usage to stay under free-tier caps.

### ✨ Key Features

- One OpenAI-compatible endpoint for chat, embeddings, image, and audio
- Automatic model catalog updates from a signed feed (no `git pull` needed)
- Provider fallback chain on rate limits / failures
- Encrypted API key storage
- Per-key usage tracking
- Web client, CLI, and Electron desktop app
- Docker / docker-compose self-hosting

### 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Express 5, TypeScript, zod, better-sqlite3 |
| Client | React + Vite, Tailwind, Redux Toolkit, recharts |
| CLI | Node CLI |
| Desktop | Electron |
| Runtime | Node ≥ 20.18, npm ≥ 10 |

### 🚀 Getting Started (FreeLLMAPI)

```bash
cd freellmapi
npm install
npm run dev
```

Runs the server + client together. See [`freellmapi/README.md`](freellmapi/README.md) and [`freellmapi/docs/install.md`](freellmapi/docs/install.md) for full setup, Docker, and deployment instructions.

### ☁️ Deployment (FreeLLMAPI → Render)

A [Render blueprint](freellmapi/render.yaml) is included — it deploys the existing `Dockerfile` as a web service with a persistent disk for the SQLite data at `/app/server/data`. Set `ENCRYPTION_KEY` (64-char hex) and your provider API keys in the Render dashboard.

---

## Repository Structure

```
├── brain-growth-dashboard/   # BrainGrow — AI social media growth OS (Next.js)
│   ├── prisma/               # Database schema & migrations
│   ├── src/app/              # App Router pages & API route handlers
│   ├── src/components/       # UI components
│   ├── src/lib/              # Auth, tenant, RBAC, AI gateway, brain, jobs
│   ├── scripts/              # E2E test scripts & worker
│   └── docs/                 # Architecture, feature matrix, reports
├── freellmapi/               # FreeLLMAPI — free LLM API aggregator
│   ├── server/               # Express API server
│   ├── client/               # React web client
│   ├── cli/                  # Node CLI
│   ├── desktop/              # Electron desktop app
│   ├── shared/               # Shared types
│   └── docs/                 # API, install, architecture docs
├── Image/                    # UI / design assets
└── Storage/                  # Media, backups, exports
```

## 📚 Documentation

- **BrainGrow:** [`docs/ARCHITECTURE.md`](brain-growth-dashboard/docs/ARCHITECTURE.md) · [`docs/FEATURE_MATRIX.md`](brain-growth-dashboard/docs/FEATURE_MATRIX.md) · [`docs/FINAL_REPORT.md`](brain-growth-dashboard/docs/FINAL_REPORT.md)
- **FreeLLMAPI:** [`freellmapi/docs/README.md`](freellmapi/docs/README.md) · [Install & deploy](freellmapi/docs/install.md) · [API reference](freellmapi/docs/api.md) · [Architecture](freellmapi/docs/architecture.md)

## 📄 License

See the individual component licenses — [`freellmapi/LICENSE`](freellmapi/LICENSE).
