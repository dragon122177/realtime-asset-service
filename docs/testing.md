# Testing strategy

ForgeFlow uses layered tests because the riskiest behavior is split between pure parsing rules, PostgreSQL concurrency/constraints, and the browser interface.

## Test layers

| Layer                  | Examples                                                                                                       | Runtime                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Domain unit            | GLB/glTF parsing, triangle estimates, quality findings, ranges, object keys, retry backoff, status transitions | Vitest, no services              |
| UI component           | status badge, loading/empty state, formatting                                                                  | Vitest + Testing Library + JSDOM |
| PostgreSQL integration | migrations, lifecycle trigger, immutable audit, RLS policy presence, concurrent job claim                      | PostgreSQL 16 in CI              |
| Build/static           | TypeScript, ESLint, Prettier, Vite/tsup bundles                                                                | Node.js 22                       |
| Supply chain           | production dependency audit, CodeQL, Dependabot                                                                | GitHub Actions                   |
| Packaging              | API/worker and unprivileged web container builds                                                               | Docker Buildx                    |

## Commands

```bash
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run check
```

PostgreSQL integration tests run when `TEST_DATABASE_URL` is defined. CI provides a real PostgreSQL 16 service:

```bash
TEST_DATABASE_URL=postgres://forgeflow:forgeflow@localhost:5432/forgeflow_test \
  npm run test:coverage
```

Each integration run migrates an isolated database state and uses transaction-safe cleanup. Tests focus on behavior that an in-memory database cannot reliably represent, especially triggers, RLS metadata, and `SKIP LOCKED` claims.

## Fixtures

The `samples/` directory contains tiny synthetic, self-contained glTF 2.0 documents with embedded buffers. Unit tests also construct malformed JSON and GLB buffers to prove rejection paths. No customer or proprietary model is included.

## Coverage policy

Coverage is a change detector, not proof of correctness. Thresholds emphasize the API domain and browser logic, while PostgreSQL tests assert database invariants directly. High-risk additions should include negative authorization, boundary, failure, and idempotency cases rather than only raising line coverage.

## Recommended next tests

- API contract tests through Fastify injection with a disposable PostgreSQL instance;
- Playwright flows for upload, review, retry, and WebGL fallback;
- object-store compatibility tests against MinIO;
- worker crash/lease recovery and duplicate-delivery tests;
- property tests for byte ranges and GLB chunk parsing;
- load tests for concurrent upload metadata and job claims.
