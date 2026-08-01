# Epic 13A Sprint 2 — Creator Dashboard Frontend

## Status and scope

Epic 13A Sprint 2 implements the approved Creator Dashboard frontend against
the real authenticated backend composite endpoint:

```http
GET /api/v1/creator/dashboard
Cache-Control: private, no-store
```

The implementation does not add or change a backend endpoint, DTO, entity,
migration, dependency, Analytics feature, chart, revenue surface,
notification, recommendation, export, or AI behavior.

Architecture references:

- [Creator Dashboard Frontend Contract](../architecture/CREATOR_DASHBOARD_FRONTEND_CONTRACT.md)
- [Creator Dashboard Architecture](../../../NovelVerseApi/docs/architecture/CREATOR_DASHBOARD_ARCHITECTURE.md)
- [Epic 13B Backend Evidence](../../../NovelVerseApi/docs/development/EPIC_13B_DASHBOARD_PERFORMANCE_PRIVACY_EVIDENCE.md)

## Canonical route and legacy migration

The only operational Dashboard route is `/creator/dashboard`. `/creator`
permanently redirects to it. The real Story management surface remains under
`/creator/stories/**`, and creator profile setup is available at
`/creator/profile`.

The Next.js redirect table provides the approved compatibility behavior:

- `/dashboard` → `/creator/dashboard` (permanent);
- `/dashboard/profile` → `/creator/profile` (permanent);
- `/dashboard/stories` and legacy create/edit/chapter paths →
  `/creator/stories/**` (permanent);
- `/stories/new` → `/creator/stories` (permanent);
- `/dashboard/analytics` → `/creator/dashboard` (temporary, until Epic 16).

Legacy comments and settings pages have no honest canonical destination and
were removed. `DashboardPages.tsx`, the `/dashboard/**` App Router pages, and
their creator navigation links were removed. The Creator Dashboard never
imports `mockData` and has no mock fallback.

## Typed client and session boundary

`CreatorDashboardResponse` and its nested DTOs live once in
`src/features/creator-dashboard/types.ts`. The existing authenticated API
client owns the only request implementation. `getCreatorDashboard()` delegates
to that client with `cache: "no-store"` and validates the response's critical
discriminated enum values before rendering.

No Dashboard data is written to local storage, session storage, IndexedDB, a
service worker, or a cross-navigation store. The pre-existing authentication
client remains the sole token owner.

The client:

- clears confirmed Dashboard state synchronously on session change or logout;
- ignores responses from an earlier session by request sequence;
- performs no unbounded automatic retry;
- clears session and navigates to Login after terminal `401`;
- directs `403` to creator onboarding;
- renders generic `404`, bounded `429`, and retryable network/`5xx` states;
- keeps the last confirmed response visible when a refresh receives `429` or a
  transient error, without relabeling it as new data.

## Rendering

Desktop and mobile use the same DOM and keyboard order:

1. creator header;
2. current snapshot overview;
3. fixed-period performance snapshot;
4. recent Stories and Episodes;
5. needs-attention items;
6. capability-derived quick actions.

The header exposes display name, eligibility/profile visibility, follower
snapshot, public-work link when permitted, refresh, and logout. It contains no
editable controls.

Overview values are current snapshots. Performance values are the current seven
complete UTC calendar days with backend-provided comparison deltas. If the
backend returns `SUPPRESSED`, the entire sensitive performance group renders
`Insufficient data`; null values are never converted to zero.

Recent Story and Episode lists are bounded to five each. Attention output is
bounded to ten and preserves backend order and stable reason codes. All
navigation is mapped to allowed local route helpers; arbitrary server hrefs
are not accepted. Public Story links are omitted for hidden or otherwise
ineligible content.

Quick actions are generated only from `Capabilities`. The current backend
capabilities can produce Create Story, Edit Profile, and public-work actions.
Add Episode remains an item-level action because the approved response has no
global Add Episode capability.

## Accessibility and responsive behavior

- one page `h1` and ordered section `h2` headings;
- semantic lists for metrics, content, attention, and actions;
- native links and buttons with visible names and at least 44px mobile targets;
- text-bearing type, lifecycle, moderation, eligibility, and severity badges;
- a single polite skeleton loading announcement and no spinner;
- `role="alert"` for request failures and a polite confirmed-time update;
- color-independent delta and moderation text;
- reduced-motion handling for skeleton animation;
- a single-column mobile layout without horizontal metric scrolling.

## Automated evidence

Component/unit coverage proves:

- accessible skeleton loading;
- stable desktop/mobile semantic order and single-column breakpoint;
- empty Story and Episode actions;
- capability-only quick actions;
- available and suppressed metric rendering;
- snapshot versus period presentation;
- hidden Story markers and public-action removal;
- `401`, `403`, `429`, and retry behavior;
- confirmed-response preservation on bounded refresh failure;
- logout and sequential-viewer state clearing;
- five/five/ten list bounds;
- allowed attention route mapping;
- approved legacy redirects/removals;
- no mock fallback, client persistence, unsafe HTML, or chart dependency;
- the typed API call uses the shared authenticated client and `no-store`.

The existing `scripts/test-local-vertical-slice.mjs` real-stack Browser E2E proof
now additionally verifies:

- a creator with no Stories or Episodes;
- the legacy `/dashboard` and `/dashboard/analytics` redirects;
- capability-driven Create Story;
- real mixed-format Story/Episode Dashboard content and persisted counts;
- exact-zero activity, four-viewer suppression, and five-viewer disclosure;
- hidden Story owner visibility and removal of its public action;
- archived owner visibility and deleted-content exclusion;
- sequential Creator A/Creator B isolation;
- real `401`, `403`, and `429` behavior;
- mobile ordering, textual status, and keyboard reachability;
- absence of internal moderation notes;
- logout and removal of browser session credentials;
- no mock response path.

The proof uses the actual Release API behavior and long-lived local PostgreSQL
development stack already owned by the repository E2E workflow. It creates
deterministic disposable test records through development APIs and moves only
its qualified test session into the Dashboard's completed UTC period. It does
not introduce a mock server or tracked database artifact.

## Known boundary and final evidence

The backend currently exposes creator public content but no standalone public
Creator Profile read contract. The capability-gated `Public profile` action
therefore opens the existing public Discovery view filtered to that creator;
it does not depend on the legacy mock public profile page or fabricate profile
facts.

Final cross-stack validation and the independent-review checklist are recorded
in
[Epic 13 Creator Dashboard Frontend Evidence](EPIC_13_CREATOR_DASHBOARD_FRONTEND_EVIDENCE.md).
A true standalone public Creator Profile still requires a separately approved
backend read contract. Creator Analytics remains deferred to Epic 16.
