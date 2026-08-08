# Notifications v1 final frontend evidence

Date: 2026-08-08
Release baseline: `v1.3.0-alpha.1`
Review branch: `feature/notifications-architecture`
Starting HEAD: `385a1bc960beee1111c7709a5da5db286da0d2ba`

This is cumulative Notifications C evidence. It preserves the Notifications B and
dependency-remediation history and does not claim Production approval.

## Contract and implementation alignment

The authenticated global bell, exact confirmed unread count, canonical
`/notifications` route, All/Unread server filters, opaque keyset Load More, mark-one,
server-cutoff mark-all, safe typed deep links, polling/focus refresh, session
generations, accessibility, and mobile layout remain aligned with the runtime API and
frontend contract. `/following` remains a distinct Following page. There is no
Notification dropdown, realtime channel, preferences, grouping, dismissal, or mock
fallback.

Strict parsers reject unknown schemas/enums, invalid UUID/timestamps/read state,
unexpected private IDs, unsafe routes, malformed projections, and contradictory page
state. All private state is in memory and is invalidated synchronously on logout or
session generation change. Notification IDs, cursors, counts, feed rows, and errors are
not persisted in `localStorage`, `sessionStorage`, or IndexedDB.

Production-source search found no mock Notification array, demo Notification,
persisted Notification state, or API-failure fallback. The existing application auth
storage and `MockRoleSwitcher` are unrelated shell/auth development mechanisms; they
are not Notification data sources. `mockFallbackDetected` remained false in real-stack
browser evidence.

## Fresh static and automated evidence

- focused Notifications feature/evidence tests: 53/53 PASS. The documented B count of
  54 also includes the shared authenticated-client session event test.
- full `npm test`: 272/272 PASS: Vitest 268/268 and Community Node evidence 4/4.
- skipped tests: zero.
- lint: PASS.
- typecheck: PASS.
- Next.js 16.2.12 production build: PASS, 122 routes including `/notifications`.
- full `npm audit`: zero vulnerabilities.
- production-only `npm audit --omit=dev`: zero vulnerabilities.
- the two Notifications B security-resolution overrides remain
  `brace-expansion@5.0.9` and `js-yaml@4.3.1`. The pre-existing baseline overrides
  for `minimatch`, `postcss`, and `sharp` also remain unchanged; React, Next,
  TypeScript, Vitest, Playwright, direct runtime dependencies, and lockfile version
  did not drift.

The full test command still runs Vitest once and the Community Node evidence suite
once, propagates either runner's failure, and returns success only when both pass.

## Browser evidence and harness history

The real-stack harness uses PostgreSQL, the Release API and API-hosted worker, Next.js,
real JWT sessions, and real producer mutations. It verifies producer-to-outbox-to-worker
to UI behavior, polling/focus, All/Unread, pagination, mark-one, mark-all and post-cutoff
arrival, safe/unavailable targets, anonymized actor, logout and A-to-B isolation, 401,
429/Retry-After, desktop, and 390 by 844 mobile behavior.

Notifications C intentionally preserves failed validation history. Intermittent runs
exposed three harness ownership/synchronization defects rather than product changes:

1. the Notifications poll proof did not explicitly bring its page to the foreground;
2. the anonymization wait accepted all event types before waiting for the anonymized
   row;
3. the Social 401 DELETE assertion could race the global invalid-token unread poll and
   used an automation click that was not reliably observed by the response waiter.

The harness now brings the page forward and asserts visible state, waits specifically
for the null-actor producer row, aborts only unread-count during the isolated Social
401 assertion, and triggers the real React handler with a DOM click. No response is
mocked and no product source changed. After the process-evidence closure, the first
complete run passed in 121.5 seconds; its Notifications portion took 41.094 seconds,
worker waits were 2074 / 1534 / 4 / 1195 ms, Retry-After was 59 seconds, and no fixed
rate-limit sleep was needed. The immediately following run passed in 109.7 seconds;
its Notifications portion took 39.474 seconds, worker waits were
1536 / 1535 / 4 / 524 ms, Retry-After was 59 seconds, and no fixed rate-limit sleep
was needed. These are two consecutive complete passes against the Release API built
with the default-disabled evidence seam.

Every successful corrected run reported:

- `notificationBellVerified: true`
- `notificationPollingVerified: true`
- `notificationReadStateVerified: true`
- `notificationSessionIsolationVerified: true`
- `notificationProducerFlowVerified: true`
- `notificationAccessibilityVerified: true`
- `mockFallbackDetected: false`

## Security review

No Critical, High, Medium, or Low frontend security defect was found. Typed route
resolution rejects external, protocol-relative, JavaScript/data, query-bearing,
double-encoded, control-character, and malformed route values. React renders only
plain projections. Private payloads, moderator identity/note/evidence, User IDs, and
raw Problem Details are not rendered. Generation ownership prevents late User A feed,
poll, Load More, mark-one, or mark-all callbacks from affecting User B.

The backend Release-process suite now independently proves hosted-worker ownership,
crash recovery, cross-process cursors, read/privacy concurrency, and all four HTTP
limiters. These are intentionally not presented as browser assertions and no new
browser summary flags were added. The six existing Notification flags continue to
describe browser-observed behavior only.

## Dependency-remediation history

Notifications B originally failed because High development-tooling advisories reached
`brace-expansion` through lint `minimatch` consumers and `js-yaml` through ESLint
configuration parsing. Production audit was already clean. The narrow compatible patch
overrides to 5.0.9 and 4.3.1 removed all findings without a major upgrade, added or
removed package, runtime graph change, or product compatibility edit. Fresh C audits
remain at zero.

The subsequent Independent Final Review made a fresh advisory query and failed only
the dependency-security gate because `GHSA-2v37-7h3g-55p8` had newly surfaced for
`nanoid@3.3.16`. The production-relevant path was root -> `next@16.2.12` -> the
existing `postcss@8.5.23` override -> `nanoid@3.3.16`; the same deduplicated PostCSS
node is also used by Vite. Both full and production-only audits reported one High
finding (`nanoid <3.3.17`). No package or lockfile change was made during that review.

The dependency-only closure selected `nanoid@3.3.17`, a compatible patch already
permitted by PostCSS's `^3.3.16` range. `package.json` did not change. The lockfile v3
change is exactly three removed and three added lines for the nanoid version, registry
tarball, and integrity hash; no direct dependency, dev dependency, parent package,
package count, install script, or native binary changed. Next.js stayed 16.2.12 and
PostCSS stayed 8.5.23. An isolated physical copy passed `npm ci` without lockfile
mutation, `npm ls --all`, CommonJS and ESM nanoid API checks, and both audits. The
resolved tree contains only nanoid 3.3.17, and both full and production-only audits
now report zero vulnerabilities.

Fresh active-tree validation passed `npm test` 272/272 (Vitest 268/268 once plus
Community Node evidence 4/4 once), focused Notifications 53/53, lint, typecheck, and
the 122-route production build including `/notifications`. One complete real-stack
Browser E2E run passed in 112 seconds; its Notifications portion took 39.297 seconds,
all six `notification*Verified` flags were true, and `mockFallbackDetected` was false.

## Decision

The frontend implementation and cumulative browser/static evidence are green, the
separate process-evidence blockers remain closed, and the newly surfaced nanoid gate
is now closed. This evidence permits Independent Final Approval to be rerun; it does
not itself grant that approval or local-commit approval. This is not a
Production-readiness claim; the separately owned Beta and Production operational
gates remain open.
