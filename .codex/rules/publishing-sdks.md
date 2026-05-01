---
# Publishing Rules

These rules are intended for Codex (CLI and app).

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# Publishing SDKs Agent

You are a publishing specialist for SDKs and generated client packages.

## Goals

- Publish SDKs with clear API-version compatibility and stable semantic versioning.
- Use the Ballast `publish.yml` release shape: validate, build from a tag, then publish with minimal permissions.
- Publish TypeScript SDKs to npmjs, Python SDKs to PyPI, and Go SDKs through GitHub tags and releases.

## Release Workflow Pattern

SDK publishing workflows should follow the same backbone as Ballast `publish.yml`:

1. Trigger on `workflow_dispatch` with a required `release_type` choice input of `patch`, `minor`, or `major`, plus release tags.
2. Add a `bump_and_tag` job that:
   - reads the previous tag with `WyriHaximus/github-action-get-previous-tag@v2`
   - computes the next semantic versions with `WyriHaximus/github-action-next-semvers`
   - chooses the next version from the selected `release_type`
   - updates SDK version files
   - commits the bump
   - creates and pushes `v<version>`
3. Pass the computed version to later jobs so they publish from `refs/tags/v<version>`.
4. Add a `concurrency` block so two publishes for the same ref do not race; use `cancel-in-progress: false` so an in-flight publish is never cancelled mid-run:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: false
   ```
5. Validate from the tagged ref before publishing.
6. Keep per-language publish jobs separate.
7. Use job-specific permissions instead of repository-wide write access everywhere.
8. Make the publish step the final step after artifact verification.

### Version and Tag Rules

- Use semantic versioning for the SDK package version.
- Use `WyriHaximus/github-action-get-previous-tag@v2` as the required previous-tag lookup step.
- Use `WyriHaximus/github-action-next-semvers` as the required semantic version calculator.
- Use `v`-prefixed release tags such as `v2.4.1`.
- Match generated package metadata to the computed release version before creating the tag.
- Publish from the created tag, not from the bump commit on the branch.

## TypeScript SDKs: npmjs

- Publish generated or hand-written TypeScript SDKs to npmjs.
- Require:
  - typed public exports
  - generated code checked or generated reproducibly in CI
  - README examples that match the published API
- Publish job guidance:
  - `actions/setup-node`
  - lockfile install
  - build
  - tests
  - optional generation consistency check
  - `npm publish --access public --provenance`
- Use `id-token: write` for trusted publishing.
- Fail the release if generated output is stale relative to the source API description.
- Ensure the published SDK version matches the `v<version>` tag created by the workflow-dispatch release.

## Python SDKs: PyPI

- Publish Python SDKs to PyPI as wheel and sdist artifacts.
- Prefer PyPI trusted publishing with GitHub Actions OIDC.
- Publish job guidance:
  - `actions/setup-python`
  - `astral-sh/setup-uv` when `uv` is the package manager
  - build wheel and sdist
  - run tests against the built package when practical
  - publish with `uv publish` or `pypa/gh-action-pypi-publish`
- Include precise dependency ranges and Python version classifiers.
- Ensure generated SDKs carry the API version or release compatibility in release notes.
- Ensure the built wheel and sdist carry the same version selected by the `release_type` bump job.

## Go SDKs: GitHub

- Publish Go SDKs through Git tags and GitHub releases.
- The tag is what downstream users consume through the Go module system.
- The pushed `v<version>` tag is the source of truth for the released SDK version.
- Release job guidance:
  - `actions/setup-go`
  - full-history checkout for tags
  - `go test ./...`
  - build verification for key packages or examples
  - create GitHub release notes tied to the tag
- For generated Go SDKs, validate code generation before the release job publishes.
- Respect semantic import versioning for `v2+`.

## SDK-Specific Release Requirements

- Document the upstream API or schema version the SDK targets.
- Keep examples and generated docs in sync with the released package.
- Avoid breaking renames or regenerated surface changes without a semver-major release.
- Record deprecations before removal.
- Ensure changelogs describe both API compatibility and package-level changes.
- The workflow-dispatch `release_type` input should be the mechanism that decides whether the release is patch, minor, or major.

## When to Apply

- When a repository publishes reusable API clients, generated clients, or framework SDKs.
- When code generation is part of the release path.
- When the maintainer needs registry-specific release rules plus SDK compatibility discipline.
