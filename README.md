# Dota 2 Fantasy League - Web App

The web app is the full-featured platform for playing fantasy Dota 2. Build a roster of professional players, manage your team through gameweeks, compete in leagues, and follow player and tournament data.

For the complete product and implementation details, see the [Web App description](<../Documents/Web App/App Description/APP_DESCRIPTION.md>).

## What you can do

- **Manage a fantasy team:** pick players within your budget, set your lineup and captain, make transfers, and use gameweek chips.
- **Compete:** join or create leagues, follow standings and rankings, and compare your results with other managers.
- **Follow Dota 2:** explore tournaments, teams, players, fixtures, and match results, with fantasy points calculated from professional match data.
- **Track performance:** review your dashboard, gameweek scores, player statistics, rankings, and other fantasy insights.
- **Stay up to date:** receive in-app updates and notifications about deadlines, player availability, price changes, and rank changes.
- **Use the support and community features:** access account and help pages, report issues, and participate in available social features.
- **Operate the platform:** authorized administrators have tools for managing data, jobs, users, and operational activity.

## Technology and security

- Next.js 16, React 19, TypeScript, and Tailwind CSS.
- Supabase provides PostgreSQL storage, authentication, and row-level security.
- Dota 2 data is integrated from external providers, including OpenDota and STRATZ.
- Server-side API routes and scheduled jobs handle protected operations and data processing.

Keep Supabase service-role credentials and other private provider keys on the server. Never expose them in browser code or commit them to the repository. The public Supabase anon key is intended for client use with the project's row-level security policies in place.

## Run locally

Use a supported Node.js version and npm. From this directory:

```bash
npm ci
npm run dev
```

Create `.env.local` in this directory and configure the Supabase variables used by the app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Add provider variables such as `STRATZ_API_KEY` when needed for the data features you are running. Keep service-role and provider keys server-side; never expose or commit them.

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Jest test suite |
| `npm run test:e2e` | Run the Playwright end-to-end tests |

## Project layout

- `src/app/` — pages, layouts, and API routes
- `src/components/` — shared and page-specific UI
- `src/lib/` — application services, data access, and business logic
- `public/` — static assets

See the [full Web App description](<../Documents/Web App/App Description/APP_DESCRIPTION.md>) for the detailed feature set, scoring and league rules, integrations, data models, and administration tools.
