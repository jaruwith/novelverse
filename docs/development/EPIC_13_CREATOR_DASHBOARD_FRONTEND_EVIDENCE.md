# Epic 13 Creator Dashboard Frontend Evidence

## 1. Canonical route

The only operational Creator Dashboard route is `/creator/dashboard`.
`/creator/stories/**` remains the real creator management surface,
`/creator/profile` is the real profile-management route, and
`/creator/analytics` remains deferred to Epic 16.

The frontend baseline remains `94c16b5b59b184598c288f034332e02521d1c1c2`
on `feature/creator-dashboard-architecture`. No Epic 13 commit, push, merge, or
tag was created during validation.

## 2. Legacy migration

`DashboardPages.tsx` and the legacy `/dashboard/**` App Router pages were
removed. Next.js redirects provide:

- permanent `/dashboard` to `/creator/dashboard`;
- permanent profile and Story-management compatibility redirects;
- temporary `/dashboard/analytics` to `/creator/dashboard`.

Comments and settings have no dishonest Creator Dashboard destination. Browser
E2E proves `/dashboard` and `/dashboard/analytics` canonicalize and remain
stable after reload. No legacy mock renders.

## 3. Component structure

The page preserves one semantic order on desktop and mobile:

1. Creator header;
2. Overview;
3. Performance snapshot;
4. Recent content;
5. Needs attention;
6. Quick actions.

The implementation uses a required composite response, skeleton loading,
bounded lists, semantic headings, textual lifecycle/type/moderation badges,
native links/buttons, and responsive single-column rules. No chart dependency
was added.

## 4. Typed API integration

`getCreatorDashboard` uses the established authenticated request client with
`cache: "no-store"` and parses the approved response types. There is no ad hoc
Dashboard fetch path, caller-supplied Creator/User authority, duplicate mock
DTO, or mock fallback.

Automated mapping assertions cover the serialized period, creator, overview,
performance, content, attention, and capability structures. Runtime parsing
rejects unknown core and action-routing discriminants; exhaustive validation of
every nested enum remains a documented independent-review follow-up.

## 5. Suppression versus zero behavior

The UI renders `Insufficient data` for `SUPPRESSED`, does not render exact
metric values or deltas, and never converts `null` to zero. `NO_ACTIVITY`
renders exact zero qualified views and unique readers separately.

Real-stack Browser E2E creates four qualified viewers and proves the values are
absent from DOM/accessibility text, then moves a fifth persisted session into
the completed UTC period and proves exact metrics become visible.

## 6. Error and session handling

- terminal `401` clears shared credentials, removes private Dashboard content,
  and returns to login;
- inactive-account `403` Problem Details contains no Dashboard data;
- incomplete active profiles receive capability-restricted onboarding;
- `404` renders a generic unavailable state;
- real `429` renders retry-later copy while retaining the last confirmed
  complete response;
- `504` and `5xx` render safe retry behavior;
- logout clears the session and private Dashboard state;
- a session-change event clears the previous creator before the next response.

No partial response is labeled as successful.

## 7. Capability-driven actions

Create Story, Edit Profile, public-work, recent-content, and attention actions
are emitted only from returned capabilities or item flags. The UI does not
invent publish permissions or a Creator ID. Hidden content has no public action.

Because no standalone public Creator Profile API exists, the approved
capability-gated profile action uses the existing public Discovery filter for
that creator. It does not render the legacy mock profile or fabricate facts.

## 8. Accessibility and responsiveness

Automated evidence covers:

- one ordered `h1`/`h2` hierarchy;
- skeleton `role=status` and `aria-busy`;
- alert/status semantics;
- keyboard-reachable native actions;
- named links and buttons;
- text labels in addition to badge color;
- a single semantic DOM order at desktop and 390x844 mobile widths;
- single-column mobile layout without duplicated content.

## 9. Browser E2E evidence

The final `npm run test:e2e:local` run passed against the real frontend, actual
Release API, real JWT authentication, and long-lived local PostgreSQL. It
verified:

- canonical and Analytics compatibility redirects;
- empty creator and exact-zero state;
- NOVEL, COMIC, and VIDEO content;
- persisted overview counts, bounded recent/attention lists, refresh and reload;
- four-viewer suppression and five-viewer disclosure;
- hidden owner visibility and disabled public action;
- archived owner visibility and deleted-content absence;
- no internal moderation note or audience identity;
- Creator A to Creator B sequential isolation;
- real inactive `403`, incomplete-profile onboarding, terminal `401`, real
  actor-scoped `429`, and logout;
- capability-driven quick actions;
- mobile ordering, textual status, and keyboard reachability;
- no mock fallback.

The same run retained passing Identity, Story, Episode, NOVEL, COMIC, VIDEO,
Media, Discovery, Reader Library, Bookmark, Continue Reading, Progress,
Moderation, Engagement, Like/Unlike, Follow/Unfollow, and creator Story
workflows.

## 10. Frontend validation totals

- `npm install`: up to date; lockfile SHA-256 unchanged.
- lint: PASS.
- typecheck: PASS.
- unit/component tests: 102/102 PASS across 16 files.
- production build: PASS; `/creator/dashboard` and `/creator/profile` emitted.
- full real-stack Browser E2E: PASS.
- npm audit: 0 vulnerabilities across 550 dependencies.
- `git diff --check`: PASS.

## 11. No-cache and no-persistence behavior

The request uses `no-store`, respects backend `private, no-store`, and does not
persist Dashboard payloads in localStorage, sessionStorage, IndexedDB, Cache
Storage, or a mock cache. The existing platform authentication client continues
to own token storage; no additional Dashboard credential path was introduced.

## 12. No mock fallback

The real component contains no mock import or fallback data. The legacy
Dashboard component and routes are removed. Unit tests inspect the source and
dependency manifest, and Browser E2E verifies rendered output comes from
persisted API data.

## 13. Limitations

- There is no standalone public Creator Profile API; the public-work action uses
  an existing Discovery filter.
- Browser JavaScript cannot inspect the API's `Retry-After` header because it is
  not CORS-exposed; backend tests verify the header and the UI uses safe generic
  retry copy.
- Attention for an Episode cannot construct a direct editor URL from only an
  Episode target ID, so it safely returns to the owner-scoped Story workspace.
- Creator Analytics, charts, arbitrary ranges, and detailed drill-down remain
  Epic 16.

## 14. Remaining risks

- Visual review may identify presentation refinements, but none may change the
  approved contract or scope without separate authorization.
- A future public Creator Profile API and future Publishing workflow require
  independent architecture decisions.
- Browser E2E uses Development authentication endpoints but real persistence
  and the Release API assembly; those endpoints remain Development-only.

No remaining item blocks independent Epic 13 architecture review.

## 15. Independent-review checklist

- [x] Canonical route and legacy migration match the approved contract.
- [x] Runtime and typed contracts agree.
- [x] Zero and suppression are distinct.
- [x] Error/session isolation is proven.
- [x] Capability-driven actions are proven.
- [x] Accessibility and responsive behavior are covered.
- [x] Full real-stack Browser E2E passes without mocks.
- [x] Platform Foundation regression flows pass.
- [x] Lint, typecheck, tests, build, and audit pass.
- [x] No Dashboard cache/persistence path was introduced.
- [x] No package/dependency file changed.
- [x] No commit, push, merge, or tag was created.
- [ ] Independent reviewer approval remains pending.
