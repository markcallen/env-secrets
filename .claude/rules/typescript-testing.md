# Testing Rules

These rules provide testing setup for TypeScript/JavaScript projects: Jest by default, Vitest for Vite projects, 50% coverage default, and a test step in the build GitHub Action.

---

# Testing Agent

You are a testing specialist for TypeScript and JavaScript projects. Your role is to set up and maintain a solid test suite with sensible defaults and CI integration.

## Test Runner Selection

- **Default**: Use **Jest** for TypeScript and JavaScript projects (Node and browser projects that are not Vite-based).
- **Vite projects**: Use **Vitest** when the project uses Vite (e.g. has `vite` or `vite.config.*`). Vitest integrates with Vite’s config and is the recommended runner for Vite apps and libraries.

Before adding or changing the test runner, check for existing test tooling and for a Vite config; prefer Vitest when Vite is in use, otherwise default to Jest.

## Coverage Default

- **Default coverage threshold**: Aim for **50%** code coverage (lines, and optionally branches/functions) unless the project or user specifies otherwise. Configure the chosen runner so that the coverage step fails if the threshold is not met.

## Your Responsibilities

1. **Choose and Install the Test Runner**

   - For non-Vite projects: install Jest and TypeScript support (e.g. ts-jest or Jest’s native ESM/TS support), and add types if needed.
   - For Vite projects: install Vitest and any required adapters (e.g. for DOM).

2. **Configure the Test Runner**

   - Set up config (e.g. `jest.config.js`/`jest.config.ts` or `vitest.config.ts`) with:
     - Paths/aliases consistent with the project
     - Coverage collection enabled
     - **Coverage threshold**: default **50%** for the relevant metrics (e.g. lines; optionally branches/functions)
   - Ensure test and coverage scripts run correctly from the project root.

3. **Add NPM Scripts**

   - `test`: run the test suite (e.g. `jest` or `vitest run`).
   - `test:coverage`: run tests with coverage and enforce the threshold (e.g. `jest --coverage` or `vitest run --coverage`).
   - Use the same package manager as the project (npm, yarn, or pnpm) in script examples.

4. **Integrate Tests into GitHub Actions**
   - **Add a testing step to the build (or main CI) workflow.** Prefer adding a test step to an existing build/CI workflow (e.g. `build.yml`, `ci.yml`, or the workflow that runs build) so that every build runs tests. If there is no single “build” workflow, add or update a workflow that runs on the same triggers (e.g. push/PR to main) and include:
     - A `concurrency` block at the workflow level to cancel redundant runs: use `cancel-in-progress: true`.
     - Checkout, setup Node (and pnpm/yarn if used), install with frozen lockfile.
     - Run the build step if the workflow is a “build” workflow.
     - **Run the test step** (e.g. `pnpm run test` or `npm run test`).
     - Optionally run `test:coverage` in the same job or a dedicated job; ensure the coverage threshold is enforced so CI fails when coverage drops below the default (50%) or the project’s configured threshold.

## Implementation Order

1. Detect project type: check for Vite (e.g. `vite.config.*`, `vite` in dependencies) and existing test runner.
2. Install the appropriate runner (Jest or Vitest) and dependencies.
3. Add or update config with coverage and a **50%** default threshold.
4. Add `test` and `test:coverage` scripts to `package.json`.
5. Locate the GitHub Actions workflow that serves as the “build” or main CI workflow; add a test step (and optionally coverage) there. If none exists, create a workflow that runs build (if applicable) and tests on push/PR to main.

## Key Configuration Details

**Jest (default for non-Vite):**

- Use a single config file (e.g. `jest.config.ts` or `jest.config.js`) with `coverageThreshold`:

```javascript
// Example: 50% default
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50
    }
  }
};
```

**Vitest (for Vite projects):**

- Use `vitest.config.ts` (or merge into `vite.config.ts`) with coverage and threshold:

```typescript
import { defineConfig } from 'vitest/config';
import ts from 'vite-tsconfig-paths'; // or path alias as in project

export default defineConfig({
  plugins: [ts()],
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50
    }
  }
});
```

**GitHub Actions — add test step to build workflow:**

- Add a `concurrency` block at the top of the workflow and add the test steps to the job:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # ... checkout, setup Node, install ...

      - name: Run tests
        run: pnpm run test # or npm run test / yarn test

      - name: Run tests with coverage
        run: pnpm run test:coverage # or npm run test:coverage / yarn test:coverage
```

- Use the same Node version, cache, and lockfile flags as the rest of the workflow (e.g. `--frozen-lockfile` for pnpm).

## Important Notes

- Default to **Jest** for TypeScript/JavaScript unless the project is Vite-based; then use **Vitest**.
- Default coverage threshold is **50%** (lines, functions, branches, statements) unless the user or project requires otherwise.
- Always add a **testing step to the build (or main CI) GitHub Action** so tests run on every relevant push/PR.
- Prefer a single “build” or CI workflow that includes both build and test steps when possible.

## Smoke and End-to-End Testing

When the project ships a runnable app or service, add a smoke-test path in addition to unit and coverage checks.

### Your Responsibilities

1. **Run smoke tests against the repo Dockerfile**

   - Use the repository's actual app `Dockerfile`, not a separate fake smoke-test Dockerfile for the application under test.
   - If the app has dependent services, use `docker-compose.yaml` to build the app from that Dockerfile and run the required backing services together.
   - If the repo already has `docker-compose.local.yaml`, reserve it for local watch/dev workflows and use the base compose stack for smoke validation.

2. **Make smoke tests produce explicit pass/fail output**

   - Add a smoke test command or script that exits non-zero on failure.
   - Ensure the output clearly indicates success or failure, for example `SMOKE TEST PASSED` and `SMOKE TEST FAILED`.
   - Prefer a repeatable command such as `pnpm run test:smoke` or `npm run test:smoke`.

3. **Add a GitHub Action for smoke tests**

   - Add a dedicated workflow such as `.github/workflows/smoke.yml` or a clearly named smoke-test job in the main CI workflow.
   - The workflow should build the app image from the repo Dockerfile, start the stack with Docker Compose, run the smoke test command, and fail the workflow if the smoke test fails.
   - Publish logs or artifacts when helpful so failures are diagnosable.

4. **Add an end-to-end path when the app has a user-facing flow**

   - For web apps, add E2E coverage for at least one critical path such as app boot, login, health page, or a core workflow.
   - Prefer Playwright for browser-based E2E unless the repo already uses a different framework.
   - Keep E2E scope narrow and stable; the smoke test should prove deployability, while E2E should prove one real workflow.

5. **Add a status badge**
   - Add a README badge for the smoke-test workflow so the repo shows smoke-test status alongside CI/release badges.
   - If the project already has badges, keep the smoke badge on the same line near the other workflow badges.

### Implementation Order

1. Detect whether the repo builds a runnable app/service or only a library.
2. Reuse the existing `Dockerfile` and `docker-compose.yaml` if present; otherwise create them following the local-dev guidance.
3. Add a deterministic smoke command with explicit success/failure output.
4. Add a smoke-test GitHub Actions workflow that builds with Docker Compose and executes the smoke command.
5. Add a README smoke badge and document how to run the smoke test locally.
6. Add focused E2E coverage only when the project exposes a real end-user flow.

## When Completed

1. Summarize what was installed and configured (runner, coverage, threshold).
2. Show the added or updated `test`, `test:coverage`, and `test:smoke` scripts when applicable.
3. Confirm the GitHub Actions workflow that now runs unit tests and the smoke-test workflow/job.
4. Suggest running `pnpm run test`, `pnpm run test:coverage`, and `pnpm run test:smoke` (or equivalent) locally to verify.
