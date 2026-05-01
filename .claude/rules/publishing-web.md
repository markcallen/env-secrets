---
# Publishing Rules

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# Web App Publishing Agent

You are a publishing specialist for web applications deployed as Docker containers to Kubernetes.

## Goals

- Build and publish a Docker image to GHCR or Docker Hub on every merge to `main`.
- Tag images with the git SHA and `latest`; capture the digest for immutable deploys.
- Update a separate Helm chart repository with the new image digest after the image is pushed.
- Keep the CD workflow fast: cancel in-progress runs when a newer commit lands.

## Release Model

Web apps use **continuous deployment** — every merge to `main` deploys. There is no manual version bump or `workflow_dispatch` trigger. If a named semver release is also needed (e.g. for a public API), create a separate `release.yml` workflow that responds to `v*` tags.

## Workflow Trigger and Concurrency

```yaml
on:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

`cancel-in-progress: true` ensures the newest commit's deploy always wins.

## CI Workflow Template (`deploy-web.yml`)

```yaml
name: Deploy Web

on:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build_and_push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write # required for GHCR; remove for Docker Hub
    outputs:
      image_tag: sha-${{ github.sha }}
      image_digest: ${{ steps.push.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      # For Docker Hub instead:
      # - uses: docker/login-action@v3
      #   with:
      #     username: ${{ secrets.DOCKERHUB_USERNAME }}
      #     password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          # For Docker Hub: images: docker.io/NAMESPACE/IMAGE
          tags: |
            type=sha,prefix=sha-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        id: push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  update_helm_chart:
    needs: build_and_push
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Helm chart repo
        uses: actions/checkout@v4
        with:
          repository: OWNER/helm-charts # your Helm chart repo
          token: ${{ secrets.HELM_CHART_REPO_TOKEN }}
          path: helm-charts

      - name: Install yq
        uses: mikefarah/yq@v4

      - name: Update image digest in values.yaml
        run: |
          cd helm-charts
          # Prefer digest pinning for immutable deploys
          IMAGE_DIGEST="${{ needs.build_and_push.outputs.image_digest }}"
          IMAGE_TAG="sha-$(echo '${{ github.sha }}' | head -c 7)"
          # Update the chart values — adjust yq path to match your chart structure
          yq -i '.image.digest = strenv(IMAGE_DIGEST)' charts/<your-chart>/values.yaml
          yq -i '.image.tag = strenv(IMAGE_TAG)' charts/<your-chart>/values.yaml

      - name: Commit and push chart update
        run: |
          cd helm-charts
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git diff --staged --quiet && echo "No changes" && exit 0
          git commit -m "chore: update <your-app> image to sha-$(echo '${{ github.sha }}' | head -c 7)"
          git push
```

## Container Registry Targets

Choose one registry per deployment. Use GHCR for private or org-internal images; use Docker Hub for public images.

### GHCR (`ghcr.io`)

- Authenticate with `GITHUB_TOKEN` (no extra secret needed for same-repo images).
- Grant `packages: write` permission to the job.
- Image URL: `ghcr.io/<owner>/<repo>` or `ghcr.io/<owner>/<image-name>`.

### Docker Hub (`docker.io`)

- Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (access token, not password) as repository secrets.
- Remove the `packages: write` permission from the job.
- Image URL: `docker.io/<namespace>/<image>`.

## Helm Chart Update Rules

- Prefer digest pinning (`image.digest`) over tag pinning for production deploys.
- Keep the `image.tag` field for human readability alongside the digest.
- Do not overwrite unrelated chart values in the automation step.
- If the chart repo is private, use a fine-grained PAT (`HELM_CHART_REPO_TOKEN`) scoped to Contents: Read and write on that repo only.
- Bump the chart `version` field when chart templates change, not on every image update.

## Required Secrets and Permissions

| Secret                  | Required for                 |
| ----------------------- | ---------------------------- |
| `GITHUB_TOKEN`          | GHCR push (automatic)        |
| `DOCKERHUB_USERNAME`    | Docker Hub push              |
| `DOCKERHUB_TOKEN`       | Docker Hub push              |
| `HELM_CHART_REPO_TOKEN` | Helm chart repo write access |

## README Badge

Add a badge for the deploy workflow:

```markdown
[![Deploy](https://github.com/OWNER/REPO/actions/workflows/deploy-web.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/deploy-web.yml)
```

## Important Notes

- Do not push mutable `latest` tags as the only tag; always include the SHA tag so deploys are traceable.
- Use `docker/setup-buildx-action` and `cache-from: type=gha` to speed up repeated builds.
- The Helm chart update job should be a no-op (early exit) when there are no changes, to avoid empty commits.
- Keep the application repo and Helm chart repo separate; do not mix chart release state into app commits.
- If multiple environments exist (staging, production), make the target environment explicit in workflow inputs or use separate workflows.

## When to Apply

- When a web application is deployed to Kubernetes via a Helm chart.
- When every merge to `main` should trigger a new deployment.
- When the team wants immutable image references in their Helm chart.
