# Notifications B — Frontend Notification Center

- Baseline: `v1.3.0-alpha.1`
- Status: implementation, real-stack Browser E2E, and dependency-security gate passed
- Canonical route: `/notifications`
- Backend: unchanged Notifications A1/A2 API and worker
- Next phase: Notifications C cumulative final validation

## Delivered behavior

Notifications B adds one private in-memory controller/provider shared by the public
header and member/creator shells. Authenticated users receive a Bell that navigates
directly to `/notifications`; it has no dropdown. Its badge is the exact
server-confirmed unread count, hides at zero, visually caps at `99+`, and retains
the exact count in its accessible name.

The page provides server-side `All` and `Unread` filters, newest-first keyset
`Load More`, ID deduplication, retained rows after incremental failure,
loading/empty/retry states, mark-one on safe target activation, explicit mark-one
for unavailable targets, and mark-all. Mutations accept only the backend `204`,
then reload exact unread count and the authoritative first page; the UI never
fabricates count or `ReadAt` and preserves post-cutoff Notifications.

`/following` remains a separate followed-content surface. Its stale wording that
described it as a Notification-center replacement was corrected; it does not
redirect to or substitute for `/notifications`.

## Runtime contract and safety

The shared authenticated API client consumes only the feed, unread-count,
mark-one, and mark-all endpoints. Runtime items contain `id`, `type`, nullable
`actorDisplayName`, nullable `targetTitle`, nullable `targetRoute`, nullable
`outcome`, `createdAt`, and nullable `readAt`. Strict parsing rejects unknown
fields/enums, invalid UUID/timestamps/read order, private IDs, malformed
actor/outcome projections, cursor/page contradictions, duplicate IDs, and unsafe
routes. Mark endpoints have no body or affected count.

Only `/stories/{creator}/{story}` and `/read-novel`, `/read-comic`, or
`/watch-video` episode routes with an optional `#comment-{uuid}` are navigable.
Segments must already be canonical and single encoded. Absolute, protocol-relative,
query-bearing, unsupported, control-character, backslash, and double-encoded routes
are rejected. Thai and emoji segments are covered. Missing/unavailable targets
render neutral status without an active link; the client never invents a Comment
anchor.

## Polling, session ownership, and errors

Unread count loads immediately and every 30 seconds only while visible and online.
Focus/visibility refreshes stale count/feed after 15 seconds. Requests are
non-overlapping and use AbortController, coalescing, jittered 30/60/120/300-second
backoff, a 300-second cap, success reset, and `Retry-After` precedence. Confirmed
state survives network/5xx/504/429; 403 clears eligible private content and 401
terminates the private session state.

Session and route/filter generations reject late User A, prior login, prior filter,
Load More, poll/focus, mutation, catch, and finally callbacks. Per-ID mark-one and
mark-all ownership are independent and bounded. No Notification payload, ID,
cursor, count, read state, or error is persisted in browser storage or a mock cache.
Existing auth storage remains unchanged; in-tab and cross-tab auth events trigger
generation reset only.

## Rendering, accessibility, and mobile

The closed type/outcome renderer covers Reply, Comment Like, Story Comment,
Episode Comment, Creator Follow, terminal report outcome, Hide, and Restore.
Values render as escaped plain React text—never HTML, Markdown, raw payloads,
evidence, reason/note, moderator identity, private body, or User ID. Null actors
use neutral anonymized copy; read state is textual and timestamps use `time`.

Bell, filters, target/read actions, retry, mark-all, and Load More are named and
keyboard reachable. Async regions use bounded `aria-busy`/status/alert semantics.
Unread removal restores focus to the Notifications heading fallback. Real browser
coverage at 390×844 verifies no horizontal overflow and usable named controls.

## Automated evidence

Focused suites cover parsers, API calls, polling/backoff/visibility/no-overlap,
page/filter/cursor ownership, dedupe/incremental retry, mutation concurrency,
post-cutoff mark-all, logout/A→B/same-user generations, stale callbacks,
route/Unicode security, rendering, Bell/accessibility, and summary-state isolation.

The existing `scripts/test-local-vertical-slice.mjs` creates fresh real users and
Story/Episode content, invokes real Comment/Reply/Like/Follow/report/Hide/Restore
source mutations, and waits for the API-hosted worker. It exercises desktop and
390×844 UI, polling, filters, pagination, read actions, post-cutoff arrival, deep
link, privacy anonymization, logout/A→B/401, real 429 `Retry-After`, and no mock.
Inbox rows are never inserted directly and no public test endpoint was added.

| Run | Total | Notifications | Worker waits (ms) | Rate wait | Retry-After proof |
|---|---:|---:|---|---:|---:|
| 1 | 111.0 s | 40.454 s | 1366 / 1704 / 4 / 2046 | 0 s | 59 s |
| 2 | 109.0 s | 38.200 s | 530 / 1351 / 5 / 355 | 0 s | 59 s |

Both runs returned all six `notification*Verified` flags as `true` and
`mockFallbackDetected: false`.

Focused Notifications B coverage passed 54 tests (53 feature/evidence tests plus
one shared authenticated-client session-event test). The full frontend test
command passed 272/272 checks: 268 Vitest tests and four Community Node evidence
tests. Lint, typecheck, production build, and `git diff --check` passed.

## Dependency-security closure

The original Notifications B validation recorded three High transitive
dev/tooling entries. A fresh advisory query on 2026-08-07 expanded the derived
lint dependency graph to 16 High entries, but they still came from the same two
root advisories:

- `eslint` / `eslint-config-next` → lint plugins and `@typescript-eslint` →
  `minimatch@10.2.5` → `brace-expansion@5.0.8` —
  `GHSA-rgw5-rvv9-x895`;
- `eslint@9.39.5` → `@eslint/eslintrc@3.3.6` → `js-yaml@4.3.0` —
  `GHSA-5p4m-2wfm-xmqj`.

Both paths are development-only lint/configuration tooling and were absent from
the production dependency audit. Severity was nevertheless treated as a release
blocker. The repository already used npm overrides, so the minimal deterministic
remediation was two compatible patch resolutions: `brace-expansion` 5.0.8 →
5.0.9 and `js-yaml` 4.3.0 → 4.3.1. The parent ranges accept those patches;
`minimatch`, ESLint, Next.js, React, TypeScript, Vitest, Playwright, and all runtime
dependencies stayed unchanged. No package was added or removed, no major version
changed, and lockfile version 3 stayed unchanged. The package-lock diff is six
added and six removed lines containing only the two versions, registry tarballs,
and integrity hashes.

An isolated physical copy passed `npm ci` without changing the lockfile, full
`npm audit` with zero findings, and the complete 272/272 test command. Active-repo
validation then passed full and production-only audits with zero findings, focused
Notifications 54/54, Vitest 268/268, Community Node evidence 4/4, lint, typecheck,
and the 122-page production build including `/notifications`.

One complete real-stack Browser E2E run passed in 115.1 seconds. Its Notifications
portion took 39.681 seconds, worker waits were 1539 / 1690 / 4 / 1195 ms, all six
`notification*Verified` flags were true, and `mockFallbackDetected` was false.
No dependency-security blocker remains for Notifications C.

## Limitations and Notifications C

V1 has no dropdown, realtime, cross-tab polling lease, preferences, grouping,
dismissal, email/push/SMS, Story Like/New Episode fan-out, or arbitrary Comment
anchor inference. Loaded rows are bounded at 100.

Notifications C still owns cumulative final release validation, operational and
multi-instance proof, deployment-shared cursor-secret verification, monitoring,
retention/legal-hold and dead-letter ownership decisions, and distributed limiter
readiness. Notifications B does not itself claim Beta/Production approval.
