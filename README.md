# Shule Management Suite

A responsive React + TypeScript + Vite starter for a Tanzania school-management platform. The UI is Swahili-first and designed to connect to the existing Supabase project.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the existing Supabase project's API settings.
5. Run `npm run dev`.

## Deploy to Vercel

Import this repository in Vercel. Set the same two environment variables in Project Settings → Environment Variables, then deploy. Vite build command: `npm run build`; output directory: `dist`.

## Important security notes

- Never put a Supabase `service_role` key in this frontend. Use only the public anon/publishable key.
- The existing database is not modified by this starter.
- Database read/write access and role-specific RLS policies must be safely reviewed and configured before enabling school data workflows.
- Do not expose student or parent information until authorization has been tested with separate school accounts.

## Current scope

Includes responsive navigation, login UI using Supabase Auth, dashboard shell, and module entry points for schools, students, teachers, classes, subjects, exams, results, fees, reports, and settings. The module data workflows are intentionally not enabled yet because the existing database permissions require verification.
