# Deployment B — Frontend CI and Immutable Artifact Evidence

| Item | Result |
|---|---|
| Baseline | `bd3c6c7fab18dc4773900fa73f97659b18ebf4f0` on `feature/deployment-architecture` |
| Scope | Frontend PR/release CI, immutable image identity, SBOM/scan/provenance, coordinated Browser E2E placement, and manifest contract only |
| Local source validation | PASS |
| Image scan | PASS locally with Trivy `0.73.0`, zero High/Critical findings |
| Remote CI | Not executed; first approved commit/push remains a gate |
| Approval boundary | No registry, ACA/ingress, cloud secret, environment deploy, or Production readiness claim |

## CI event and trust model

GitHub Actions is the only CI system. `frontend-pr.yml` runs secretless source
validation for pull requests to `main`. `frontend-artifacts.yml` builds and
retains the immutable candidate for `main`, coordinated version tags, or an
explicit manual version. `release-browser-e2e.yml` runs the existing complete
real-stack Browser E2E on a coordinated tag or with an explicit public Backend
commit/tag.

PR runs have `contents: read`, cancel only a superseded run for the same PR, and
use no `pull_request_target`, cloud credential, registry password, production
key, privileged token, or OIDC. Artifact runs are not cancelled once active and
add only `id-token: write` plus `attestations: write` for GitHub artifact
provenance. They do not receive `packages: write` because registry publication
is Deployment C.

All third-party actions are pinned to full commit SHAs with reviewed releases in
comments. Node is pinned to `24.18.0`, which satisfies Next `16.2.12`'s
`>=20.9.0` contract. Setup-node's npm cache is keyed from the reviewed v3
lockfile; cached data cannot bypass `npm ci` integrity checks and no privileged
job consumes a PR-written release artifact.

The Dockerfile frontend syntax image and Node dependency/build image are pinned
to the exact digests used in local validation. The human-readable Node version
tag remains beside its digest for intentional upgrade review.

## PR, artifact, and E2E gates

The PR workflow performs `npm ci`, the aggregate `npm test` command, lint,
typecheck, production build, full and production npm audits, component-manifest
contract tests, and the PR-range whitespace check. This preserves the Community
Node evidence runner exactly once through the repository's existing test script.

The artifact workflow repeats source validation from a clean checkout, asserts
that `NEXT_PUBLIC_API_BASE_URL` is absent, builds one Linux/amd64 standalone
image, retains its exact archive, scans the archive, generates SPDX JSON,
creates the component manifest, asks GitHub to attest the retained files, and
uploads the evidence set. It does not publish `latest` or any registry tag.

Complete real-stack Browser E2E is intentionally not in every PR. The release
workflow provisions PostgreSQL 16, checks out the version-aligned public Backend,
runs the dedicated migration executable, starts the Release API plus Frontend,
and executes the existing assertions without a mock fallback. It is required on
coordinated tags and is available manually for a specific Backend ref. Browser
matrices may remain scheduled/manual. Backend process/crash and target-scale
evidence retain their release/manual cadence and semantic-hash trigger rules.

## Immutable image and build-once proof

The canonical image tag is the full 40-character Frontend commit SHA. Promotion
uses the `sha256:` image manifest digest, never a mutable tag or a rebuild. OCI
source, revision, and coordinated-version labels are applied at build.

Local Buildx metadata validation recorded the final loadable single-platform
manifest
`sha256:d67583bb84a736735a33a25894d417f9d8fa79b997a1a358ca418b5f2dad4e97`.
This is local evidence, not a release identity; the workflow records the digest
for its exact future commit and rejects the build if the loaded image ID differs
from the metadata digest before the archive is saved.

`test-deployment-b-build-once.ps1` ran one exact image ID under two different
non-secret deployment-slot environment values. Both route/health smokes passed
without rebuilding and the final scanned image ID remained
`sha256:d67583bb84a736735a33a25894d417f9d8fa79b997a1a358ca418b5f2dad4e97`.
The production browser API base remains relative `/api`, so Development,
Staging/Beta, and Production do not require different client bytes. Deployment C
must supply the ingress path split; it must not replace this with an
environment-specific build argument.

## Runtime-base security refinement

The Deployment A standalone structure and Node version remain unchanged. During
Deployment B's first exact image scan, the `node:24.18.0-bookworm-slim` runtime
base exposed 29 High/Critical OS and bundled npm findings. A Debian 12 distroless
candidate still exposed six High/Critical OpenSSL findings. These were treated
as blockers rather than suppressed.

Only the runtime stage was changed to the exact pinned distroless Node 24 Debian
13 digest
`sha256:fbbdda866ea71aef98c4abece17e3d61fbf820cc2ef3961522caa2478716171a`.
Dependency and build stages remain the pinned Node LTS image; standalone output,
routes, direct Node PID 1 behavior, UID/GID `1000:1000`, port `3000`, read-only
root behavior, and package lock are unchanged. The resulting local image is
approximately 56.55 MiB.

No package was added, removed, upgraded, or downgraded. The distroless runtime
has no package manager or shell, and its exact final archive returned zero
High/Critical OS/library findings.

## SBOM, scan, and provenance

The workflow pins Aqua Security's Trivy Action release `0.35.0` by full SHA and
uses Trivy `0.73.0`. It scans the exact saved image archive and fails on all
fixed or unfixed High/Critical OS or library findings. It also emits SARIF and
an SPDX JSON SBOM. Full and production `npm audit` remain separate source-level
gates.

The locally generated final SBOM contained 74,591 bytes with SHA-256
`D0EBC6414C2DA2CBB152F24D505DC41CD75200680C1CD47E67DF41BC81063DCC`;
the SARIF result contained no High/Critical finding. No advisory is ignored.
This exact offline-archive scanner path is locally executable and requires no
Docker Scout login or invented organization credential.

GitHub's SHA-pinned artifact attestation action will bind workflow/repository
identity to the exact image archive, component manifest, and SBOM without a
long-lived signing key. A local machine cannot issue that hosted identity;
therefore the first remote attestation and retained artifact are explicitly
pending after an approved commit/push.

## Component and coordinated identity

`New-DeploymentComponentManifest.ps1` records coordinated version, repository,
full commit, immutable image digest, exact archive hash, SBOM hash, scan hash,
and workflow run identity. It rejects a tag not equal to the commit, malformed
digest, missing SBOM, missing scan, and invalid version.

Backend's companion tool combines exactly one Backend and one Frontend manifest.
It requires the same coordinated SemVer while retaining the separate repository
commits and image digests, plus the Backend migration artifact identity. Tests
cover the valid contract and mutable tag, malformed digest, and absent SBOM
failures. Deployment C must deploy the referenced digests, not rebuild either
repository.

## Local workflow and security review

Actionlint `1.7.7` accepted all three Frontend workflows. Underlying install,
tests, lint, typecheck, build, audits, Buildx archive/digest creation, Trivy scan,
SPDX generation, component-manifest tests, build-once proof, and container smoke
all run locally. The E2E workflow's Linux path uses no Windows-only PowerShell
or local user-secret dependency; its first hosted coordinated run remains
pending and is not reported as green.

Security review results after the runtime-base fix:

- Critical: 0.
- High: 0.
- Medium: 0.
- Low: 0.
- Informational: hosted workflow, artifact retention, and GitHub attestation
  evidence await the first approved commit/push.

No privileged untrusted checkout, PR metadata shell interpolation, build secret,
floating action, broad token permission, mutable deployment identity, scanner
bypass, environment-specific API build argument, source/test artifact, or
production secret was found in the final design.

## Remaining boundaries

Deployment B is locally implementation-complete but still requires independent
review of the cumulative dirty inventory and a first remote CI run after an
approved commit/push. Deployment C owns ACR/ACA publication, same-origin ingress
and TLS, Key Vault/Managed Identity, environment configuration, monitoring,
durable media, and deployed-stack Beta evidence. No cloud deployment or Beta/
Production readiness is claimed.
