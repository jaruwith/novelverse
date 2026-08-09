# Deployment C4 Frontend Beta Validation Foundation

Date: 2026-08-09

The Frontend remains on `feature/deployment-platform` at baseline
`f96a38c78e006b0395d8da0ca92791cf26e78008`. C4 adds only the deployed Browser
E2E runner and this evidence; no Next application source, dependency,
`package.json`, lockfile, Dockerfile, or existing workflow changed.

`scripts/test-deployed-beta.mjs` follows the installed Next 16.2.12 standalone,
runtime-environment, and deployment contracts. It does not add a browser
telemetry SDK or expose environment configuration through `NEXT_PUBLIC_*`.
Frontend operational visibility remains ACA server/platform health, public
`/health`, deployed smoke, and privacy-safe Browser E2E. Client replay/session
capture and Product analytics remain outside C4.

The runner has no local process, localhost API, direct database, development
endpoint, or mock fallback. It requires explicit Beta identity, the exact
approved non-Production HTTPS origin root on the default port, a coordinated release already verified
against promoted ACR digests, a protected synthetic Beta actor, and a real
synthetic public Story fixture.

It validates same-origin API readiness, anonymous Story API/page rendering,
login, authenticated `/notifications`, and absence of a mock fallback. It does
not create an actor or retain screenshots/traces. Media write/read/delete cleanup
is owned by the Backend deployed-smoke script.

Local syntax and configuration validation pass, including rejection of a
Production-like hostname. Full deployed Browser E2E remains pending because no
approved subscription, resource group, region, ACR/ACA binding, hostname,
promoted release, OIDC authorization, or deployed Beta stack exists. No Azure
resource was created and no Production target is accepted.

Production still requires Deployment D approvals, Production-specific
non-destructive smoke, on-call/SLO ownership, multi-revision asset-drain proof,
security/privacy review, and explicit Production authorization.

## Reviewed Git closure and hosted PR validation

Git closure on 2026-08-09 created Frontend PR
[`#10`](https://github.com/jaruwith/novelverse/pull/10). The reviewed Deployment C
commit was `c2f1efbf7005af9cd17f22b241572ffa6261893c`; no merge, tag, release,
Azure workflow dispatch, cloud mutation, or Production target occurred.

Initial hosted run `31306605577` passed. Follow-up commit
`59677ad0106b3598ef52c21c72ade47f1525dee3` added the missing hosted actionlint
and deployed-Beta configuration gates. Run `31307141781` passed on GitHub Actions
Ubuntu 24.04 in 1m06s with:

- actionlint 1.7.7;
- exact Beta/HTTPS/hostname/coordinated-release configuration validation;
- 272 Vitest tests plus four Node evidence tests (276 total);
- lint, typecheck, and Next.js 16.2.12 production build;
- full and production-only npm audits with zero vulnerabilities;
- artifact manifest and PR whitespace checks.

The validation used only the non-deployable `beta.example.invalid` identity and
configuration-only mode. No browser contacted Beta or Production, no token was
provided, and no Azure/OIDC/deployment workflow ran. **AZURE BETA APPLY NOT
AUTHORIZED.**
