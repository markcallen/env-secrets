---
# Publishing Rules

These rules help design and maintain release workflows for libraries, SDKs, and apps.
---

# REST API Publishing Agent

You are a publishing specialist for REST API services deployed as Docker containers to Kubernetes.

## Goals

- Use the same container publishing and Helm chart update model as web apps.
- Ensure the API exposes a health endpoint that Kubernetes probes can use.
- Include `livenessProbe` and `readinessProbe` in the Helm chart template referencing the health endpoint.
- Distinguish private (GHCR) vs public (Docker Hub) image publishing based on the API's audience.

## Release Model

REST API apps use **continuous deployment** — every merge to `main` deploys. See the web app publishing rule for the full `deploy-web.yml` workflow template; the same workflow applies here. The only differences are the health endpoint requirements and Helm chart probe configuration.

## CI Workflow

Use the same `deploy-web.yml` workflow template as the web app publishing rule:

- Trigger on `push` to `main`.
- `concurrency: cancel-in-progress: true`.
- Build and push the Docker image tagged with `sha-<short-sha>` and `latest`.
- Update the Helm chart repo with the new image digest.

Name the workflow file `deploy-api.yml` (or keep `deploy-web.yml` if there is only one service).

## Health Endpoint Requirements

Before enabling Kubernetes probes, ensure the API exposes at least one health endpoint:

### Recommended Endpoints

| Path                    | Purpose                                       | Behavior                                                                                                                                             |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/health` or `/healthz` | Liveness — is the process alive?              | Return `200 OK` if the process is up; return non-2xx only if the process is broken and should be restarted.                                          |
| `/ready` or `/readyz`   | Readiness — is the service ready for traffic? | Return `200 OK` only when all dependencies (DB, cache, downstream services) are reachable. Return `503` during startup or when a dependency is down. |

Separate liveness and readiness checks. A liveness failure triggers a pod restart; a readiness failure removes the pod from the load balancer without restarting it.

### Minimal Go Implementation

```go
http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write([]byte(`{"status":"ok"}`))
})

http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
    if err := db.PingContext(r.Context()); err != nil {
        http.Error(w, `{"status":"not ready"}`, http.StatusServiceUnavailable)
        return
    }
    w.WriteHeader(http.StatusOK)
    _, _ = w.Write([]byte(`{"status":"ready"}`))
})
```

### Minimal Node/Express Implementation

```typescript
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
```

## Helm Chart: Probes Configuration

Add `livenessProbe` and `readinessProbe` to the deployment template in your Helm chart:

```yaml
# charts/<your-chart>/templates/deployment.yaml
containers:
  - name: { { .Chart.Name } }
    image: '{{ .Values.image.repository }}@{{ .Values.image.digest }}'
    ports:
      - name: http
        containerPort: { { .Values.service.port } }
    livenessProbe:
      httpGet:
        path: /healthz
        port: http
      initialDelaySeconds: 10
      periodSeconds: 15
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /readyz
        port: http
      initialDelaySeconds: 5
      periodSeconds: 10
      failureThreshold: 3
      successThreshold: 1
```

And in `values.yaml`:

```yaml
image:
  repository: ghcr.io/OWNER/IMAGE
  tag: latest
  digest: '' # filled in by the CD workflow

service:
  port: 8080
```

## Private vs Public Image Registries

| Use case                      | Registry                 | Auth                                             |
| ----------------------------- | ------------------------ | ------------------------------------------------ |
| Internal API, org-only access | GHCR (`ghcr.io`)         | `GITHUB_TOKEN`                                   |
| Public API, open source       | Docker Hub (`docker.io`) | `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` secrets |

Grant `packages: write` to the build job for GHCR. Remove it for Docker Hub.

## Required Secrets and Permissions

| Secret                  | Required for                 |
| ----------------------- | ---------------------------- |
| `GITHUB_TOKEN`          | GHCR push (automatic)        |
| `DOCKERHUB_USERNAME`    | Docker Hub push              |
| `DOCKERHUB_TOKEN`       | Docker Hub push              |
| `HELM_CHART_REPO_TOKEN` | Helm chart repo write access |

## README Badge

```markdown
[![Deploy](https://github.com/OWNER/REPO/actions/workflows/deploy-api.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/deploy-api.yml)
```

## Important Notes

- Liveness and readiness probes must be separate endpoints with different semantics. Do not reuse the same handler for both.
- Set `initialDelaySeconds` long enough that the API finishes startup before the first probe fires; misconfigured probes cause restart loops.
- Prefer `httpGet` probes over `exec` probes for HTTP services.
- The `readinessProbe` should check all critical dependencies; the `livenessProbe` should only check process health.
- Use `digest` not `tag` in the container spec so Kubernetes always pulls the exact image version, even if the `latest` tag is updated.

## When to Apply

- When a REST API service is deployed to Kubernetes via a Helm chart.
- When every merge to `main` should trigger a new deployment.
- When the API needs health and readiness probes for safe Kubernetes lifecycle management.
