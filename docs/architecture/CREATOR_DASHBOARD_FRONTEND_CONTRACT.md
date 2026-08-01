# Creator Dashboard Frontend Contract

## Status

- Status: Approved architecture; implemented and pending independent evidence review
- Date: 2026-07-29
- Baseline: `v1.0.0-alpha.2`
- Canonical route: `/creator/dashboard`
- API: `GET /api/v1/creator/dashboard`

This document defines the frontend route, rendering, state, accessibility, and
legacy migration contract. Backend ownership, metrics, privacy, and query
semantics are authoritative in:

- [Creator Dashboard Architecture](../../../NovelVerseApi/docs/architecture/CREATOR_DASHBOARD_ARCHITECTURE.md)
- [API Strategy](../../../NovelVerseApi/docs/architecture/adr/ADR_CREATOR_DASHBOARD_API_STRATEGY.md)
- [Metrics and Privacy](../../../NovelVerseApi/docs/architecture/adr/ADR_CREATOR_DASHBOARD_METRICS_PRIVACY.md)
- [Caching](../../../NovelVerseApi/docs/architecture/adr/ADR_CREATOR_DASHBOARD_CACHING.md)

## Discovered frontend map

### Legacy mock surface at the architecture baseline

This inventory records the pre-implementation surface used to make the route
migration decision. Epic 13A removed these pages and `DashboardPages.tsx`; they
are not current Dashboard implementations.

- `src/app/dashboard/layout.tsx` uses the mock-oriented `AppShell`.
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/profile/page.tsx`
- `src/app/dashboard/stories/page.tsx`
- `src/app/dashboard/stories/new/page.tsx`
- `src/app/dashboard/stories/[id]/edit/page.tsx`
- `src/app/dashboard/stories/[id]/chapters/page.tsx`
- `src/app/dashboard/stories/[id]/chapters/new/page.tsx`
- `src/app/dashboard/comments/page.tsx`
- `src/app/dashboard/analytics/page.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/components/DashboardPages.tsx` calculates a hard-coded creator's cards,
  tables, comments, bars, and actions from `src/lib/mockData.ts`.
- `src/components/Shells.tsx` publishes `/dashboard/**` member navigation.

The mock Analytics page offers arbitrary 7/30/year selection and fake bars.
Those behaviors are not an API contract and must not influence Epic 13.

### Real creator surface

- `src/app/creator/layout.tsx` uses `CreatorAuthGuard`.
- `src/app/creator/stories/page.tsx` renders the real API-backed story list and
  create form.
- `src/app/creator/stories/[storyId]/page.tsx` manages a real Story and its
  Episodes.
- `src/app/creator/stories/[storyId]/episodes/[episodeId]/edit/page.tsx` selects
  the real NOVEL/COMIC/VIDEO editor.
- `src/app/creator/stories/[storyId]/episodes/[episodeId]/preview/page.tsx`
  renders the real preview.
- `src/features/novel-editor/CreatorAuthGuard.tsx` observes session changes,
  loads `/users/me`, and gates creator operations.
- `src/features/novel-editor/api.ts` is the typed API/auth authority. It attaches
  Bearer tokens, serializes refresh, retries once after successful refresh,
  clears failed sessions, and publishes session-change events.
- `src/features/novel-editor/CreatorStoryPages.tsx`,
  `EpisodeEditorRouter.tsx`, and type-specific editors implement current creator
  workflows.
- `src/features/public-discovery/StoryDetail.tsx`,
  `src/features/engagement`, and `src/features/moderation` are current consumers
  of Social, Engagement, and Moderation state.

### Layout conventions

The application already uses semantic panels, `statGrid`, `twoCol`, bounded
tables, native controls, status badges, and small-screen media rules. Existing
dashboard screenshots are wireframe evidence only. No chart library is
installed; Epic 13 does not add one.

## Route alternatives

| Option | Clarity | Existing-route fit | Migration/deep links | Authorization/navigation | Future risk |
|---|---|---|---|---|---|
| A: `/creator`, `/creator/stories`, `/creator/analytics` | Good, but `/creator` ambiguously means profile or dashboard | Preserves Story routes | Low migration | One creator layout | Root ambiguity |
| B: `/dashboard`, `/dashboard/stories`, `/dashboard/analytics` | Generic | Preserves mocks but moves real Story routes | High; breaks real paths | Risks account/reader dashboard collision | Poor for Creator Economy separation |
| C: `/creator/dashboard`, `/creator/stories`, `/creator/analytics` | Explicit | Preserves real Story paths | Bounded legacy redirects | One authenticated creator layout | Best namespace for later creator tools |

Option C is selected.

## Canonical route model

```text
/creator
  layout.tsx                    authenticated creator boundary
  /dashboard                   operational overview (Epic 13)
  /profile                     real current-profile management entry
  /stories                     existing real Story list/create
  /stories/[storyId]           existing real Story/Episode management
  /stories/[storyId]/episodes/[episodeId]/edit
  /stories/[storyId]/episodes/[episodeId]/preview
  /analytics                   reserved for Epic 16; not implemented in Epic 13
```

`/creator/dashboard` is explicit enough to coexist with future account/reader
surfaces and preserves every real `/creator/stories/**` deep link.

Route construction lives in one typed helper module, for example
`src/features/creator/routes.ts`. Components receive IDs/slugs and action enums;
they do not concatenate route strings independently.

## Legacy migration

Migration happens inside Epic 13A, not in a separate cleanup sprint. It has one
compatibility release.

| Legacy route | Epic 13 behavior |
|---|---|
| `/dashboard` | Permanent `308` to `/creator/dashboard` |
| `/dashboard/stories` | Permanent `308` to `/creator/stories` |
| `/dashboard/stories/new` | Permanent `308` to `/creator/stories` |
| `/dashboard/stories/[id]/edit` | Permanent `308` to `/creator/stories/[id]`; target rechecks real ownership |
| `/dashboard/stories/[id]/chapters` | Permanent `308` to `/creator/stories/[id]` |
| `/dashboard/stories/[id]/chapters/new` | Permanent `308` to `/creator/stories/[id]` |
| `/dashboard/profile` | Permanent `308` to the real `/creator/profile` added in 13A |
| `/dashboard/analytics` | Temporary `307` to `/creator/dashboard` for one release; it must not imply Analytics exists |
| `/dashboard/comments` | Remove; comments are excluded and there is no honest target |
| `/dashboard/settings` | Remove from creator navigation; isolate for at most one compatibility release pending future `/account/settings` ownership |

After the compatibility release, `/dashboard/analytics` is removed until Epic
16 provides `/creator/analytics`, and the legacy settings alias is removed or
migrated by the Account Settings owner. No new content links target
`/dashboard/**`.

Epic 13A removes `DashboardPages.tsx` and all creator/dashboard imports from
`mockData.ts`. `mockData.ts` itself may remain only for unrelated intentionally
static public/admin wireframes; no `/creator/**` module may import it. Mock
charts, comments, hard-coded creator identity, totals, and static params are
deleted from the creator path. Navigation, page inventory, E2E scripts, and
route documentation are updated together.

## Dashboard versus Analytics

The Dashboard contains:

- current eligibility and content counts;
- fixed current relationship totals;
- five-item recent lists and ten attention items;
- seven complete UTC days versus the preceding seven;
- numeric values and deltas only.

Epic 13 contains no chart, sparkline, time-series array, date selector,
Story/Episode performance drill-down, cohort, retention/drop-off, attribution,
export, or rank. `/creator/analytics` is reserved for Epic 16.

## Typed client contract

Add the final response types and one `getCreatorDashboard()` call to the existing
typed API module or a feature-local typed module that delegates to its shared
`request` function. Do not add `fetch`, a Next.js route handler, a BFF, or a mock
fallback.

Frontend types mirror the backend contract:

- `CreatorDashboardResponse`
- `DashboardPeriod`
- `CreatorSummary`
- `CreatorOverview`
- `PerformanceSnapshot`
- `MetricComparison<T>` and `MetricValue<T>`
- `StoryDashboardItem`
- `EpisodeDashboardItem`
- `AttentionItem`
- `CreatorCapabilities`

Enums are discriminated unions. Unknown enum values produce a safe section
error rather than being guessed. Timestamps remain strings at the API boundary
and are formatted only for display.

The frontend route helper maps `AttentionItem.action` plus target ID to an
allowed canonical route. The API does not provide arbitrary hrefs.

## Data-fetching boundary

Use a client component within the existing `/creator` server layout:

1. `CreatorAuthGuard` verifies the current session/account/profile state.
2. The Dashboard client calls `getCreatorDashboard()` after the guard permits
   rendering.
3. The existing client attaches JWT and performs at most one centralized
   refresh/retry.
4. A terminal `401` clears session state and navigates to `/login` with no stale
   Dashboard content.
5. Session-change subscription clears response state before another user can
   render.
6. Network/`5xx` failure offers an explicit whole-page retry; there is no
   unbounded automatic retry.

A server component cannot use the current local client token safely. A route
handler/BFF would duplicate refresh and token handling. Both are rejected until
authentication storage changes through a separate architecture.

The fetch is private/no-store. No React/Next.js response cache, localStorage,
service worker, or cross-navigation state store retains Dashboard data.

## Rendering contract

### Desktop order

1. Creator header and capability/status badge
2. Overview cards
3. Performance snapshot
4. Recent content
5. Needs attention
6. Quick actions

Desktop may use two columns for Recent Content and Needs Attention, but DOM and
keyboard order remain the sequence above.

### Mobile order

The same sections form a single column. Cards wrap without horizontal scrolling.
Content lists become stacked list items rather than a clipped wide table.
Primary actions remain at least 44×44 CSS pixels and do not rely on hover.

### Low-fidelity wireframe

```text
+------------------------------------------------------------+
| Creator: Display Name      [Eligible/Hidden]  [Edit profile]|
+------------------------------------------------------------+
| Stories | Published | Drafts | Episodes | Followers         |
+------------------------------------------------------------+
| Performance: last 7 complete UTC days                       |
| Qualified views | Unique viewers | Active time | Completion |
| current value and numeric change; or one suppression notice |
+------------------------------+-----------------------------+
| Recent content               | Needs attention             |
| Story / status / updated     | severity / stable reason    |
| Draft / continue             | target / allowed action     |
+------------------------------+-----------------------------+
| Quick actions: Create Story | Continue Story | Add Episode  |
+------------------------------------------------------------+
```

No chart is included. Numeric deltas use text and optional directional icons
with accessible labels; color alone never conveys change.

## Formatting and accessibility

- One page `<h1>` followed by ordered `<h2>` section headings.
- Cards are a semantic list; values use readable labels and do not rely on
  visual position.
- Loading skeletons have hidden text announcing loading once, not on every
  pulse.
- Updates use a polite live region; errors use `role="alert"`.
- All actions are native links/buttons with visible focus.
- Moderation and content-type badges include text.
- Large integers use the current locale formatter; do not abbreviate a value
  into a misleading rounded zero.
- `activeReadSeconds` is formatted as duration, not a clock time.
- Completion ratio is formatted as a localized percentage only when available.
- Content timestamps use the user's display locale; metric boundaries are
  explicitly labeled UTC.
- `null` or suppressed values render as unavailable/suppressed, never `0`.
- Empty sections are not removed from heading navigation; they show a concise
  state and an allowed action.

## Loading, empty, and error states

### Loading

The first fetch shows stable skeleton geometry for header, cards, and lists.
Quick actions are disabled until capabilities arrive. Previous-user data is
never retained while a new session loads.

### Empty creator

An eligible creator with no content sees zero current counts, `NO_ACTIVITY`,
empty recent/attention lists, and a Create Story action. An incomplete profile
sees profile onboarding and no create capability.

### Suppression

When `performance.availability == SUPPRESSED`, replace the entire metric group
with one accessible bounded message such as “fewer than 5 qualified viewers.”
Do not reveal exact cells through tooltips, deltas, labels, DOM attributes, or
client logs.

### Full-page failure

Required composite failure is a full-page state with a retry action. The
frontend parses shared Problem Details:

- `401`: clear session and go to login;
- `403`: show account-state restriction without creator data;
- `429`: retain the last confirmed complete response when one exists and show
  bounded retry timing; otherwise show no private response;
- network/`5xx`: show safe retry copy without trace/internal details.

There is no section-level API failure or stale partial response. A rendering
exception may isolate a visual section through a React error boundary, but it
must not relabel incomplete data as successful.

## Moderation and capabilities

Owned hidden CreatorProfile, Story, and Episode records remain visible with a
text Hidden badge. Public-view actions are absent when the backend capability is
false. The UI does not show moderation reason, reporter, actor, note, report
status, or audit history.

The frontend does not infer canPublish, content readiness, Story public
eligibility, or ownership. It renders backend capability flags and lets the
existing mutation endpoint remain authoritative.

## Quick actions

- Create Story → `/creator/stories` using the existing creation surface.
- Continue Story → `/creator/stories/{storyId}` from a returned recent/attention
  target.
- Add Episode → `/creator/stories/{storyId}` where the real management surface
  owns Episode creation.
- View public Story → existing public route helper only when capability permits.
- Manage creator profile → `/creator/profile`.

There is no quick action for Analytics, comments, notifications, revenue,
publishing schedules, or moderation audit.

## Frontend validation design

Unit/component evidence:

- canonical route and typed route helper;
- every legacy redirect/removal;
- authenticated, refreshed, logged-out, inactive, incomplete-profile, and
  hidden-profile states;
- zero, nonzero, suppressed, and unavailable metric rendering;
- no stale state across two sequential users;
- NOVEL/COMIC/VIDEO and lifecycle/moderation badges;
- bounded list rendering and attention action mapping;
- full-page `401/403/429/5xx/network` behavior;
- keyboard order, headings, names, focus, and live regions;
- mobile/desktop responsive DOM order;
- no mock-data import or fallback;
- no `dangerouslySetInnerHTML`;
- no chart dependency.

Browser E2E uses the real API and PostgreSQL for:

1. creator with no content;
2. creator with NOVEL, COMIC, and VIDEO content;
3. fixed-period metrics generated through real Engagement flows;
4. small-cell suppression and threshold transition;
5. hidden content still visible to its owner with no public action;
6. second creator isolation;
7. logout and session-state clearing;
8. `/dashboard` redirect;
9. all permitted quick actions;
10. reload persistence and no mock fallback.

## Delivery

Epic 13A implements route migration, guard/layout, overview, content, attention,
capabilities, quick actions, and mock removal. Epic 13B adds the fixed
performance snapshot, suppression, and performance/privacy proof. These are
separate implementation sprints within one Epic and converge before release.
Epic 16 owns Creator Analytics.

## Non-goals and review risks

- No redesign of Story/Episode editing or publishing.
- No account-settings implementation.
- No comments/reviews or notification center.
- No chart package.
- No arbitrary Analytics route.
- No server-generated natural-language advice.
- No client-derived ownership, moderation, metric, or capability rules.

The critical review risks are cross-user retained state, accidental mock
fallback, misleading zero/unavailable display, a redirect loop, and exposing
hidden/public actions not authorized by the backend.
