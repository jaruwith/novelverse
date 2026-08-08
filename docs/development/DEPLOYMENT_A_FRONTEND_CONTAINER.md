# Deployment A — Frontend Container Evidence

| Item | Result |
|---|---|
| Baseline | `bd3c6c7fab18dc4773900fa73f97659b18ebf4f0` on `feature/deployment-architecture` |
| Scope | Next standalone image, same-origin API boundary, health, and local proof only |
| Docker build | PASS |
| Runtime | PASS as UID/GID `1000:1000`, internal port `3000`, read-only root filesystem |
| Routes | `/health`, `/`, `/login`, `/notifications`, public Story, reader route all HTTP 200 |
| Approval boundary | Not a Development/Beta cloud deployment or Production readiness approval |

## Standalone image

`next.config.ts` now sets `output: "standalone"` according to the installed Next
`16.2.12` documentation. The multi-stage `Dockerfile` pins
`node:24.18.0-bookworm-slim`, resolved during proof to
`sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d`.
It installs the v3 lockfile with `npm ci`, builds once, and copies only:

- `.next/standalone`;
- `.next/static`;
- `public`.

The runtime launches `node server.js` directly as PID 1, listens on `3000`, and
runs as numeric user/group `1000:1000`. The initial uncached proof transferred a
925.55 kB context and completed in 41.364 seconds including the base-image pull.
A second no-cache application build completed in 26.585 seconds. The final local
image was approximately 80.74 MB.

Runtime inspection found no `.ts`, `.tsx`, `.env*`, `.git`, Vitest, Playwright,
TypeScript, or ESLint package in `/app`. It found no `localhost:5039` string in
the standalone runtime. Image history has no public configuration build argument,
credential, or secret. The container was unprivileged, had no added capability,
host bind, Docker socket, or host-network requirement, and served successfully
with a read-only root plus bounded `/tmp` tmpfs.

## Same-origin API boundary

The API URL resolver now has two explicit modes:

1. absent/blank `NEXT_PUBLIC_API_BASE_URL` produces root-relative `/api/...`
   browser requests for the immutable promoted container;
2. an explicit HTTP(S) origin without credentials, path, query, or fragment
   supports ignored local `.env.local` development configuration.

API resource URLs remain root-relative in deployed mode, so images/media use the
same ingress origin. Unsafe or ambiguous bases fail instead of silently falling
back. The comic editor uses the same resolver; no second localhost fallback
remains. `.dockerignore` excludes every `.env*` file, so the image build cannot
capture the developer's `.env.local`. The checked-in `.env.example` remains a
local-development example and is not needed by the build.

Deployment A proves generated requests are relative, container output contains
no absolute local Backend, and direct Backend endpoints remain reachable. The
actual path split that forwards `/api` to the API is intentionally not invented
as a Next proxy or Compose service: ACA ingress, TLS, forwarded headers, exact
CORS/direct-access policy, and end-to-end routed auth smoke remain Deployment C.
Normal same-origin traffic does not require CORS.

## Health and runtime

`GET /health` is a force-dynamic, dependency-free Next route returning only
`{ "status": "Healthy" }` with `Cache-Control: no-store`. It has no API,
PostgreSQL, authentication, environment, or filesystem dependency.

The standalone server returned HTTP 200 for:

- `/health`;
- `/`;
- `/login`;
- `/notifications`;
- `/story/library-after-rain`;
- `/story/library-after-rain/chapter/1`.

SIGTERM stopped direct Node PID 1 in 0.265 seconds with the expected signal exit
143, no OOM kill, orphan, or forced timeout. The application has no durable
writable filesystem requirement at this baseline.

## Validation and reproducibility

- Deployment/API-base focused run: 23/23 PASS.
- Vitest: 272/272 PASS, zero skipped.
- Community Node evidence: 4/4 PASS exactly once.
- Aggregate frontend executable tests: 276/276 PASS.
- ESLint: PASS.
- TypeScript: PASS.
- Next production/standalone build: PASS; `/health` and `/notifications` present.
- `npm audit`: zero vulnerabilities.
- `npm audit --omit=dev`: zero vulnerabilities.
- Container build, runtime, representative route, and smoke automation: PASS.

Two clean builds retained the same Next package hash/version and dependency lock,
but Next generated a different `.next/BUILD_ID`; therefore the complete standalone
tree and image digest differed. This is an honest build-system reproducibility
limit, not environment-specific configuration drift. Deployment B must build an
immutable image once, record its digest/provenance, and promote that exact digest
instead of rebuilding per environment.

Docker Scout `1.23.1` was present but required Docker authentication and did not
produce a CVE report. No scanner was installed or advisory suppressed. An
authenticated image scan plus retained SBOM/provenance is a Deployment B gate.
The repository-level full and production npm audits remain clean.

Deployment B subsequently scanned the exact runtime archive. The original slim
runtime exposed High/Critical base and bundled-tool findings, so the runtime
stage alone moved to an exact pinned distroless Node 24 Debian 13 digest. The
standalone application, Node version, port, UID/GID, package lock, read-only-root
behavior, and Deployment A route evidence remain unchanged. The final image is
smaller and the exact archive has zero High/Critical Trivy findings; details are
preserved in `DEPLOYMENT_B_FRONTEND_CI_ARTIFACTS.md` rather than rewriting this
document's historical A measurements.

## Independent Deployment A review

Critical 0, High 0, Medium 0, Low 0.

Informational/accepted boundaries:

- Next build IDs are nondeterministic across independent builds; same-digest
  promotion is required;
- the official slim runtime includes base-image tooling, but no application dev
  dependency or source tree is shipped;
- same-origin routing requires the approved Deployment C ingress;
- authenticated image scanning is not available in this local session.

No Frontend Deployment A blocker remains. Deployment B may implement CI,
artifact identity, authenticated scans/SBOM/provenance, and immutable promotion.
