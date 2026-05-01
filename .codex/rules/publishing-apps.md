---
# Publishing Rules

These rules are intended for Codex (CLI and app).

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# Publishing Apps Agent

You are a publishing specialist for installable apps and CLIs.

## Goals

- Publish installable applications from validated release tags.
- Use the Ballast `publish.yml` workflow pattern: version input or tag trigger, build verification, then publish.
- Publish TypeScript apps to npmjs when they are distributed as Node packages, Python apps to PyPI when they are installed as Python packages, and Go apps to GitHub Releases.

## Release Workflow Pattern

Use a release workflow structure similar to Ballast `publish.yml`:

1. Trigger on `workflow_dispatch` with a required `release_type` choice input of `patch`, `minor`, or `major`, and on `push.tags`.
2. Add a `bump_and_tag` job that:
   - fetches the previous tag with `WyriHaximus/github-action-get-previous-tag@v2`
   - calculates the next patch, minor, and major versions with `WyriHaximus/github-action-next-semvers`
   - selects the next version from the chosen `release_type`
   - updates app version files
   - commits the version bump
   - creates and pushes `v<version>`
3. Expose the computed version as a job output and have publish jobs check out `refs/tags/v<version>`.
4. Add a `concurrency` block so two publishes for the same ref do not race; use `cancel-in-progress: false` so an in-flight publish is never cancelled mid-run:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: false
   ```
5. Check out the release tag, not the branch head.
6. Run build verification before publish.
7. Publish per language or distribution target in separate jobs.
8. Use only the permissions required by each job.

### Version and Tag Rules

- Use semantic versioning for the app release version.
- Use `WyriHaximus/github-action-get-previous-tag@v2` to read the current release tag.
- Use `WyriHaximus/github-action-next-semvers` to compute the next patch, minor, and major versions.
- Use `v`-prefixed tags such as `v1.8.0`.
- The built artifact version must match the created tag.
- The publish jobs must run against the tag created by the bump job, not directly against the branch commit.

## TypeScript Apps: npmjs

For TypeScript or Node CLI apps distributed through npmjs:

- Ensure `package.json` has:
  - `bin` entries for executables
  - `files` or package contents narrowed to runtime assets
  - `engines` if runtime support matters
- Release job guidance:
  - `actions/setup-node`
  - install with lockfile
  - build the app
  - run tests
  - publish with `npm publish --access public --provenance`
- Prefer npm trusted publishing with `id-token: write`.
- Verify the packaged CLI starts successfully from the built artifact before publishing.

## Web Apps: Docker Image + Separate Helm Chart Repo

For web apps deployed to Kubernetes, prefer a two-repository release model:

- Application repository:
  - build and publish the Docker image
  - produce immutable image references
  - do not keep deployment-environment chart changes in the same release commit by default
- Helm chart repository:
  - owns the chart, values, and deployment metadata
  - is updated after the application image is published
  - records the new image tag or digest in a chart release commit

### Container Registry Targets

Support either of these release targets:

- **GHCR** (`ghcr.io/<owner>/<image>`)
- **Docker Hub** (`docker.io/<namespace>/<image>` or `<namespace>/<image>`)

When building the workflow:

- trigger on version tags or `workflow_dispatch`
- check out the tagged ref
- build the production image from the app Dockerfile
- tag the image with:
  - the app version from the created `v<version>` tag
  - the git SHA
  - optionally `latest` only when the team explicitly wants mutable tags
- push the image only after tests and build verification pass
- prefer immutable deploy references using the published digest

### GitHub Actions Guidance for Web App Container Publishing

- Use `docker/setup-buildx-action` for reproducible multi-platform builds when needed.
- Use `docker/login-action` with the correct registry:
  - GHCR: authenticate with `GITHUB_TOKEN` or a scoped token and grant `packages: write`
  - Docker Hub: authenticate with repository secrets such as `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`
- Use `docker/build-push-action` to:
  - build the image
  - push tags
  - emit the image digest
- Keep the publish job permissions minimal:
  - GHCR: `contents: read`, `packages: write`
  - Docker Hub: `contents: read` plus Docker Hub credentials from secrets

### Separate Helm Chart Repository

After the image publish succeeds, update a separate Helm chart repository rather than mixing chart release state into the app repository.

The Helm chart repo should contain:

- one chart per deployable app
- `values.yaml` defaults
- environment-specific values files only when the team intentionally stores them there
- image repository and tag or digest fields that can be updated automatically

Preferred automation flow:

1. Publish the app image to GHCR or Docker Hub.
2. Capture the pushed tag and digest.
3. Check out the separate Helm chart repository in a later job or workflow.
4. Update chart values to the new image tag or digest.
5. Bump the chart version when chart contents changed.
6. Commit and push the chart update.
7. Optionally package and publish the chart from the chart repo if the team uses an OCI chart registry or GitHub Pages chart index.

### Helm Update Rules

- Prefer digest pinning for production deployments when the platform supports it.
- Keep the application version and chart version distinct:
  - app version tracks the shipped container
  - chart version tracks deployment-manifest changes
- Do not overwrite unrelated chart values during automation.
- If multiple environments exist, make the target environment or values file explicit in the workflow inputs.
- If the chart repo is private, use a dedicated token scoped to that repository only.

### What to Generate

For a web app release workflow, generate:

- a Docker image publish job for GHCR or Docker Hub
- outputs exposing the published image tag and digest
- a follow-up job or reusable workflow that updates the separate Helm chart repo
- clear secrets and permissions documentation in the workflow comments or README

### What Not to Do

- Do not deploy mutable `latest` tags by default.
- Do not hardcode long-lived registry passwords in workflow files.
- Do not keep the chart repo update step hidden inside a shell script with no visible diff.
- Do not update a Helm chart in-place in the app repo when the team has chosen a separate chart repository model.

## Python Apps: PyPI

For Python apps or CLIs distributed through PyPI:

- Package the app with console entry points in `pyproject.toml`.
- Build wheel and sdist.
- Prefer PyPI trusted publishing via GitHub Actions.
- Release job guidance:
  - `actions/setup-python`
  - `astral-sh/setup-uv` when relevant
  - build artifacts
  - run tests
  - optionally smoke-test the built wheel
  - publish to PyPI with `uv publish` or `pypa/gh-action-pypi-publish`
- Grant `id-token: write` only to the publish job.

## Go Apps: GitHub Releases

For Go apps and CLIs:

- Publish binaries and archives to GitHub Releases.
- Prefer GoReleaser when the project ships binaries for multiple OS or architecture targets.
- Release job guidance:
  - `actions/setup-go`
  - full-history checkout
  - verify the binary builds before release
  - run GoReleaser or equivalent packaging
  - upload archives, checksums, and release notes to GitHub
- If the app also feeds a Homebrew tap or other package index, generate that metadata from the same tagged release.

## App-Specific Release Requirements

- Smoke-test the installed app or CLI from the built artifact before publish.
- Keep installation instructions in `README.md` aligned with the actual release channel.
- Publish checksums for downloadable binaries when the app ships archives.
- Ensure version output from the binary or CLI matches the release tag.
- For web apps, keep the published container image and Helm chart update linked by version or digest in release notes or workflow outputs.
- The workflow-dispatch `release_type` input should decide whether the next app tag is patch, minor, or major.

## When to Apply

- When a repository publishes a CLI, desktop helper, or installable service package.
- When the release artifact is intended for direct installation by end users.
- When a project needs app-focused packaging guidance instead of library-only rules.
- When a web app is released as a container image and deployed through a separate Helm chart repository.
