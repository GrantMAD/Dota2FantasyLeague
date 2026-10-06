# Job Tests

The project uses Jest for unit and API-route tests. The root Jest configuration
discovers `*.test.ts` and `*.security.spec.ts` files across `src/`.

## Run tests

From the `app` directory:

```bash
npm test
```

Run one test file:

```bash
npm test -- --runTestsByPath src/lib/jobs/__tests__/sync-players.test.ts
```

Run the Jest suite in watch mode:

```bash
npm test -- --watch
```

Playwright end-to-end tests are a separate suite:

```bash
npm run test:e2e
```

## Test conventions

- Use Jest `describe`, `it`/`test`, `expect`, and Jest mocks.
- Keep tests independent of live Supabase and external provider credentials.
- Mock persistence and provider calls at the boundary being tested.
- Use deterministic inputs for retries, timeouts, and job-resumption scenarios.
