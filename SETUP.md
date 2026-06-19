# AI Interviewer — Setup Guide

## What changed from the original

### Backend fixes
- **Replaced `@google/genai` (Gemini) with `groq-sdk`** — `result.ts` now uses Groq's `llama-3.3-70b-versatile` for feedback generation
- **Fixed `z.int()` → `z.number().int()`** — Zod v4 removed the `.int()` shorthand
- **Made `PROXY_URL` optional** in `scrapers/github.ts` — no crash if you don't have a proxy set up
- **Removed `zod-to-json-schema`** dependency (no longer needed)

### Frontend redesign
- Deep space dark theme (#08090d base) with animated grid background
- Electric cyan (#22d3ee) + indigo (#818cf8) accent palette — consistent with a dev aesthetic
- Monospace typography touches throughout (terminal bars, eyebrows, hints)
- Score ring on Results page (SVG circle with glow)
- Animated equalizer bars on Interview orbs
- Terminal window chrome (macOS dots) on Form and Interview pages

## Prerequisites

1. **Bun** ≥ 1.0 — `curl -fsSL https://bun.sh/install | bash`
2. **Node.js** ≥ 18 (Bun handles most things but some tools need Node)
3. **PostgreSQL** database (local or hosted — try Neon.tech for free)

## Quick start

```bash
# 1. Install dependencies from root
bun install

# 2. Set up backend env
cp apps/backend/.env.example apps/backend/.env
# → Fill in GROQ_API_KEY and OPENAI_KEY and DATABASE_URL

# 3. Generate Prisma client + run migrations
cd apps/backend
bunx prisma migrate dev
cd ../..

# 4. Run everything
bun run dev
```

Frontend runs on http://localhost:3000  
Backend runs on http://localhost:3001

## Environment variables

### apps/backend/.env
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `GROQ_API_KEY` | ✅ | From https://console.groq.com (free tier available) |
| `OPENAI_KEY` | ✅ | For WebRTC realtime voice sessions |
| `PROXY_URL` | ❌ | Only needed if GitHub API is blocked in your region |

### apps/frontend/.env
No env vars needed for local dev — backend URL is hardcoded to `http://localhost:3001`.

## VS Code tips
- Install the **ESLint** and **Prettier** extensions
- The repo uses **Bun** as package manager — don't run `npm install`
- Run `bun run dev` from the root to start both apps simultaneously via Turborepo
