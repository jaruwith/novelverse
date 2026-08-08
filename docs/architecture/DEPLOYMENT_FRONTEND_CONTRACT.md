# NovelVerse Frontend Deployment Contract

| Item | Value |
|---|---|
| Status | Approved architecture; Deployment A and B implemented and locally validated |
| Coordinated baseline | `v1.4.0-alpha.1` |
| Frontend baseline | `bd3c6c7fab18dc4773900fa73f97659b18ebf4f0` |
| Runtime | Next.js `16.2.12`, React `19.2.4`, Node `>=20.9.0` |
| Deployment target | Azure Container Apps, Next standalone Node server image |
| Non-claim | Workflows are not remotely executed yet; no registry or cloud deployment exists |

## Purpose

This contract binds frontend build, configuration, promotion, ingress, health,
security, and observability behavior to the Backend
[Deployment Architecture](../../../NovelVerseApi/docs/architecture/DEPLOYMENT_ARCHITECTURE.md).
It does not authorize application source, package, pipeline, or infrastructure
changes.

## Current source truth

- `npm run build` creates the production application and `npm run start` serves
  it as a Node process. Dynamic routes mean NovelVerse is not a static export.
- `next.config.ts` retains the approved redirects and enables
  `output: "standalone"`.
- Next `16.2.12` declares Node `>=20.9.0`. The image must pin a supported Node LTS
  that satisfies the installed Next version and be revalidated on upgrades.
- `NEXT_PUBLIC_API_BASE_URL` is an optional local HTTP(S) origin documented as
  `http://localhost:5039` in `.env.example`. An absent value produces relative
  `/api` requests; the Docker context excludes `.env*`. It is public build-time
  configuration and must never contain a credential.
- `.env.local`, `.next`, coverage, Playwright reports, traces, and test results are
  ignored development artifacts. None enters an image or deployment artifact.
- The frontend has no required durable writable filesystem and no server-side
  secret at this baseline. Authentication material remains browser session state
  according to the existing application contract, not a deployment secret.

## Immutable environment strategy

One image per environment is rejected because it rebuilds different client bytes
after validation. The binding design is same-origin API routing:

```text
Browser -> https://<environment-frontend>/...
        -> https://<environment-frontend>/api/v1/... -> Backend service
```

Production client code uses relative `/api` paths. The trusted ingress routes the
path-separated `/api` prefix to the ASP.NET service and every other application
route to Next through the ACA environment custom-domain rule configuration. It
preserves `/api/v1/...` and evaluates the API route before the default route. One
signed image digest is promoted from Development to Staging/Beta to Production.
Local development retains an explicit absolute base from ignored `.env.local`.

If separate origins become a hard requirement, design a schema-validated public
runtime configuration document before implementation. It may expose only an
allow-listed HTTPS API origin and version; it must load before API client
initialization, obey CSP/cache rules, and fail closed. It must not become a
general environment-variable or secret endpoint.

## Image contract

Deployment A used the installed Next 16 documentation to enable standalone
output and validate required files. The image contract remains:

1. install exactly the v3 lockfile with `npm ci` in a dependency stage;
2. run tests/build in CI and copy only standalone output, required `.next/static`,
   and `public` assets to the runtime stage;
3. use a pinned minimal supported Node LTS image and a numeric non-root user;
4. include no repository metadata, source-only fixtures, test browser, package
   manager cache, `.env*`, token, source map unless privately approved, or secret;
5. expose the platform port, receive graceful termination, log to stdout/stderr,
   and avoid durable writes;
6. carry coordinated SemVer, frontend commit, and image digest/provenance labels;
7. be scanned for OS/npm vulnerabilities and signed/attested before promotion.

A read-only root filesystem is preferred after Next cache/temp behavior is
validated. Any required temp directory is bounded ephemeral storage, not durable
application state.

## Runtime and ingress contract

- HTTPS is mandatory outside local development. The edge owns certificates and
  redirects HTTP to HTTPS.
- The public host serves Next and proxies `/api` without rewriting API semantics.
  Forwarded host/protocol/client headers are trusted only from platform proxies.
- API timeouts, status, Problem Details, `Retry-After`, `ETag`, and cache headers
  pass through unchanged. The proxy must not cache authenticated API responses.
- Static hashed assets may be long-cache immutable. HTML and deployment health
  responses use bounded/no stale cache rules appropriate to rollout.
- Exact Backend CORS origins remain configured for supported direct access, but
  normal browser traffic is same-origin.
- Rolling revisions must not mix an HTML shell with missing asset revisions. The
  platform retains old revision assets through the traffic-drain window.

## Health model

The frontend implements minimal `GET /health`. Liveness proves the Node
process/event loop responds and does not depend on
PostgreSQL or the API. Readiness proves the server can render/serve its immutable
assets and becomes false during drain. A normal product page is not a reliable
probe because data/auth behavior can change independently.

External availability monitoring separately verifies a public page, login page,
and a safe API health/readiness path. Probe responses reveal no environment
variables, build paths, stack traces, cookies, or secrets.

## Version skew and promotion

- Frontend and Backend artifacts share coordinated SemVer but retain separate
  immutable digests and repository commits.
- API changes are additive/backward-compatible before frontend consumers depend
  on them. Removed/changed fields require a multi-release deprecation plan.
- A frontend revision must tolerate the documented old/new API overlap during
  rolling deploy. A Backend revision must tolerate the previous frontend during
  rollback.
- Promote the same frontend digest only after Development tests/smoke. Staging/
  Beta and Production change environment routing/secrets, never image contents.
- Post-deploy checks verify image/version, static assets, `/notifications`, login,
  a public Story route, and safe API connectivity without Production fixtures.

## Security contract

- No secret, JWT signing material, cursor key, database credential, private API
  key, or internal hostname appears in `NEXT_PUBLIC_*`, HTML, JavaScript, source
  maps, image labels, or runtime config.
- Use CSP appropriate to current Next assets, HSTS at the trusted edge, MIME
  sniffing protection, referrer policy, frame policy, and secure cookie behavior
  where the Backend sets cookies.
- Production builds run with production error handling. No debug/test/evidence
  endpoint, Playwright, captured token, trace, screenshot, or fixture is shipped.
- Public source maps are disabled unless a separate risk decision approves them;
  private error-monitor upload must strip secrets and use least-privilege access.
- Container runs non-root with minimal filesystem/capabilities. Registry pull,
  build, deploy, and production configuration permissions are separated.
- Dependency, lockfile, and image scans are blocking according to repository
  severity policy; no audit suppression replaces remediation/review.

## Observability and privacy

Emit deployment version/digest, server availability/latency, safe route template,
Node/server errors, client error cohorts, API status/error class, asset failure,
and optional privacy-reviewed Web Vitals. Correlate with a random request/trace ID
that is not an account identifier.

Never emit UserId, email/name, access/refresh token, cookie, notification cursor,
notification message, Comment/Reply body, report/moderator evidence, arbitrary
URL query values, or frontend persisted session content. Error-monitor breadcrumbs
and replay/session-capture products are disabled unless separately privacy and
security approved.

## Environment data and E2E

- Development uses synthetic users/content and local secrets.
- Staging/Beta uses synthetic production-shape fixtures and controlled test
  accounts. A raw Production clone is prohibited.
- Production smoke is non-destructive and does not create arbitrary users/content.
  Full Browser E2E, process failure, and load tests execute in isolated
  non-Production environments.
- Any exceptional Production-derived staging data requires approval and
  irreversible masking before access; credentials, tokens, moderation evidence,
  and account identifiers are excluded.

## CI and CD gates

Pull requests run `npm ci`, `npm test`, lint, typecheck, production build, full and
production npm audits, and whitespace/diff checks. Main repeats clean-checkout
gates and builds/scans/signs the standalone image. Release candidates run the
complete real-stack Browser E2E against the version-aligned Backend; browser
matrix and expensive evidence run when risk/cadence requires them.

CD promotes the exact digest through Development, Staging/Beta, and approved
Production. It records source commit, coordinated tag, SBOM/provenance, scan,
environment configuration revision, health/smoke evidence, operator/approval,
and rollback target. It never rebuilds for an environment.

## Rollback and incident behavior

Frontend rollback shifts traffic to the previous signed immutable image and its
compatible public routing configuration. Old assets remain reachable for the
drain/cache window. Backend schema/API compatibility must be checked before a
frontend-only or coordinated rollback.

Required frontend runbooks cover deployment, rollback/asset mismatch, public
availability, elevated client/server errors, API outage/degraded mode, certificate
or ingress failure, security header/CSP breakage, and source-map/error-monitor
containment. Exact alert thresholds and response times remain operational policy.

## Implementation gates

Deployment A local container and health evidence is recorded in
`docs/development/DEPLOYMENT_A_FRONTEND_CONTAINER.md`. Deployment B CI,
immutable artifact, scan/SBOM/provenance, and release-gate evidence is recorded
in `docs/development/DEPLOYMENT_B_FRONTEND_CI_ARTIFACTS.md`; its first
GitHub-hosted run remains a reviewed commit/merge gate.

Before Beta:

- standalone image and local container proof;
- same-origin API client/routing implementation and cross-version tests;
- liveness/readiness and graceful drain;
- CI/CD, scans/provenance, exact TLS/domain/CORS, privacy-safe monitoring;
- synthetic data and Browser E2E against the deployed stack;
- deploy/rollback/availability runbooks and named owners.

Before Production, additionally:

- multi-replica and asset-drain evidence, approved CSP/source-map policy;
- SLO/alert/on-call ownership, incident and rollback exercise;
- Production data/privacy/security review and coordinated Backend operational
  gates in the Deployment Architecture.

## Next.js source references reviewed

The architecture was checked against the installed Next `16.2.12` documentation:

- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md`

Those sources confirm standalone output produces a minimal runtime server and
that `NEXT_PUBLIC_*` values are frozen into browser bundles at build time. They
must be reread if the pinned Next version changes.
