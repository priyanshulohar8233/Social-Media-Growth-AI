This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## BrainGrow — AI Growth Operating System

Multi-tenant AI social-media OS: Company Brain + adaptive learning, Competitor War
Room (+ GEO share-of-voice), agent workflows, approvals, inbox with crisis alerts,
media library, MCP tools, and full e2e coverage. Details: `docs/ARCHITECTURE.md`,
`docs/FEATURE_MATRIX.md`, `docs/BENCHMARKS.md`, `docs/FINAL_REPORT.md`.

## Local Postgres (only database — SQLite was removed 2026-10-03)

> **2026-10-03 update: fully online.** The local portable server was removed.
> The single database is the hosted Neon Postgres (`braingrow` database, separate
> from other projects on the same cluster). `DATABASE_URL`, `JWT_SECRET`,
> `ENCRYPTION_SECRET`, `CRON_SECRET` and OAuth keys live **only in Vercel env**
> — nothing secret is stored in local files. Local runs need these exported
> explicitly; e2e suites accept `BASE_URL` + `PROTECTION_BYPASS` to run against
> the live deployment.

- Engine history: portable PostgreSQL 16.8 was used only as a migration bridge.
- Migrations: `prisma/migrations/` (init + delta) apply via `vercel-build`.
- To run anything locally: export `DATABASE_URL` (from Vercel env pull) explicitly;
  never commit it.

## Going hosted (Vercel Postgres / Neon / Supabase)

1. Create a hosted Postgres and copy its URL.
2. Local: paste it as `DATABASE_URL` in `.env`, then `npm run db:migrate`.
3. Vercel: set the same `DATABASE_URL` env var (Production) and redeploy —
   `vercel-build` runs `migrate deploy` automatically. Zero code changes needed.

## 30-60-90 roadmap (from the improvement plan)

- **Done (this round):** FreeLLMAPI gateway wiring verified, CRON-guarded job drain,
  extended health, auth rate limits, Vitest unit suite (45/45), GEO tracker fused
  into the War Room, eval harness + BENCHMARKS.md, MCP tools, predictive growth
  score, inbox crisis alerts + auto-draft, usage saved-$ metric.
- **Next 30:** Postgres + pgvector cutover (needs a server), 2-platform official
  OAuth, GEO v1 hardening, refresh-token rotation.
- **Next 60:** Video repurposing, white-label agency surfaces, inbox LLM classifier
  upgrade (lexicon → gateway-routed).
- **Next 90:** SOC2-ready audit trail review, public demo with real provider keys.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
