# Epic 14 Reader Navigation Frontend Evidence

Review date: 2026-08-02

This is the final independent frontend and cross-stack review for Epic 14. It follows `docs/ENGINEERING_RULES.md`. The original independent review withheld approval for two private-state concurrency defects and a deterministic Browser E2E harness failure. Those findings and failed runs remain recorded below; the blocker-closure addendum documents the scoped fixes and fresh passing validation.

## Review baseline

- Branch: `feature/series-publishing-architecture`
- Baseline HEAD: `873d3fa222122aed46d4f91452cd60e57251bb8e`
- Baseline dirty inventory: 15 tracked modifications and 7 untracked Epic 14B files; no staged files
- Baseline `git diff --check`: pass
- Frontend process: verified Next.js command under `C:\work\novelverse`; temporarily restarted only for the required production build
- Epic 14B decision document hash: `45EFB6EE9CEDAD292E0E1BF82C9FFE7D328651E26B1F3ACC1950CCC72F0AEB77`
- Browser E2E fixture hash: `BAFE8EA6D701184F891C168FC2692623BBA2DAD8BCE35191DFAF599F49827659`

## Contract, parser, client, and routing

The frontend DTO exactly models the approved Story, current Episode, and nullable adjacent Episode shapes. The runtime parser checks UUIDs, non-empty routing/title fields, finite numbers, all NOVEL/COMIC/VIDEO values, PUBLIC/UNLISTED current visibility, and nullable neighbor objects. Malformed and incomplete responses are rejected rather than guessed.

`getPublicEpisodeNavigation` uses the shared API request path, accepts an `AbortSignal`, requests `no-store`, and independently applies `encodeURIComponent` once to each raw slug. Dynamic route pages decode each route segment once with `decodeRouteSegmentOnce`. Tests and observed browser requests contain `%E0...` and not `%25E0...`.

`resolvePublicEpisodeHref` remains the only NOVEL/COMIC/VIDEO route authority. Server-confirmed `storyType` selects History/Library/Home and navigation links. Back to Story uses canonical server slugs through the same segment-encoding convention. The API supplies no href and callers cannot choose neighbor authority.

## Shared shell ownership

`ReaderNavigationShell` owns only Story/Episode headings, canonical Back to Story, previous/next controls, boundary/direct-only messaging, retry state, keyboard behavior, heading focus, and the live announcement. Rendering and evidence remain format-owned:

- NOVEL retains `NovelContentRenderer` and ordered text/image engagement evidence.
- COMIC retains page image rendering and ordered-page engagement evidence.
- VIDEO retains the provider iframe and its deliberately unsupported completion evidence.
- Each format retains its Episode report target.

The top and bottom copies of the same navigation controls are a harmless presentation detail, not duplicated navigation authority.

## Mixed state machine and progress timing

The code implements the approved states:

- Content plus matching navigation: content/shell render and progress becomes eligible.
- Content failure: generic full-reader error and no progress.
- Content plus transient navigation failure: content remains readable, links are not fabricated, retry is available, and progress is delayed.
- Navigation 404, unsupported Story type, or Episode-ID mismatch: full reader is concealed and progress is not written.
- Keyed `ReaderFrame` instances remount on raw route changes; content, navigation, and progress controllers abort on unmount and late results are generation/abort guarded.

No `Promise.all` collapses the independent content/navigation states. Progress is started only after both responses are ready and Episode IDs match.

## Reader-format and navigation UX results

- NOVEL: shared shell plus existing content renderer passes unit and partial Browser E2E navigation flows.
- COMIC: shared heading/boundary shell plus real comic page image passes unit and Browser E2E checks.
- VIDEO: shared heading/boundary shell plus `youtube-nocookie` iframe passes unit and Browser E2E checks; the provider region disables reader shortcuts.
- First, middle, last, single, and UNLISTED direct-only UI states pass unit coverage.
- Visible Previous/Next and Back to Story controls use canonical links.
- No `X of Y`, ordinal, or total navigation claim exists.

## Keyboard and accessibility

Unmodified ArrowLeft/ArrowRight navigate only when a corresponding neighbor exists. Form controls, links, buttons, contenteditable elements, dialogs, iframes, provider-disabled regions, modifiers, and composition are excluded. `preventDefault` is called only after a valid href is selected. The validated Episode heading receives focus and an `aria-live` message announces it. Boundary/error state is conveyed in text, not color alone.

Evidence limitations: unit tests directly exercise text input, modifiers, composition, and absent neighbors, but do not separately assert every selector exclusion, `preventDefault`, or a mobile viewport. The Browser E2E exercises visible controls and keyboard navigation on desktop but does not complete a dedicated mobile reader pass.

## Story Detail pagination

Story Detail explicitly requests 20 Episodes, preserves returned order, reports shown/total counts, and performs bounded Load More requests. Duplicate IDs from overlapping pages are filtered while preserving prior order. Initial and incremental errors are separate, canonical links use single encoding, and the global API default is unchanged. The backend remains authoritative for excluding UNLISTED/ineligible Episodes.

The successful unit test covers 20+ Episodes, duplicate removal, shown/total wording, page 2, and Unicode links. Incremental-load retry is implemented but lacks a direct automated test. The failed Browser E2E runs reached and passed the 20/22 then 22/22 assertions before failing later.

## Reading History and Continue Reading

`/history` is real API-backed code with no mock import. It requires a session, uses the fixed safe redirect `/login?next=%2Fhistory`, describes latest Episode per Story, consumes server newest-first order, paginates at 20, and supports loading/empty/retry. Request generations prevent late History responses from overwriting a newer session. Terminal 401 clears the shared token session in the API client and redirects. No reading data is stored in localStorage, sessionStorage, IndexedDB, or a service worker, and no History remove/clear mutation exists.

Home Continue Reading clears immediately on session events and generation-guards late results. Home requests three items. Library requests three recent items. History and all resume surfaces use the same `ReadingProgress` contract and route resolver and never guess replacement Episodes.

## Release blockers

### 1. Library late-response private-state overwrite — Medium security, release blocker

`src/features/reader-state/LibraryPage.tsx:20-45` clears arrays when a session event starts a new load, but its `Promise.all` completion has no request generation, actor epoch, or abort guard. An older User A request can resolve after logout or User B login and execute `setBookmarks`/`setProgress`, repopulating User A private data in the new session view. History and Continue Reading have guards; Library does not. Existing tests do not exercise an out-of-order Library identity transition.

### 2. Cross-session progress deduplication — Medium correctness/privacy boundary, release blocker

`src/features/reader-state/progress.ts:3-17` keys the module-level five-second success and in-flight caches only by `storyId:episodeId`. The cache is neither actor/session scoped nor cleared on session changes. If User B opens the same Episode shortly after User A in the same browser, User B's valid progress write can be suppressed or share User A's in-flight promise. This does not send User A's JWT as User B, but it lets prior-user client state control the new user's private progress behavior. No executable test covers this transition.

### 3. Full Browser E2E cannot pass — validation blocker

Two fresh full runs failed at the same existing harness race in `scripts/test-local-vertical-slice.mjs:1315-1334`. The response listener awaits `response.json()` before pushing accepted anonymous engagement sessions, but the script checks the array immediately after reader content appears. Both run logs show the Story and Episode `POST /api/v1/engagement/sessions` requests returned HTTP 200; the asynchronous array was still incomplete when asserted. Durations were 68.7s and 58.9s. This is a deterministic validation-harness defect, not an observed API rejection, but the required end-to-end gate remains failed and cannot be waived.

Failure screenshots were created only in the system temporary directory and are scheduled for explicit cleanup during final review cleanup.

## Automated evidence map and gaps

Fresh passing evidence:

- parser: StoryType, visibility, UUID/routing fields, nullable neighbors, malformed response rejection
- client: Unicode single encoding, `AbortSignal`, `no-store`
- shell: matched success, transient retry, 404/mismatch concealment, boundaries, UNLISTED, keyboard basics, focus
- all formats: owning content call, navigation call, and report target
- pagination: explicit 20, Load More, duplicate removal, totals, Unicode link
- History: anonymous redirect, server rows, pagination, empty/retry, session clearing
- Continue Reading: authenticated rendering and session clearing

Approved requirements lacking direct automated evidence:

- content-request rejection as a dedicated ReaderFrame test — review concern
- route change while progress is already in flight, distinct from component unmount — accepted implementation evidence via keyed remount, but no direct assertion
- every keyboard exclusion and `preventDefault` behavior — follow-up coverage
- dedicated mobile reader layout/interaction — follow-up coverage
- incremental Story Detail retry — follow-up coverage
- terminal 401 rendered through History itself — review concern; shared API-client clearing is tested
- out-of-order Library User A→B response — blocker and demonstrated static defect
- session-scoped progress deduplication — blocker and demonstrated static defect
- Browser E2E UNLISTED direct-only flow, transient navigation retry, ID mismatch, and reader-state User A→B transition — review concerns; lower-layer tests cover part of this behavior
- complete Browser E2E pass and final no-mock summary — blocker

## Fresh validation

- ESLint: pass
- TypeScript `--noEmit`: pass
- Epic 14 focused tests: 73/73 pass across 6 files
- Full frontend tests: 135/135 pass across 19 files
- Production build: pass; 121 static pages generated and dynamic reader routes built
- Full real-stack Browser E2E run 1: fail after 68.7s at anonymous engagement response-listener race
- Full real-stack Browser E2E run 2: fail after 58.9s at the same race, despite both API POSTs returning 200
- npm audit: 0 vulnerabilities across 550 dependencies
- Initial `git diff --check`: pass; final status and hash comparison are recorded in the final review report

The focused/full test output includes jsdom's expected “navigation not implemented” stderr from a passing redirect test; it does not fail the suite.

## Mock and persistence review

History imports only the real typed API. Reader Navigation uses the real content and navigation methods. Static inspection found no History/Continue Reading mock fallback and no persistence of private rows outside React state. Both failed Browser E2E runs passed the History no-mock assertion before the later harness failure, but the script did not reach its final `mockFallbackDetected: false` summary, so a complete Browser no-mock pass cannot be claimed.

## Security findings

- Critical: none found
- High: none found
- Medium: Library late-response private-state overwrite; cross-session progress deduplication
- Low: none found
- Informational: incomplete direct tests for the state/accessibility cases listed above

Other reviewed areas—unsafe href construction, open redirects, double encoding, caller-selected routing, wrong-Episode progress, stale reader-route responses, navigation timeout metadata, private browser persistence, and unbounded lists—show no supported defect.

## Architecture deviation classification

- Intentional and documented: no ordinal/total; UNLISTED direct-only; no History deletion; no Series/Season/Volume; format renderers remain separate.
- Harmless detail: duplicated top/bottom presentation of one shared navigation-control implementation.
- Architecture concerns: incomplete direct coverage for content failure, full keyboard exclusions, mobile reader behavior, incremental pagination retry, and several Browser-only cases.
- Release blockers: Library late-response isolation, cross-session progress deduplication, and the non-passing full Browser E2E gate.

## Review checklist and verdict

- [x] Typed minimal contract and strict runtime parsing
- [x] Single-encoded Unicode routes and canonical resolver
- [x] Narrow shared shell and all three format integrations
- [x] Independent content/navigation state and delayed progress
- [x] Boundaries, keyboard basics, focus, and announcements
- [x] Bounded Story Detail pagination
- [x] Real History and guarded Continue Reading
- [x] Lint, typecheck, focused/full tests, build, and npm audit
- [x] Library is safe from late previous-session responses
- [x] Progress deduplication is session/actor isolated
- [x] Full real-stack Browser E2E passes twice consecutively

The unchecked items and failed runs in the preceding sections are the retained historical independent-review record. Their closure is documented below.

## Blocker-closure implementation

### Library generation and abort guard

`LibraryPage` now captures the centralized in-memory session generation and a per-load request ID, supplies one `AbortController` to both private reads, clears rows synchronously on every session event, and ignores stale success, error, and finally callbacks. Bookmark removal receives the same generation/request/abort protection. Deterministic tests cover User A late success after logout, User A success after User B data, late User A failure/finally after User B retry, terminal 401 clearing, both bookmarks and Continue Reading, and stale removal completion. No private payload cache or browser persistence was introduced.

### Progress dedupe session scoping

The shared API session event now advances a process-memory-only monotonically increasing generation for token storage/refresh, development sign-in, logout, and terminal 401. Dedupe keys are `generation:storyId:episodeId`; both maps clear on session transitions, expired success entries are pruned, and a late old-generation success cannot repopulate current dedupe state. No user ID is accepted from route/content data, no token is stored in a map, no identity API call was added, and same-session duplicate suppression remains active. Tests cover recent and in-flight same-Story/same-Episode collisions across User A/User B, logout, terminal 401, and same-user re-login.

### Browser response synchronization

`scripts/engagement-response-collector.mjs` registers before the scenario, classifies the exact STORY and EPISODE requests, awaits both body promises and scenario network completion, validates HTTP 200 and the response contract, rejects malformed, duplicate-identity, or missing matches with a bounded timeout, and removes its listener in `finally`. Distinct React Strict Mode replacement lifecycles are validated independently and the latest valid lifecycle is selected; they are not confused with a repeated request identity. The older authenticated collector's identical unawaited callback pattern was also closed by tracking and flushing its body promises before every consuming assertion. Helper tests cover both response-arrival orders, waiting for both body parses, timeout, malformed body, non-200, duplicate identity, distinct replacement lifecycles, and listener cleanup. Reverse body-parse completion is supported by the pending-response/ordinal implementation but is not separately ordered in the helper test.

## Blocker-closure validation

- Focused blocker/Epic 14 tests: 81/81 across 6 files, 0 failed, 0 skipped.
- Full frontend tests: 151/151 across 20 files, 0 failed, 0 skipped.
- ESLint, TypeScript `--noEmit`, production build, and `git diff --check`: pass.
- npm audit: 0 vulnerabilities across 550 dependencies.
- Final Browser E2E run 1: PASS, 50.6s, complete final summary including real Library and progress A-to-B isolation.
- Final Browser E2E run 2: PASS, 50.6s, complete final summary including real Library and progress A-to-B isolation.
- `mockFallbackDetected`: false in both runs.
- NOVEL, COMIC, and VIDEO content/navigation matching and delayed progress coverage: pass.
- Story Detail incremental Load More retry: directly covered.
- Keyboard `preventDefault`: directly proven only for a valid neighbor and absent at first/last boundaries.
- Response collector helper: 5 tests cover response order, waiting for both body parses, timeout, malformed/non-200/duplicate-identity failures, distinct Strict Mode replacement lifecycles, and cleanup. A dedicated reverse body-parse-completion assertion remains an informational test gap.

## Remaining accepted limitations

- No dedicated mobile reader Browser run was added.
- The keyboard suite does not separately enumerate every selector in the exclusion list, although the approved focus/modifier/composition/provider exclusions and the required boundary `preventDefault` cases are covered.
- Current-Episode hide/archive/delete concurrency races remain a backend evidence follow-up; one-statement snapshot behavior and current lifecycle concealment remain covered.
- Some Browser-only synthetic mismatch/transient scenarios remain lower-layer tests so the real harness does not add product hooks or mocks.

## Final blocker-closure security finding

- Critical: none.
- High: none.
- Medium: none remaining; both prior Medium findings are closed by generation/abort isolation and session-scoped dedupe.
- Low: none.
- Informational: the accepted coverage limitations above.

Epic 14B's confirmed review blockers are closed without changing the Reader Navigation API contract or adding product scope. The repositories are ready for a fresh independent approval/local commit decision, subject only to project-owner authorization for any Git operation.
