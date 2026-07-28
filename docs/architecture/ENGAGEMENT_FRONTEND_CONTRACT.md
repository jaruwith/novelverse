# Engagement Frontend Contract

## Status

Architecture proposal for Epic 12B. Epic 12A changes no runtime behavior. This
contract extends the existing typed API client and reader routes; it does not
create a second auth client, mock fallback, analytics SDK, public counter UI, or
tracking error screen.

## Current frontend observations

- Home discovery fetches paged public Stories. A returned result or rendered
  card is not proof of viewport visibility.
- Story Detail fetches public Story and Episodes in parallel. Authenticated
  bookmark state is loaded separately. It has no current view tracking.
- NOVEL loads content blocks, COMIC loads ordered pages, and VIDEO loads provider
  metadata. Each then loads Story metadata and calls authenticated reading
  progress.
- `recordEpisodeProgress` does nothing anonymously, deduplicates React Strict
  Mode/in-flight calls, and intentionally swallows failure so content remains
  readable.
- Bookmark and progress are durable reader state, not telemetry. Library and
  Continue Reading consume those authenticated contracts.
- API access, Bearer tokens, refresh rotation, Problem Details, and session
  clearing are centralized in `src/features/novel-editor/api.ts`.
- The YouTube iframe currently offers no trusted application playback events.
- Browser E2E uses real per-run API fixtures for NOVEL, COMIC, VIDEO, discovery,
  bookmark/progress, moderation, and no-mock assertions.

## User experience decisions

- Reading never waits for or fails because of engagement measurement.
- Tracking errors are silent unless the user must make a privacy/consent choice.
- Epic 12B displays no public Story, Episode, bookmark, like, or follower count.
- No Likes or Creator Follow UI is included; propose those for Epic 12C.
- No discovery impression is collected in 12B.
- No mock or optimistic final counter is shown.

## Tracker boundary

Create one reusable client-only engagement tracker behind the typed API client,
not separate logic in each reader. Suggested non-production shape:

```text
features/engagement/
  api.ts or typed calls in the shared API module
  EngagementSessionController.ts
  useStoryDetailEngagement.ts
  useEpisodeEngagement.ts
  novelEvidence.ts
  comicEvidence.ts
  videoEvidence.ts
  scheduler.ts
```

The controller owns session start, activity schedule, visibility/idle state,
retry, and teardown. Type adapters produce bounded evidence only. Backend rules
remain authoritative.

## Start conditions

### Story Detail

Start after:

1. `getPublicStory` succeeds;
2. React has committed the Story detail;
3. the document is visible;
4. the effect is still active for the same Story.

Do not start for server prefetch, discovery cards, failed detail, hidden content,
or an effect cleaned up before render.

### Episode

Start after the type-specific content representation successfully renders:

- NOVEL: content block response is present and renderer committed;
- COMIC: page response is present and at least the Episode container committed;
- VIDEO: video metadata and iframe container committed.

The Story and Episode IDs come from backend responses. The tracker never parses
an ID from a slug or asks the user for one.

## Session idempotency

Generate a cryptographically random UUID as the `Idempotency-Key`. Store the
current target key and returned session metadata in `sessionStorage`, scoped to
the exact route target. A browser refresh reuses that key; ordinary navigation
to another target creates a new key. React Strict Mode observes the same
in-flight promise/controller and does not send a second start.

The server may return an existing session for a viewer/target deduplication
window. The client uses the returned `sessionId` and never increments a local
count.

Each activity/end request has a new UUID and stable canonical payload for retry.
An offline/network retry reuses the UUID. A 409 for key/payload mismatch is not
retried with altered data; the controller discards that local fact and
resynchronizes session state if the server provides a safe path.

## Anonymous identity

The anonymous subject is a server-protected `Secure`, `HttpOnly`,
`SameSite=Lax`, 30-day absolute cookie. JavaScript never reads or writes it.
Engagement requests use `credentials: "include"` so the API can issue/resolve
it. The shared product API remains the only network boundary.

Deployment requirements:

- exact configured first-party CORS origins;
- credential support only for engagement requests that need the cookie;
- TLS and compatible app/API site topology;
- server Origin validation;
- no token or viewer key in URL, localStorage, logs, screenshots, or tests.

Do not fall back to a localStorage fingerprint if cookies are unavailable.
Measurement may be absent or treated as a new bounded anonymous subject; reading
continues.

## Login and logout transitions

- A valid shared Bearer token takes precedence over the anonymous cookie.
- Do not submit `UserId`, role, creator, or anonymous ID.
- Anonymous history is not merged after login.
- End the old session best-effort when auth identity changes, then start a new
  session on the next eligible render/activity.
- Logout uses the existing shared session-clearing flow. Do not copy auth tokens
  into the engagement controller.
- The anonymous cookie may remain independently until its expiry.

## Heartbeat state machine

```text
IDLE
  └─ successful visible render ─> STARTING
STARTING
  ├─ accepted/replayed ─> ACTIVE
  ├─ unavailable ─> STOPPED
  └─ network failure ─> RETRY_WAIT (content remains visible)
ACTIVE
  ├─ 30s visible + non-idle ─> submit activity ─> ACTIVE
  ├─ hidden tab / idle ─> PAUSED
  ├─ navigation/logout ─> best-effort flush/end ─> STOPPED
  └─ target unavailable ─> STOPPED
PAUSED
  ├─ visible + user activity before server expiry ─> ACTIVE
  └─ expiry/navigation ─> STOPPED
```

### Timing

- nominal heartbeat: 30 seconds;
- local accumulated active time: never more than 30 seconds per normal payload;
- server maximum acceptance: 35 seconds;
- client idle threshold: 60 seconds without keyboard, pointer, scroll, page, or
  supported player activity;
- server inactivity timeout: two minutes;
- exponential retry with jitter while the returned session remains valid;
- keep only a small bounded set of unsent fact IDs in memory/sessionStorage.

Use an injectable clock/scheduler so unit tests advance virtual time. Do not make
tests wait 30 real seconds.

### Visibility and lifecycle

- `visibilitychange` to hidden pauses the timer and attempts one bounded flush.
- Returning visible resumes only after current user activity and a valid
  session.
- Route cleanup cancels timers/listeners, flushes at most one fact, then sends
  optional end.
- `pagehide` may use `navigator.sendBeacon` only for a bounded final JSON
  activity/end payload if CORS/cookie behavior is verified. Ordinary `fetch` is
  primary because it returns accepted state and uses shared auth refresh.
- Browser close/crash is expected to lose the final request; do not fabricate
  time on next load.
- Offline queues never carry requests beyond session expiry and never alter
  timestamps/totals to regain credit.

## Evidence by StoryType

### NOVEL

Observe the content container, not the document as a whole. Compute progress in
basis points from validated content extent and report the highest monotonic
value. Include the index/identity of the furthest visible published block. The
server validates the block position and content revision.

The client may suggest completion after >=95% and the final block appears, but
only the server confirms completion with accepted active time. Resizing or
dynamic media must not move progress backward.

### COMIC

Use IntersectionObserver over Episode pages or long-strip page anchors. Report
the highest page reached, covered page count/proportion, and page-list revision.
No per-image engagement target is created.

For paged or vertical reading, final-page visibility alone is evidence, not
completion. The server also requires coverage and active time. If the page count
changes, a new session/revision uses the new denominator; historical completion
is not rewritten.

### VIDEO

Page visibility is not playback. Use provider player events only if the
supported provider API and privacy configuration expose reliable state,
position, duration, and ended events.

- When supported, send bounded `VIDEO_PLAYBACK` evidence while actually playing.
- Pause when the player pauses/buffers, tab hides, or events stop.
- When duration/player events are unavailable, record only the Episode session
  view. Do not report qualified view, watch time, progress, or completion.
- Never infer completion from iframe load, elapsed page time, thumbnail load, or
  external YouTube navigation.

The UI does not display “completed” unless a separate future product feature
needs and receives server-confirmed state.

## Typed API contract

Proposed methods:

```ts
startEngagementSession(
  target: { targetType: "STORY_DETAIL"; storyId: string } |
          { targetType: "EPISODE"; storyId: string; episodeId: string },
  idempotencyKey: string,
): Promise<EngagementSessionResponse>

submitEngagementActivity(
  sessionId: string,
  activity: EngagementActivityRequest,
  idempotencyKey: string,
): Promise<EngagementActivityResponse>

endEngagementSession(
  sessionId: string,
  finalActivity: EngagementActivityRequest | null,
  idempotencyKey: string,
): Promise<void>
```

The shared request layer must support:

- optional Bearer authentication without requiring login;
- `credentials: "include"` for these calls;
- `Idempotency-Key` header;
- normal refresh rotation for authenticated calls;
- Problem Details mapping;
- 429 `Retry-After`;
- cancellation through `AbortSignal`;
- no raw payload/token logging.

Do not add direct `fetch` calls inside readers.

## Error behavior

| Result | Client behavior |
|---|---|
| Network/5xx | Preserve reading; bounded backoff retry |
| 400 invalid evidence | Drop bad fact, stop that evidence adapter, keep reading |
| 404 inaccessible/hidden | Stop session silently; public route handles content on its normal next request |
| 409 replay mismatch/session state | Do not invent new totals; stop or safely resync |
| 429 | Respect `Retry-After`, reduce activity frequency, keep reading |
| 401 authenticated session | Shared refresh once; on failure clear auth and end tracker identity |
| Cookie unavailable | Continue without durable anonymous uniqueness |

No ordinary tracking failure is shown to the reader. Consent or privacy controls
are the only expected user-facing measurement state.

## Moderation and cache behavior

The next activity after a Story/Episode becomes hidden receives generic 404 and
stops. The client does not show a moderation reason. Existing public route
behavior remains the authority for whether already rendered content stays until
navigation/refresh; the tracker must not cache eligibility.

Epic 12B adds no runtime cache. Engagement POST responses are `no-store`.
Future creator analytics responses are private/no-store until an owner-scoped
cache design exists. Public aggregate caching is deferred with public counts.

## Unit/component test design

- Story Detail starts once after successful visible render.
- Failed/loading/background detail does not start.
- NOVEL/COMIC/VIDEO start with backend response IDs.
- React Strict Mode shares a start request.
- virtual scheduler submits at 30 seconds and caps local delta;
- hidden tab and idle pause; visible activity resumes;
- route change cleans listeners and sends bounded end;
- refresh reuses sessionStorage key;
- duplicate/offline retry reuses activity UUID/payload;
- retry honors session expiry and 429 delay;
- anonymous requests include credentials but expose no cookie value;
- JWT login/logout changes session identity without history merge;
- NOVEL monotonic block/scroll evidence;
- COMIC final-page/coverage/revision evidence;
- VIDEO player evidence and explicit unknown fallback;
- 404 stops, other failures never hide reader content;
- no tracking message, mock fallback, arbitrary HTML, token log, or public count.

## Browser E2E design

Use real API fixtures and an injected server/test clock or short test-only policy
rather than long sleeps:

1. anonymous Story detail creates one view session;
2. refresh replays/deduplicates;
3. anonymous NOVEL activity qualifies/completes under deterministic evidence;
4. navigate to another Episode creates a distinct session;
5. login starts a User session without merging anonymous history;
6. COMIC page progression completes against the fixture revision;
7. VIDEO with supported fixture events qualifies, while unsupported provider
   remains unknown;
8. hide target mid-session; next activity stops with generic behavior;
9. restore permits a new session;
10. Library, Bookmark, Progress, Continue Reading, moderation, authoring, and all
    readers regress successfully;
11. no mock fallback, screenshots, traces, cookies, JWTs, or media artifacts
    remain tracked.

## Implementation phases

1. Add typed client DTOs and a tested scheduler/controller without reader wiring.
2. Integrate Story Detail start.
3. Integrate Episode start/activity in NOVEL and COMIC.
4. Add VIDEO provider adapter with explicit unknown state.
5. Add visibility, idle, retry, auth-transition, and teardown behavior.
6. Run real E2E and failure/security review.

## Non-goals and risks

Non-goals: impressions, Likes, Follows, public counts, analytics dashboard,
ranking, recommendations, notifications, fingerprinting, external SDKs, and
perfect bot detection.

Risks requiring implementation review:

- production app/API cookie site topology;
- provider event/API policy and browser restrictions;
- IntersectionObserver behavior with dynamic content;
- multiple-tab active-time contention;
- sessionStorage availability/private browsing;
- consent requirements by deployment region;
- avoiding timer/listener leaks across Next.js route transitions.
