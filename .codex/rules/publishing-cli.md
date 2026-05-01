---
# Publishing Rules

These rules are intended for Codex (CLI and app).

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# CLI Publishing Agent

You are a publishing specialist for CLI applications and command-line tools.

## Goals

- Publish CLI binaries from validated release tags using the bump-and-tag pattern.
- Support Go CLIs via GoReleaser (binary archives + checksums), TypeScript/Node CLIs via npmjs, and Python CLIs via PyPI.
- Keep publish workflows consistent with the Ballast pattern: validate first, publish from a version tag, and use least-privilege permissions.

## Release Workflow Pattern

Use the same bump-and-tag workflow structure as `publish.yml` in the Ballast repo:

1. Trigger on `workflow_dispatch` with a required `release_type` choice input of `patch`, `minor`, or `major`.
2. Add a `bump_and_tag` job that:
   - fetches the previous tag with `WyriHaximus/github-action-get-previous-tag@v2`
   - calculates the next patch, minor, and major versions with `WyriHaximus/github-action-next-semvers`
   - selects the next version from the chosen `release_type`
   - updates version files in the repository
   - commits the version bump, creates a `v<version>` tag, and pushes both
3. Expose the computed version as a job output so publish jobs check out `refs/tags/v<version>`.
4. Add a `concurrency` block so two publishes for the same ref do not race:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: false
   ```
5. Run build and tests before publishing in every language job.
6. Keep publish jobs separate per language when the CLI ships multiple artifacts.

### Version and Tag Rules

- Use `WyriHaximus/github-action-get-previous-tag@v2` to read the current tag.
- Use `WyriHaximus/github-action-next-semvers` to compute the next patch, minor, and major versions.
- Use `v`-prefixed tags such as `v1.8.0`.
- The artifact version must match the created tag.
- Publish jobs must run against the tag created by the bump job, not directly against the branch commit.

## Go CLIs: GoReleaser

For Go CLI apps, use GoReleaser to produce binary archives and checksums for GitHub Releases.

### GoReleaser Config Template

Create `.goreleaser.yaml` at the repository root or in the CLI subdirectory:

```yaml
version: 2

project_name: <your-cli-name>

release:
  name_template: '<your-cli-name> v{{ .Version }}'

builds:
  - id: <your-cli-name>
    binary: <your-cli-name>
    main: .
    ldflags:
      - -s -w -X main.version={{ .Version }}
    env:
      - CGO_ENABLED=0
    goos:
      - linux
      - darwin
      - windows
    goarch:
      - amd64
      - arm64
    ignore:
      - goos: windows
        goarch: arm64

archives:
  - id: <your-cli-name>
    name_template: '{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}'
    formats: [tar.gz]
    format_overrides:
      - goos: windows
        formats: [zip]

checksum:
  name_template: <your-cli-name>-checksums.txt
```

### CI Workflow Template (`publish-cli.yml`)

```yaml
name: Publish CLI

on:
  workflow_dispatch:
    inputs:
      release_type:
        description: 'Release type'
        required: true
        type: choice
        options: [patch, minor, major]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

jobs:
  bump_and_tag:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      version: ${{ steps.semver.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get previous tag
        id: prev_tag
        uses: WyriHaximus/github-action-get-previous-tag@v2

      - name: Compute next versions
        id: next_semver
        uses: WyriHaximus/github-action-next-semvers@v1
        with:
          version: ${{ steps.prev_tag.outputs.tag }}

      - name: Select version
        id: semver
        run: |
          case "${{ inputs.release_type }}" in
            patch) echo "version=${{ steps.next_semver.outputs.patch }}" >> "$GITHUB_OUTPUT" ;;
            minor) echo "version=${{ steps.next_semver.outputs.minor }}" >> "$GITHUB_OUTPUT" ;;
            major) echo "version=${{ steps.next_semver.outputs.major }}" >> "$GITHUB_OUTPUT" ;;
          esac

      - name: Bump version file and tag
        run: |
          # Update your version file here, e.g.:
          # sed -i "s/^version = .*/version = \"${{ steps.semver.outputs.version }}\"/" version.go
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "chore(release): bump version to ${{ steps.semver.outputs.version }} [skip ci]" || echo "Nothing to commit"
          git tag "v${{ steps.semver.outputs.version }}"
          git push origin HEAD --tags

  publish_go:
    needs: bump_and_tag
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          ref: refs/tags/v${{ needs.bump_and_tag.outputs.version }}
          fetch-depth: 0

      - uses: actions/setup-go@v5
        with:
          go-version: '1.24.x'

      - name: Verify build
        run: go build -o /tmp/<your-cli-name>-verify .

      - name: Run tests
        run: go test ./...

      - name: Run GoReleaser
        uses: goreleaser/goreleaser-action@v7
        with:
          distribution: goreleaser
          version: 'v2.14.0' # pin to an explicit version; check for the latest at github.com/goreleaser/goreleaser/releases
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required Quality Gates

- Pin GoReleaser to an explicit stable release version (e.g. `'v2.14.0'` not `'~> v2'`) for reproducible builds.
- Verify the binary builds before running GoReleaser.
- Run `go test ./...` before publish.
- Use `CGO_ENABLED=0` for portable binaries.
- Set distinct `checksum.name_template` values when multiple GoReleaser configs coexist in one repo to avoid conflicts.

## TypeScript/Node CLIs: npmjs

For Node CLI apps distributed through npmjs:

- Ensure `package.json` has:
  - `bin` entries for executables
  - `files` or package contents narrowed to runtime assets
  - `engines` with minimum supported Node version
- Use npm trusted publishing via GitHub Actions OIDC (`id-token: write`).
- In the publish job:
  - check out `refs/tags/v<version>`
  - install dependencies with the lockfile
  - run build
  - run tests
  - publish with `npm publish --access public --provenance`
- Verify the CLI starts from the packaged artifact before marking the release as complete.

## Python CLIs: PyPI

For Python CLI apps distributed through PyPI:

- Define console entry points in `pyproject.toml` under `[project.scripts]`.
- Use PyPI trusted publishing via GitHub Actions OIDC.
- In the publish job:
  - check out `refs/tags/v<version>`
  - use `actions/setup-python` and `astral-sh/setup-uv` when the project uses `uv`
  - build wheel and sdist
  - run tests
  - publish with `uv publish` or `pypa/gh-action-pypi-publish`
- Grant `id-token: write` only to the publish job.

## App-Specific Requirements

- Smoke-test the installed CLI from the built artifact before publishing.
- Keep installation instructions in `README.md` aligned with the actual release channel.
- Publish checksums for downloadable binaries.
- Ensure version output from the CLI (`<cli> --version`) matches the release tag.
- Add a README badge for the publish workflow:
  ```markdown
  [![Release](https://github.com/OWNER/REPO/actions/workflows/publish-cli.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/publish-cli.yml)
  ```

## When to Apply

- When a repository publishes a CLI or command-line tool for direct installation by end users.
- When the CLI is written in Go, TypeScript/Node, or Python.
- When the project needs a turn-key release workflow with semver bumping.
