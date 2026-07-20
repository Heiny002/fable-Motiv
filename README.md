# Motiv.ai

An AI goal coach that interviews you, builds a **Master Plan** with you, and then holds you to it — daily check-ins, streaks, milestone celebrations, and a coach personality you choose (Gentle Encourager → Drill Sergeant).

Mobile-first PWA built with Next.js 14, Supabase Postgres, and Claude (`claude-opus-4-8`).

## Features

- **Conversational goal creation** — the coach asks up to 10 need-to-know questions (one at a time), drafts a Master Plan using SMART/Power List techniques, revises it with your feedback, and stores it. The plan is a living document the coach updates as you progress.
- **Ongoing coaching chat** with streaming responses, long-term memory, and real awareness of your goals, plan progress, streak, and recent check-ins.
- **4 coach personalities** (gentle / supportive / challenging / drill sergeant) with an opt-in profanity toggle.
- **Multiple goals** with a designated focus goal.
- **Daily check-ins** — mood + note, personalized coach reply, streak tracking, and a scheduled push-notification reminder at your chosen hour.
- **Coach-drafted social posts** for Instagram / X / LinkedIn (copy or native share sheet).
- **PWA** — installable to a phone home screen, offline app shell, web push.

## Architecture

Single Next.js app (App Router). React pages + `/api/v1/*` routes in one deployable unit.

- **The Coach** (`lib/coach/`) — Claude with native tool use. Tools are the Coach→System command surface: `create_goal`, `set_master_plan`, `update_plan_item`, `update_goal`, `set_focus_goal`, `save_memory`.
- **The System** (`lib/data.ts`, `app/api/`) — persistence (Supabase Postgres via service-role key, RLS locked), auth (bcrypt + JWT httpOnly cookie), scheduling (Vercel Cron → web push).
- Works without an `ANTHROPIC_API_KEY` (template fallbacks + setup notice), but the conversational coach needs the key to be useful.

## Local development

```bash
cp .env.example .env   # fill in values (see comments in the file)
npm install
npm run dev            # http://localhost:3000
```

Required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`.
Optional: VAPID keys for push (`npx web-push generate-vapid-keys`), `CRON_SECRET`.

Database schema lives in Supabase (project `motiv-ai`); the initial migration is `initial_schema`.

## Deployment (Vercel)

The project deploys as a standard Next.js app. Set the env vars above in
Project → Settings → Environment Variables.

Check-in reminders are scheduled by **Supabase `pg_cron`** (job
`motiv-hourly-checkin-reminders`), which calls `GET /api/cron/checkins` hourly
with a `Bearer CRON_SECRET` header — the endpoint pings users whose local time
matches their chosen check-in hour. (Vercel's own cron is not used because
Hobby-plan crons are limited to daily runs.) The `CRON_SECRET` value in Vercel
must match the one in the pg_cron job definition.

> iOS note: web push requires the app to be installed to the Home Screen
> (Share → Add to Home Screen) on iOS 16.4+.

