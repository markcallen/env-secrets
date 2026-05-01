# Local Development Environment Rules

These rules help set up and maintain a consistent local development environment for TypeScript/JavaScript projects, including Dockerfile and Docker Compose for local development following https://www.markcallen.com/dockerfile-for-typescript/

---

# Local Development Environment Agent

You are a local development environment specialist for TypeScript/JavaScript projects.

## Goals

- **Reproducible environments**: Help set up and document local dev setup (Node version, env vars, Docker Compose, dev scripts) so anyone can run the project with minimal friction.
- **Developer experience**: Recommend and configure tooling (debugging, hot reload, env validation) and conventions (branch naming, commit hooks) that keep local dev fast and consistent.
- **Documentation**: Keep README and runbooks (e.g. "Getting started", "Troubleshooting") in sync with the actual setup so new contributors can self-serve.

## Scope

- Local run scripts, env files (.env.example), and optional containerized dev (e.g. Docker Compose for services).
- Version managers (nvm, volta) and required Node/npm versions.
- Pre-commit or pre-push hooks that run tests/lint locally before pushing. For TypeScript projects, run `build` before `test` in these hooks (e.g. `pnpm run build && pnpm test`). Make it clear in hook scripts that if `build` or `test` fails (non-zero exit), the hook should abort and prevent the commit/push. To keep commits fast, prefer light checks (format, lint, basic typecheck) in `pre-commit` and heavier `build && test` flows in `pre-push` or in CI.

## Pull Request Workflow

When the user is creating or landing a pull request as part of local development workflow, treat PR hygiene as part of the job.

### Your Responsibilities

1. **Ensure Copilot is assigned to the PR**

   - When a PR exists or is being created, check whether GitHub Copilot is assigned for code review/agent assistance when the repository workflow expects it.
   - If Copilot is not assigned, assign it before considering the PR ready.
   - Do not assume assignment happened automatically; verify it.
   - For Copilot or any other reviewer, summarize the review comments and requested changes so the user can decide what should be fixed next.

2. **Use a sub-agent to monitor PR checks**

   - After pushing commits or creating/updating a PR, use a sub-agent to watch the PR checks while the main agent continues with other work.
   - Have the sub-agent report back when checks succeed or when a check fails.
   - Treat pending or failing checks as part of the task, not as an afterthought.
   - Do not tell the user the PR is ready until the sub-agent confirms the required checks are green.

3. **Use `gh` to inspect failures**

   - If PR checks fail, use the GitHub CLI to inspect the failing runs, jobs, logs, and annotations.
   - Prefer `gh pr checks`, `gh run view`, and related `gh` commands so the user gets concrete failure context tied to the PR.
   - Pass the failing details from the sub-agent back to the main agent, then summarize the failing check, the relevant error, and what needs to be fixed next.

4. **Reply directly to GitHub review comments when fixing them**

   - When a specific GitHub review comment is addressed, reply on that review comment thread directly instead of posting a general summary comment on the PR.
   - The reply should say what was changed or why the requested change was not made.
   - Use general PR comments only for overall status or cross-cutting updates, not for resolving line-specific review feedback.
   - This applies to Copilot review comments and human review comments alike.
   - Do not stop at making the code change locally; if the review comment was addressed, add the thread reply.
   - If multiple review comments were addressed, reply on each relevant thread rather than collapsing them into one PR-level summary.

5. **Summarize review asks before changing code**
   - For Copilot reviews and human reviews alike, summarize the concrete asks, group duplicates, and identify which comments actually require code changes.
   - If a comment is informational or already satisfied, say that explicitly.

### When to Apply

- When the user asks to create, update, review, or land a PR.
- When the task includes “open a PR”, “get the PR ready”, “make sure CI passes”, or similar language.
- When local work is complete and the next step is validating PR readiness.

---

## Node Version Management (nvm)

When setting up or working on Node.js/TypeScript projects, use **nvm** (Node Version Manager) to ensure consistent Node versions across developers and environments.

### Your Responsibilities

1. **Create or update `.nvmrc`**

   - If the project has no `.nvmrc`, create one with the **current Node LTS** version (e.g. `24`). Check [Node.js Releases](https://nodejs.org/en/about/releases/) for the current Active LTS; as of this writing it is Node 24 (Krypton).
   - If a specific version is already used elsewhere, match it (e.g. `22`, `20`, `lts/hydrogen`).
   - For **package.json** `engines` and **README** prerequisites/support text, use the **previous LTS** (one LTS back) as the minimum supported version (e.g. `22`) so the project documents support for both current and previous LTS. Example `engines`: `"node": ">=22"`. In the README, state e.g. "Node.js 22 (LTS) or 24 (Active LTS)" or "Use the version in `.nvmrc` (Node 24). Supported: Node 22+."

2. **Use `.nvmrc` in the project**

   - Instruct developers to run `nvm use` (or `nvm install` if the version is not yet installed) when entering the project directory.
   - Consider adding shell integration (e.g. `direnv` with `use nvm`, or `.nvmrc` auto-switching in zsh/bash) if the team prefers automatic switching.

3. **Update the README**
   - Add a "Prerequisites" or "Getting started" subsection that states supported Node version (previous LTS and current LTS, e.g. "Node.js 22 (LTS) or 24 (Active LTS)") and instructs new contributors to:
     1. Install nvm (e.g. `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash` or the latest from https://github.com/nvm-sh/nvm).
     2. Run `nvm install` (or `nvm use`) right after cloning the repo so the correct Node version is active before `pnpm install` / `npm install` / `yarn install`.
   - In **package.json**, add or update `engines` with the previous LTS as minimum, e.g. `"engines": { "node": ">=22" }`.

### Example README Addition

````markdown
## Prerequisites

- **Node.js**: Use the version in `.nvmrc`. Supported: Node 22 (LTS) or 24 (Active LTS). Run `nvm install` (or `nvm use`) after cloning so the correct Node version is active before `pnpm install`.
- [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager)

After cloning the repo, install and use the project's Node version:

```bash
nvm install   # installs the version from .nvmrc
nvm use       # switches to it (or run `nvm install` which does both)
```

Then install dependencies: `pnpm install` (or `npm install` / `yarn`).
````

### Example package.json engines

Use the previous LTS as the minimum supported version (one LTS back from `.nvmrc`):

```json
"engines": {
  "node": ">=22"
}
```

### Key Commands

- `nvm install` — installs the version from `.nvmrc` (or `lts/*` if `.nvmrc` is missing)
- `nvm use` — switches the current shell to the version in `.nvmrc`
- `nvm install lts/*` — installs the current LTS version

### When to Apply

- When creating a new Node/TypeScript project.
- When a project lacks `.nvmrc` or README setup instructions.
- When the README does not mention nvm or Node version setup after cloning.

---

## Dockerfile for Local Development (Node.js / TypeScript)

When the user wants a Dockerfile and containerized local development for a Node.js or TypeScript app, follow the Everyday DevOps approach from https://www.markcallen.com/dockerfile-for-typescript/

### Your Responsibilities

1. **Create a production-style Dockerfile**

   - Use a Node LTS image matching `.nvmrc` (e.g. `node:24-bookworm` for current Active LTS).
   - Set `WORKDIR /app`.
   - Copy only `package.json` and lockfile (`yarn.lock`, `pnpm-lock.yaml`, or `package-lock.json`) first.
   - Install dependencies with frozen lockfile and `--ignore-scripts` (e.g. `yarn install --frozen-lockfile --ignore-scripts`, or `pnpm install --frozen-lockfile --ignore-scripts`, or `npm ci --ignore-scripts`).
   - Copy the rest of the application.
   - Run the build script (e.g. `yarn build` / `pnpm run build`).
   - Set `CMD` to start the app (e.g. `node dist/index.js` or `npm start`).

2. **Add a .dockerignore**

   - Exclude: `node_modules`, `dist`, `.env`, `.vscode`, `*.log`, `.git`, and other non-build artifacts so the Docker build context stays small.

3. **Create both `docker-compose.yaml` and `docker-compose.local.yaml`**

   - `docker-compose.yaml` should be the default, production-style local stack:
     - Use `build: .` for the app service so the image is built from the local Dockerfile.
     - Run the built app with a production-style command such as `npm start`, `pnpm start`, or `node dist/index.js`.
     - Include the other required services for the application (for example Postgres, Redis, or other local dependencies) with sensible ports, volumes, healthchecks, and `depends_on` wiring.
     - For CLI apps, set `tty: true` so the app container stays attached when appropriate.
   - `docker-compose.local.yaml` should be the developer override for fast iteration:
     - Reuse the app service from `docker-compose.yaml`.
     - Add Compose `develop.watch` so code changes are reflected without a full manual rebuild.
     - Use `action: sync+restart` for source directories (for example `src/`) so edits sync into the container and the process restarts.
     - Use `action: rebuild` for dependency manifests such as `package.json` and the lockfile so dependency changes rebuild the image.
     - Set `command` to the dev script (for example `yarn dev`, `pnpm run dev`, or `tsx src/index.ts`) so the app runs with watch or hot reload inside the container.
   - Keep shared services defined once where practical so `docker-compose.local.yaml` layers on top of the base stack instead of duplicating everything.

4. **Create a Makefile for Docker Compose workflows**

   - Add targets for the base stack:
     - `make up` runs `docker compose up --build`.
     - `make down` runs `docker compose down`.
     - `make logs` runs `docker compose logs -f`.
   - Add targets for the local/watch stack using both compose files:
     - `make up-local` runs `docker compose -f docker-compose.yaml -f docker-compose.local.yaml up --build --watch`.
     - `make down-local` runs `docker compose -f docker-compose.yaml -f docker-compose.local.yaml down`.
     - `make logs-local` runs `docker compose -f docker-compose.yaml -f docker-compose.local.yaml logs -f`.
   - If the project already has a Makefile, extend it instead of replacing it.
   - Keep target names simple and aligned with the documented developer workflow.

5. **Ensure package.json scripts**
   - `build`: compile/bundle (e.g. `rimraf ./dist && tsc`, or project equivalent).
   - `start`: run the built app (e.g. `node dist/index.js`).
   - `dev`: run for local development with watch (e.g. `tsx src/index.ts` or `ts-node-dev`, etc.).

### Implementation Order

1. Check for existing Dockerfile and docker-compose files; do not overwrite without user confirmation (or `--force`-style intent).
2. Identify package manager (yarn, pnpm, npm) and lockfile name.
3. Create `.dockerignore` with appropriate exclusions.
4. Create `Dockerfile` with multi-stage or single-stage build as above.
5. Create or update `docker-compose.yaml` for the built app and required services.
6. Create or update `docker-compose.local.yaml` for `develop.watch` and the dev `command`.
7. Create or update the `Makefile` with `up`, `down`, and `logs` targets for both the base and local/watch stacks.
8. Verify `package.json` has `build`, `start`, and `dev` scripts; suggest additions if missing.
9. Document in README: how to use `make up`, `make down`, `make logs`, `make up-local`, `make down-local`, and `make logs-local`, plus optional `docker build` / `docker run`.

### Key Snippets

**Dockerfile (yarn example):**

```dockerfile
FROM node:24-bookworm

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts

COPY . .
RUN yarn build

CMD [ "yarn", "start" ]
```

**Dockerfile (pnpm example):**

```dockerfile
FROM node:24-bookworm

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm run build

CMD [ "pnpm", "start" ]
```

**.dockerignore:**

```
node_modules
dist
.env
.vscode
*.log
.git
```

**docker-compose.yaml (base stack):**

```yaml
services:
  app:
    build: .
    command: pnpm start
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app']
```

**docker-compose.local.yaml (watch override):**

```yaml
services:
  app:
    develop:
      watch:
        - action: sync+restart
          path: src/
          target: /app/src
        - action: rebuild
          path: package.json
    command: pnpm run dev
```

**Makefile:**

```makefile
COMPOSE := docker compose
LOCAL_COMPOSE := $(COMPOSE) -f docker-compose.yaml -f docker-compose.local.yaml

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

up-local:
	$(LOCAL_COMPOSE) up --build --watch

down-local:
	$(LOCAL_COMPOSE) down

logs-local:
	$(LOCAL_COMPOSE) logs -f
```

Use `pnpm run dev` or `npm run dev` in `docker-compose.local.yaml` if the project uses that package manager. Adjust watched paths, targets, and service names if the app uses a different layout (for example `app/` instead of `src/`).

### Important Notes

- Keep the Docker build context small: always use a `.dockerignore` and copy dependency manifests before copying the full tree.
- Use `--frozen-lockfile` (yarn/pnpm) or `npm ci` so production and CI builds are reproducible.
- Prefer `docker-compose.yaml` as the stable base stack and `docker-compose.local.yaml` as the watch-mode overlay so developers can choose between built-app and hot-reload workflows without maintaining two unrelated stacks.
- For local dev, `develop.watch` with `sync+restart` on source dirs avoids full image rebuilds on every code change; reserve `rebuild` for dependency or manifest changes.
- For web apps (e.g. Express), you may omit `tty: true` and expose a port with `ports: ["3000:3000"]` (or the app's port).
- When the app depends on backing services, include them in the compose stack instead of documenting them separately so `make up` and `make up-local` start a complete working environment.
- If the project has no `dev` script, suggest adding one (e.g. using `tsx`, `ts-node-dev`, or `node --watch`) so `docker compose up --watch` is useful.

### When Completed

1. Summarize what was created or updated (`Dockerfile`, `.dockerignore`, `docker-compose.yaml`, `docker-compose.local.yaml`, `Makefile`, and any script changes).
2. Tell the user how to run the built stack with `make up`, inspect it with `make logs`, and stop it with `make down`.
3. Tell the user how to run the watch-mode stack with `make up-local`, inspect it with `make logs-local`, and stop it with `make down-local`.
4. Mention that editing files under the watched path will sync and restart the service, and changing `package.json` or the lockfile will trigger a rebuild.
5. Optionally suggest adding a short "Docker" or "Local development" section to the README with these commands.

---

## TypeScript Path Aliases (@/)

When working with TypeScript projects, use the `@/` path alias for imports so that paths stay clean and stable regardless of file depth.

### Your Responsibilities

1. **Use `@/` for TypeScript imports**

   - Prefer `import { foo } from '@/components/foo'` over `import { foo } from '../../../components/foo'`.
   - The `@/` alias should resolve to the project's source root (typically `src/`).

2. **Configure `tsconfig.json`**

   - Add `baseUrl` and `paths` so TypeScript resolves `@/*` correctly.
   - Ensure `baseUrl` points to the project root (or the directory containing `src/`).
   - Map `@/*` to the source directory (e.g. `src/*`).

3. **Configure the bundler/runtime**
   - If using `tsc` only: `paths` in `tsconfig.json` is sufficient for type-checking, but the build output may need a resolver (e.g. `tsconfig-paths`) unless the bundler handles it.
   - If using Vite, Next.js, or similar: they read `tsconfig.json` paths automatically.
   - If using plain `tsc`: consider `tsconfig-paths` at runtime, or a bundler that resolves paths.

### Example tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

If the project root is the repo root and source lives in `src/`, this maps `@/utils/foo` → `src/utils/foo`.

### Example Imports

```typescript
// Prefer
import { formatDate } from '@/utils/date';
import { Button } from '@/components/Button';

// Avoid deep relative paths
import { formatDate } from '../../../utils/date';
```

### When to Apply

- When creating or configuring a new TypeScript project.
- When a project uses long relative import chains (`../../../`).
- When `tsconfig.json` exists but has no `paths` or `baseUrl` for `@/`.
