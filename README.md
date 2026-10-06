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

These should stay in .env.local and must not be committed to the repository.

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
