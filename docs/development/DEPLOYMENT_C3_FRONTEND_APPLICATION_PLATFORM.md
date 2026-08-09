# Deployment C3 Frontend Application Platform Evidence

Deployment C3 keeps the Frontend source, dependencies, Dockerfile, and relative
API behavior unchanged at baseline `f96a38c78e006b0395d8da0ca92791cf26e78008`.
Shared infrastructure remains owned by `NovelVerseApi/infra`.

The C3 Frontend Container App contract deploys the exact canonical ACR
`novelverse-web@sha256:<64 lowercase hex>` identity with the pull-only C2 user-
assigned identity. It runs the Deployment A standalone Node server on port 3000,
uses `/health` for liveness/readiness, receives no secret and no
`NEXT_PUBLIC_API_BASE_URL`, uses HTTPS-only external ACA ingress, and has bounded
one-to-two Development/Beta replicas independently of the fixed 1/1 API.
Its revision and the environment route remain disabled until both the migration
gate and the separately observed API-readiness gate are approved.

The environment-scoped stable ACA route evaluates `/api` first without rewriting
and `/` second. As a result, `/health`, `/`, `/login`, and `/notifications` reach
the Frontend while `/api/v1/...` reaches the API on the same public origin. A
temporary local validation router proves this split without becoming a
Production proxy. Custom domain/certificate values remain empty placeholders;
no DNS, certificate, secret, Azure resource, apply, commit, or release action is
part of C3.

See the Backend
`docs/development/DEPLOYMENT_C3_APPLICATION_PLATFORM_FOUNDATION.md` for durable
media, ingress exposure, secret, migration, rollout/rollback, provider, and
validation details. Deployed-stack browser E2E and promotion/rollback exercise
remain Deployment C4.
