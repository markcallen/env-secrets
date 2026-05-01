---
# Publishing Rules

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# Homebrew Tap Publishing Agent

You are a publishing specialist for Homebrew tap distribution of CLI tools.

## Goals

- Automatically write a Homebrew formula to a `homebrew-<project>` tap repo after each GitHub Release.
- Keep the Homebrew tap in sync with the GoReleaser publish workflow so users can install the CLI with `brew install`.
- Use the same bump-and-tag pattern as the CLI publish workflow as the trigger.

## Prerequisites

This rule extends the Go CLI publishing rule. Complete the CLI publishing setup (`.goreleaser.yaml` with `builds`, `archives`, and `checksum`) before adding Homebrew distribution.

## Setting Up the Tap Repository

1. Create a new GitHub repository named `homebrew-<your-project>` under the same owner (e.g. `acme/homebrew-mycli`).
2. Create a `Formula/` directory in the tap repo with a placeholder `.gitkeep` file (GoReleaser will create the real formula).
3. Add repository description: "Homebrew tap for <your-project>".
4. Keep the tap repo public so users can add it with `brew tap`.

## GoReleaser `brews` Block

Add a `brews` section to your `.goreleaser.yaml`:

```yaml
brews:
  - name: <your-cli-name>
    ids:
      - <your-cli-name> # must match the archive id in your archives section
    homepage: https://github.com/OWNER/REPO
    description: One-line description of what the CLI does.
    license: MIT
    repository:
      owner: OWNER
      name: homebrew-<your-cli-name>
      branch: main
      token: '{{ .Env.HOMEBREW_TAP_GITHUB_TOKEN }}'
    commit_author:
      name: github-actions[bot]
      email: github-actions[bot]@users.noreply.github.com
    directory: Formula
    test: |
      system "#{bin}/<your-cli-name>", "--help"
```

Replace `OWNER`, `REPO`, and `<your-cli-name>` with real values.

### Required `test` Stanza

Always include a `test` stanza that runs the binary with a flag that exits 0 (e.g. `--help` or `--version`). Homebrew runs this during `brew test` to verify the formula works after installation.

### Formula `install` Method

GoReleaser generates the `install` method automatically from the archive contents. You do not need to write it manually unless you are publishing non-GoReleaser archives.

## Secret: `HOMEBREW_TAP_GITHUB_TOKEN`

GoReleaser needs write access to the tap repo to commit the formula. Create a GitHub personal access token with `repo` scope (fine-grained: Contents: Read and write on the tap repo) and add it as a repository secret named `HOMEBREW_TAP_GITHUB_TOKEN` on the source repo.

Add to your publish workflow env:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  HOMEBREW_TAP_GITHUB_TOKEN: ${{ secrets.HOMEBREW_TAP_GITHUB_TOKEN }}
```

## CI Workflow Addition

In your `publish-cli.yml` GoReleaser step, ensure `HOMEBREW_TAP_GITHUB_TOKEN` is passed. No separate job is needed — GoReleaser handles the formula commit as part of the release run.

## Telling Users About the Tap

Add an installation section to `README.md`:

```markdown
## Installation

### Homebrew (macOS and Linux)

\`\`\`bash
brew tap OWNER/homebrew-<your-cli-name>
brew install <your-cli-name>
\`\`\`

### Direct download

Download the latest binary from [GitHub Releases](https://github.com/OWNER/REPO/releases).
```

## Important Notes

- The tap repo must be public for `brew tap` to work without authentication.
- The formula commit happens during the GoReleaser release step — if GoReleaser fails the formula is not updated.
- Keep the `homebrew-` prefix on the tap repo name; Homebrew convention requires it so `brew tap OWNER/<cli-name>` resolves to `OWNER/homebrew-<cli-name>`.
- Only include binary archives in the `ids` list for the `brews` block; exclude `.deb` or other non-archive artifacts.
- GoReleaser will fail if the tap token is missing or lacks write access to the tap repo.

## When to Apply

- When the project ships a Go CLI and wants `brew install` support.
- When GoReleaser is already configured for binary releases.
- When the maintainer controls an organization or user account on GitHub where the tap repo can live.
