# Notifications Frontend Contract

- Status: Implemented by Notifications B; two consecutive real-stack Browser E2E runs passed
- Baseline: `v1.3.0-alpha.1`
- Scope: Notifications v1 frontend contract implemented; Notifications C process evidence is closed and independent final approval awaits remediation/re-review
- Backend authority: `NovelVerseApi/docs/architecture/NOTIFICATIONS_ARCHITECTURE.md`

## Purpose and boundaries

Notifications v1 is a private in-app inbox for the backend-approved, low-fan-out
event set. The frontend renders only server-materialized Notifications and
server-owned read state. It does not infer recipients, create local Notification
rows, poll domain APIs as a mock feed, or persist private payloads in the browser.

V1 includes a global authenticated bell, exact unread badge, dedicated
`/notifications` page, keyset pagination, unread filtering, mark-one and mark-all
read behavior, focus-aware polling, session isolation, and safe deep links.

V1 does not include dropdown preview, email/push/SMS, user preferences, grouped
actors, dismissal, mark-unread, realtime delivery, service-worker caching, or a
mock fallback.

## Backend contract consumed

Authenticated APIs:

- `GET /api/v1/notifications?filter=ALL|UNREAD&pageSize=20&cursor=...`;
- `GET /api/v1/notifications/unread-count`;
- `PUT /api/v1/notifications/{notificationId}/read`;
- `PUT /api/v1/notifications/read-all`.

No request sends a User ID. Reads and mutations use the centralized typed API,
refresh rotation, session invalidation, Problem Details handling, and
`cache: "no-store"`. Responses are parsed strictly and rejected when enums,
UUIDs, timestamps, relative routes, actor/outcome combinations, read state, or
cursor continuation are malformed.

The item projection contains only:

- Notification UUID;
- closed Notification type;
- nullable safe actor display projection without User ID;
- nullable target title and server-built relative route;
- nullable closed moderation/report outcome;
- `createdAt` and nullable `readAt`.

No Comment body, report evidence/category, internal note/reason, moderator or
reporter identity, target lifecycle reason, token, email, arbitrary HTML, or
caller-supplied route is accepted or rendered.

## Information architecture

### Global bell

The bell is added to both desktop and mobile authenticated navigation in the
real `GlobalHeader`. Creator/member shells may link to the same route but do not
own a separate unread state. Anonymous navigation has no badge and links to the
safe sign-in flow only when the product chooses to show a disabled bell.

The badge uses the exact server count. Visual text may cap at `99+`; the
accessible name announces the exact count. Zero renders no numeric badge while
the bell remains labelled. Badge color is not the sole unread indicator.

### Dedicated page

The canonical route is `/notifications`. V1 deliberately has no dropdown
preview: a second virtualized/paginated surface would duplicate state,
accessibility, polling, and reconciliation logic without a product need.

The page contains:

- `All` and `Unread` filters;
- semantic heading and list/articles;
- newest-first server order;
- bounded Load More;
- loading, empty, retained-data retry, and terminal-session states;
- per-item unread text/state and timestamp;
- an explicit Mark all as read action;
- safe target links when a route is present.

There is no total, page number, ranking, infinite automatic fetch, actor User ID,
or Notification body editor.

## Legacy `/following`

`/following` is retained as a distinct followed-content/latest-update experience.
It is not redirected to, repurposed as, or used as a fallback for
`/notifications`. During implementation its current mock status must remain
clearly isolated from Notifications evidence, and wording that it replaces a
notification center must be removed or corrected. Replacing the Following mock
with a real followed-content API is a separate scope.

## Display contracts

Frontend copy is selected from the closed Notification type/outcome enums and
safe parameters. It never interprets Markdown or HTML and never uses
`dangerouslySetInnerHTML`. Null actor display renders a neutral “NovelVerse
member” equivalent. Moderation copy is generic, for example that a report was
resolved or content visibility changed; it never names the moderator or exposes
reason/evidence.

The target route must be a server-provided relative application route that passes
the strict route parser. Schemes, protocol-relative forms, encoded control
characters, backslashes, and unexpected route families are rejected. The client
does not concatenate a target ID or display string into a route.

The allowlist is exactly `/stories/{creatorSlug}/{storySlug}` and the NOVEL,
COMIC, and VIDEO readers `/read-novel/...`, `/read-comic/...`, and
`/watch-video/...`, each with an optional `#comment-{uuid}` anchor. Segments are
already single-encoded by the server and are not encoded again. Profile, admin,
moderator, arbitrary-query, absolute, and legacy/mock route families are rejected.
The Follow type intentionally has no link because no real public follower-profile
route exists at this baseline.

If a target was later hidden, deleted, archived, or privacy-unlinked, navigation
uses the existing generic unavailable/404 behavior. The item remains neutral and
readable, does not reveal why the target disappeared, and does not expose a stale
body snapshot.

## Controller and session ownership

A Notifications controller hook owns:

- authenticated session generation;
- filter, root pages and cursor;
- page and unread-count request IDs/AbortControllers;
- exact unread count;
- polling/backoff state;
- per-item mark pending state and one mark-all scope;
- server-confirmed reconciliation and restrained announcements.

Visual components remain separate: `NotificationBell`, `NotificationsPage`,
`NotificationList`, `NotificationItem`, filter/load controls and empty/error
states. The global bell and page share a provider/controller scoped to the
authenticated application shell, not a module-global payload cache.

Logout, terminal 401, same-user re-login, A-to-B account switch, and provider
unmount synchronously abort requests, increment/invalidate the session generation,
clear all items/count/cursors/pending state, and prevent stale success/error/finally
callbacks. Anonymous state is empty rather than a prior user's cached inbox.

The provider listens to both the centralized in-tab session event and the browser
`storage` event for the existing authentication keys. A logout/account change in
another tab therefore advances the local generation and clears Notification state;
the event never copies token values into Notification state or logs.

No Notification payload, count, cursor, read state or error is stored in
localStorage, sessionStorage, IndexedDB, Cache Storage, URL query beyond the
nonsecret filter/cursor, service workers, or a cross-session module global.
Existing centralized authentication token storage is unchanged and is not a
Notification cache.

## Polling decision

The unread count is fetched immediately for an authenticated session and every
30 seconds while the document is visible and online. It is the only fixed poll.
The feed loads on `/notifications` mount and refreshes its first page on explicit
Retry/Refresh or a focus/visibility return when at least 15 seconds have elapsed;
it does not run a separate 30-second timer. Polling pauses while hidden or offline.

Failures retain confirmed count/items and back off with jitter through 30, 60,
120 and 300 seconds. Success resets the interval. `Retry-After` takes precedence
when browser-readable. A terminal 401 uses centralized session invalidation;
403 shows account ineligibility without retaining private state.

Each count/feed scope permits one request in flight. A timer/focus/manual trigger
coalesces while that scope is busy rather than overlapping; request IDs,
AbortController and session generation reject stale completion. Feed and count
have independent backoff so a feed failure does not accelerate count polling.
The maximum backoff is 300 seconds and any successful request resets only its own
scope.

Each tab polls independently in v1. No BroadcastChannel or browser lease is
introduced because it can cross session boundaries and adds coordination risk;
the unread rate limit is sized for ordinary multiple-tab use. Duplicate polling
does not duplicate server Notifications. Realtime, SSE, long polling, SignalR
and WebSocket are deferred.

After mark-one/mark-all receives server 204, the page treats read state as
server-confirmed, refreshes unread count, and authoritatively reloads the affected
first page before presenting a timestamp it did not receive. Other local domain mutations do not
optimistically manufacture recipient notifications; included interpersonal
events normally target another account.

## Read interactions

Loading or viewing the list does not mark an item read. Activating a target
issues the idempotent mark-one request and then navigates after the bounded
attempt. A failed mark retains the confirmed unread state; it does not block
access to an otherwise safe target indefinitely. A separate keyboard-accessible
Mark read action is available when no route exists.

Mark-all is disabled while its request is pending, suppresses duplicates, and
updates rows/count only after 204. Notifications committed concurrently after
the server statement may remain unread and appear on the next poll. There is no
optimistic decrement or fabricated `ReadAt`.

404 for mark-one removes or authoritatively refetches the item without revealing
another recipient. 429 preserves state and announces retry later. Network/5xx
preserve confirmed pages and offer retry. A cursor 400 resets only through an
explicit authoritative first-page request; it never discards confirmed pages on
an incremental failure.

## Pagination

The default page size is 20 and maximum is 50. `All` and `Unread` have independent
target-bound generations; switching filter clears old pages/cursor and starts a
new request. Load More appends in server order with ID deduplication, preserves
prior rows on failure, and retries the same cursor. No automatic unbounded scroll
or total/page number exists.

Polling unread count does not refetch the entire list. While the page is open, a
manual/visibility refresh fetches the first page and reconciles by server ID
without reordering loaded historical pages incorrectly. New source-time rows are
inserted according to the returned first page; delayed old events appear only
where authoritative pagination places them.

## Accessibility

Required executable behavior:

- labelled bell and exact unread accessible name;
- semantic page heading, list and Notification articles;
- author/outcome/status text rather than color-only meaning;
- accessible timestamps;
- `aria-busy` only while the relevant region is loading;
- keyboard-operable filters, Load More, read actions and target links;
- focus moves to the page heading on navigation and remains stable during polls;
- after an item disappears from the Unread filter, focus moves to the next item,
  previous item, or list heading fallback;
- restrained live announcements for explicit mark/load/retry outcomes, never
  every background poll;
- mobile bell/navigation and page order without horizontal overflow.

## Rate and cache behavior

The client respects provisional backend limits: feed 60/minute, count 120/minute,
mark-one 60/minute, mark-all 10/minute. It never loops on 429 and uses exposed
`Retry-After`. All requests are private/no-store; the Next.js server, browser
cache, service worker and module globals cannot cache recipient responses.
The API's dedicated two-second deadline can return 504; this follows the same
retained-confirmed-state/backoff path as a transient 5xx.

## Security invariants

- recipient comes only from the authenticated backend session;
- no client recipient/actor ID or self-suppression decision;
- strict plain-text rendering and strict relative-route parser;
- no body/evidence/reason in logs, analytics, labels, titles or error telemetry;
- server-confirmed read/count state only;
- request/session generations reject stale callbacks;
- no private browser persistence or mock fallback;
- hidden/deleted targets and other-user Notification IDs remain generically
  concealed;
- multiple tabs cannot make server read state or dedupe diverge.

## Test plan

Focused tests cover strict parser enums/UUID/timestamps/routes, null actor,
moderation wording, page cursor/dedupe, initial count, polling visibility/focus,
overlap coalescing, independent backoff/Retry-After, mark-one/all,
400/401/403/404/429/5xx/504, cursor-key restart, filter switches, incremental
retry, in-tab and cross-tab A-to-B/session/logout stale callbacks, route-family
rejection, no persistence/mock, semantic markup, focus fallback, live regions,
and mobile navigation.

Real-stack E2E uses actual PostgreSQL/API/frontend/JWTs and proves two-user Reply,
Comment Like, creator Comment, Follow, report outcome and Hide/Restore outcome;
exact badge; reload/cross-device read state; mark all; account switch; deleted
target; privacy unlink; retry duplicate prevention; no Notification for Story
Like/Bookmark/Reader progress/Episode publication; and `mockFallbackDetected:
false`.

## Delivery phases and gates

Notifications A1 must finish the delivery core, Reply pilot, worker crash/
multi-instance proof, privacy cleanup, and feed/read contract. Notifications A2
completes Like, creator Comment, Follow and moderation producers plus cumulative
backend evidence. Frontend Notifications B followed A1+A2 approval and delivered
the bell, page, polling, read state, accessibility, mobile behavior, and real-stack
E2E without changing producer policy. Notifications C
is cumulative scale, operational, security and Browser evidence—not a place to
defer worker correctness or privacy cleanup.

Implementation and Notifications B evidence are complete. Beta/Production launch still
requires approved retention/legal-hold rules for inbox/outbox/dead letters,
dead-letter operational ownership/SLA, monitoring thresholds, deployment-shared
cursor secret, and distributed rate limiting when horizontally scaled. Email,
push, preferences, grouping, realtime, and publication fan-out remain separate
future decisions.
