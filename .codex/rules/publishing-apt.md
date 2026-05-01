---
# Publishing Rules

These rules are intended for Codex (CLI and app).

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# APT/Deb Package Publishing Agent

You are a publishing specialist for Debian package (`.deb`) distribution of CLI tools.

## Goals

- Produce `.deb` packages alongside binary archives using GoReleaser `nfpms`.
- Attach `.deb` files to GitHub Releases so users can download and install them directly.
- Optionally publish to a lightweight APT repository hosted on GitHub Pages.

## Prerequisites

This rule extends the Go CLI publishing rule. Complete the CLI publishing setup (`.goreleaser.yaml` with `builds` and `archives`) before adding `.deb` packaging.

## GoReleaser `nfpms` Block

Add an `nfpms` section to your `.goreleaser.yaml`:

```yaml
nfpms:
  - id: <your-cli-name>-deb
    package_name: <your-cli-name>
    file_name_template: '{{ .PackageName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}'
    builds:
      - <your-cli-name> # must match the build id in your builds section
    vendor: Your Name or Organization
    homepage: https://github.com/OWNER/REPO
    maintainer: 'Your Name <you@example.com>'
    description: One-line description of what the CLI does.
    license: MIT
    formats:
      - deb
    contents:
      - src: ./completions/<your-cli-name>.bash
        dst: /usr/share/bash-completion/completions/<your-cli-name>
        file_info:
          mode: 0644
        type: config|noreplace
    # Remove the contents block if you have no shell completions or extra files.
```

Replace `OWNER`, `REPO`, `<your-cli-name>`, and maintainer details with real values.

### Minimal Config (no extras)

If the CLI has no shell completions or extra data files, use:

```yaml
nfpms:
  - id: <your-cli-name>-deb
    package_name: <your-cli-name>
    builds:
      - <your-cli-name>
    vendor: Your Name or Organization
    homepage: https://github.com/OWNER/REPO
    maintainer: 'Your Name <you@example.com>'
    description: One-line description of what the CLI does.
    license: MIT
    formats:
      - deb
```

## GitHub Releases (Simple Path)

By default, GoReleaser attaches `.deb` files to the GitHub Release alongside the binary archives. No additional configuration is needed beyond the `nfpms` block — users download and install with:

```bash
wget https://github.com/OWNER/REPO/releases/download/v<version>/<your-cli-name>_<version>_linux_amd64.deb
sudo dpkg -i <your-cli-name>_<version>_linux_amd64.deb
```

Document this install path in `README.md` under an `## Installation` section.

## README Install Path

Add a `.deb` installation section to `README.md`:

```markdown
## Installation

### Debian / Ubuntu (via .deb package)

Download the latest `.deb` from [GitHub Releases](https://github.com/OWNER/REPO/releases) and install:

\`\`\`bash
wget https://github.com/OWNER/REPO/releases/latest/download/<your-cli-name>\_linux_amd64.deb
sudo dpkg -i <your-cli-name>\_linux_amd64.deb
\`\`\`

### Direct binary download

Download the binary archive from [GitHub Releases](https://github.com/OWNER/REPO/releases) and extract to your PATH.
```

## Optional: GitHub Pages APT Repository

For projects that want `apt install` support (requires `apt-get update` to see new releases), you can host a lightweight APT repo on GitHub Pages using `reprepro` or `apt-tools`.

### Overview

1. Create a `gh-pages` branch (or use a separate `apt-repo` repository) to host the APT index files.
2. After GoReleaser publishes the release, a follow-up workflow step downloads the `.deb`, adds it to the APT index, and pushes the updated index to GitHub Pages.
3. Users add your repo: `echo "deb [trusted=yes] https://OWNER.github.io/REPO stable main" | sudo tee /etc/apt/sources.list.d/<your-cli-name>.list`

### APT Workflow Step (after GoReleaser)

```yaml
- name: Update APT repository
  run: |
    mkdir -p apt-repo/pool/main
    cp dist/*.deb apt-repo/pool/main/
    cd apt-repo
    dpkg-scanpackages pool/main /dev/null | gzip -9c > Packages.gz
    dpkg-scanpackages pool/main /dev/null > Packages
    # Push apt-repo/ to gh-pages branch or a dedicated apt-repo
```

This is a simplified example — for production APT repos with GPG signing use `reprepro` or Cloudsmith.

### GPG Signing (Recommended for Production)

Sign the Release file with a GPG key so `apt-get` can verify authenticity:

1. Generate a signing keypair: `gpg --batch --gen-key gpg-params.txt`
2. Export the public key and host it at a stable URL (e.g. GitHub Pages).
3. Add `APT_SIGNING_KEY` as a repository secret.
4. Tell users to run: `curl -fsSL https://OWNER.github.io/REPO/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/<your-cli-name>-keyring.gpg`

## Important Notes

- Only `linux/amd64` and `linux/arm64` targets are relevant for `.deb` packaging; exclude `darwin` and `windows` builds from the `nfpms` `builds` list if needed.
- The `nfpms` `file_name_template` must produce unique filenames per architecture to avoid collisions in the GitHub Release assets.
- The GitHub Releases path requires no extra infrastructure and is the recommended starting point.
- Move to a hosted APT repo only when users request `apt install` support.

## When to Apply

- When the project ships a Go CLI and users on Debian/Ubuntu are a primary audience.
- When GoReleaser is already configured for binary releases.
- When the project wants to make installation easier for Linux users who prefer system package managers.
