# Fantasy Dota 2

A Next.js fantasy esports application for building Dota 2 squads, tracking player performance, managing gameweeks, and competing in leagues.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Supabase

## Local Development

1. Install dependencies

   npm install

2. Create your local environment file

   Copy .env.local from the real project values or use the local keys already configured for this workspace.

3. Start the app

   npm run dev

4. Open the app in the browser

   http://localhost:3000

## Useful Commands

- npm run dev
- npm run build
- npm run lint
- npm test (runs the complete Jest unit and security suite)
- npm run test:e2e (runs the separate Playwright end-to-end suite)

## Environment Variables

Required local variables:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL (recommended; set to the canonical public origin used for authentication emails)

These should stay in .env.local and must not be committed to the repository.
The shared privileged server client requires SUPABASE_SERVICE_ROLE_KEY and fails explicitly if it is missing; it never falls back to the public anon key.
Add `${NEXT_PUBLIC_SITE_URL}/auth/callback` to the Supabase Auth URL configuration's allowed redirect URLs. For local development, also allow `http://localhost:3000/auth/callback`.

Professional data provider configuration:

- `NEXT_PUBLIC_DATA_PROVIDER` defaults to `opendota`, which is also explicitly configured as the Vercel production primary.
- STRATZ is the fallback when `ENABLE_PROVIDER_FALLBACK` is unset or not `false`; configure `STRATZ_API_KEY` to use that fallback.
- Tournament discovery, match ingestion, and match detail retrieval use STRATZ directly, independent of the global primary/fallback setting, so provider-specific league and match IDs stay consistent. `STRATZ_API_KEY` is required while those jobs are enabled.
- Match sync pages through STRATZ match records, live matches, and upcoming league-node fixtures. Scheduled fixture rows are reconciled to real match IDs by STRATZ series ID when match records appear; statuses are stored as `scheduled`, `in_progress`, and `completed`. Completed matches alone are sent through detail ingestion and fantasy scoring.
- Matches outside all configured gameweek windows are intentionally not imported; they are counted in a per-tournament summary instead of being reported as job errors. Matches that fall in overlapping gameweeks remain errors so the schedule can be corrected.
- Existing matches are updated by provider match ID; if provider IDs differ, a unique same-team match within 15 minutes of the existing scheduled time is updated instead. Ambiguous matches are skipped and reported rather than inserted as likely duplicates.
- STRATZ league records without a usable ID, name, or start date are skipped with a warning and are not written to the tournaments table.
- Tournament discovery and match sync are restricted to STRATZ professional, minor, major, international, and DPC league/qualifier tiers. Previously discovered non-professional tournament rows are left intact but excluded from match ingestion unless STRATZ reports them in an approved tier.
- STRATZ GraphQL query and mapping behavior has focused mocked-response coverage. Run the enabled jobs with the configured API key to validate live API access in the target environment.
- `/api/data/sync-status` reports the effective primary/fallback names and whether fallback is enabled; it never returns provider credentials.

## Project Structure

- app/src/app for route pages
- app/src/components for UI components
- app/src/lib for business logic and integrations
- app/src/types for shared TypeScript models

## Current Status

The app includes core fantasy functionality, backend job logic, scoring logic, captain and vice-captain handling, and gameweek simulation panels.

## Security Notes

- Never expose service role keys to the browser
- Keep .env.local out of source control
- Use deployment environment variables for production hosting

See SECURITY.md for the project security checklist.
