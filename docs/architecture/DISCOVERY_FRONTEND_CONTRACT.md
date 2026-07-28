# NovelVerse Discovery Frontend Contract

Status: Proposed for Epic 10B implementation
Backend design: `NovelVerseApi/docs/architecture/DISCOVERY_ENGINE_ARCHITECTURE.md`
Baseline: Epic 9B (`c888ee0`)

## 1. Purpose and boundaries

Epic 10B should evolve the existing real API-backed Home discovery flow. It
must not activate the legacy mock `/search` experience as a production search
implementation, duplicate backend visibility/ranking rules, or couple public
discovery failure to personal Library/Continue Reading state.

The frontend consumes one additive `GET /api/v1/stories` contract through the
existing typed API client. Story Detail, public Episode lists, reader route
resolution, bookmark state, Library, and Continue Reading remain separate
consumers with their current contracts.

Approved Epic 10B behavior:

- direct relational projection remains authoritative; there is no projection
  table, materialized view, external search engine, POPULAR, or TRENDING;
- discovery cards contain only eligible Stories with a published public
  Episode; UNLISTED remains direct-only;
- UPDATED is the backend's canonical Story `updatedAt`, including Episode
  lifecycle touches;
- inactive Categories are absent from public filters and card taxonomy;
- Tag filtering sends normalized textual `tag`, never an ID;
- RELEVANCE tiers follow exact title, title prefix, title contains, creator,
  Tag, Category, synopsis, then `updatedAt DESC` and `id DESC`;
- unsupported sorts surface 400 Problem Details and never fall back;
- raw search terms are not logged;
- offset pagination remains until an additive opaque cursor contract exists.

## 2. Verified current frontend

- `PublicHome` requests Stories and active Categories, filters by Story type and
  Category, resets to page 1 on filter change, and renders loading, retry,
  empty, card, and pagination states.
- Cards use backend-provided creator, cover, taxonomy, updated time, Story type,
  and published Episode count.
- `StoryDetail` loads the public Story and published Episodes in parallel,
  supports anonymous destination-preserving login and authenticated bookmark
  toggling, and uses one shared route resolver for NOVEL, COMIC, and VIDEO.
- `ContinueReading` is an independently loaded authenticated section. Its
  failure does not break anonymous discovery.
- `LibraryPage` is authenticated and separately loads bookmarks and progress.
- The typed API client centralizes API base URL, bearer token attachment,
  refresh rotation, Problem Details parsing, and relative media URL expansion.
- Current pagination is page-number based with `PagedResponse`.
- `src/app/(public)/search/page.tsx` is a legacy mock placeholder using
  `mockData`. It must not be reused as a backend-integrated result source.
- Browser E2E already covers real creator workflows, public discovery,
  Story-type/Category filtering, Story Detail, all reader formats, bookmarks,
  Library/progress, and absence of mock fallback in integrated routes.

## 3. Backend request contract

The typed client should expose one explicit input:

```ts
type DiscoveryQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  storyType?: StoryType;
  categorySlug?: string;
  tag?: string;
  creatorSlug?: string;
  languageCode?: "th" | "en";
  contentRating?: ContentRating;
  sort?: "LATEST" | "UPDATED" | "RELEVANCE";
};
```

The client must:

- trim user-entered `q` before serialization;
- omit absent and empty values;
- let `URLSearchParams` encode all values;
- never send `RELEVANCE` when `q` is absent/blank;
- preserve backend enum casing;
- continue expanding only backend-provided relative `coverUrl`;
- use the centralized `request` path and Problem Details mapping;
- not send authentication solely for public discovery unless a current session
  is already handled by the shared client.

`POPULAR` and `TRENDING` must not appear in selectable frontend types until the
backend implements them. Recommendation is not a sort value.

## 4. Response compatibility

Retain the existing `PublicStory` shape and add nullable fields:

```ts
type PublicStory = {
  // Existing fields remain unchanged.
  id: string;
  creatorSlug: string;
  creatorDisplayName: string;
  title: string;
  slug: string;
  synopsis: string | null;
  languageCode: string;
  visibility: "PUBLIC" | "UNLISTED";
  contentRating: ContentRating;
  coverMediaAssetId: string | null;
  coverUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  publishedEpisodeCount: number;
  categories: Category[];
  tags: Tag[];
  storyType: StoryType;
  readingMode: ReadingMode;

  // Additive Epic 10B fields.
  latestPublishedEpisodeAt: string | null;
  latestPublishedEpisodeId: string | null;
  latestPublishedEpisodeSlug: string | null;
};
```

Do not add frontend `popularityScore`, `trendingScore`, or recommendation
features until authoritative backend fields exist. Do not calculate alternate
visibility or ranking client-side.

Continue using the existing `PagedResponse<PublicStory>` fields. The UI must
not infer total counts from `items.length`.

## 5. URL and navigation state

Discovery state should be shareable and browser-navigation friendly. Epic 10B
should make the URL query string authoritative for:

```text
q, page, storyType, categorySlug, tag, creatorSlug,
languageCode, contentRating, sort
```

Rules:

- defaults may be omitted from the URL;
- changing `q`, filter, or sort resets `page` to 1;
- page navigation preserves every other dimension;
- back/forward restores controls and results;
- initialization parses only known values and falls back to safe defaults for
  invalid client-side values; the server remains authoritative and may return
  validation Problem Details;
- use `router.replace` for debounced query edits and `router.push` for explicit
  applied-filter/page navigation if product review prefers history entries;
- do not place tokens or personal state in the URL.

Keep page-number pagination in Epic 10B. A future opaque cursor must be treated
as backend-owned and mutually exclusive with `page`; the frontend must never
construct or decode it.

## 6. Interaction and state model

### Search input

- Use a labeled native search input and submit/apply action.
- Limit input to the backend maximum (100 Unicode scalar values; browser
  `maxLength` is a usability aid, not authoritative validation).
- Empty/whitespace submission clears search and restores non-search sorting.
- RELEVANCE is shown/defaulted only for a non-empty query.
- Debouncing is optional; explicit submit is the simpler Epic 10B default and
  avoids a request per keystroke.
- Never claim fuzzy, semantic, or Thai word-segmented search.

### Filters and sort

- Retain current Story-type and Category controls.
- Add Tag, creator, language, and content-rating controls only to the degree
  needed by Epic 10B acceptance; avoid loading an unbounded creator taxonomy.
  Creator can begin as an exact slug filter reached through creator links.
- LATEST and UPDATED remain available without search.
- Unsupported server sort is a validation error, not a silent fallback.

### Request concurrency

Every request must be tied to its normalized query key. Abort the previous
request when practical or use the existing active-generation guard so a slow
old response cannot replace newer filters. Loading should preserve or clearly
replace prior results according to the chosen UX, but must not combine pages
from different query keys.

### States

- initial/loading: accessible `role="status"`;
- empty: distinguish “no public Stories” from “no matches for these filters”;
- 400 validation: show safe Thai field guidance and retain controls;
- network/5xx: retry the same normalized query;
- successful page: cards plus pagination metadata;
- missing cover: existing accessible placeholder;
- missing latest Episode: show zero/no published Episode; do not create a
  reader link from null metadata.

## 7. Component boundaries

Recommended Epic 10B shape:

```text
PublicHome
├── ContinueReading                 personal, isolated
├── DiscoverySearchControls        URL/query input
├── DiscoveryFilterControls        public taxonomy/enums
├── DiscoveryResults
│   └── PublicStoryCard             existing contract, additive metadata
└── DiscoveryPagination             current PagedResponse
```

Keep API DTOs and request serialization in the existing typed API module for
Epic 10B; a later file split is acceptable if it preserves the shared request
and auth/error pipeline. `resolvePublicEpisodeHref` remains the only
StoryType-to-reader route mapping for Story Detail, Library, Continue Reading,
and any latest-Episode action.

Do not make Home depend on Library or progress success. Public result state and
personal Continue Reading state must have independent loading/error boundaries.

## 8. Search route migration

The current `/search` page is a mock wireframe and contains mock Story,
creator, and Tag results. Epic 10B has two safe choices:

1. make Home (`/`) the canonical integrated discovery/search page and redirect
   `/search` to `/?q=...`; or
2. replace `/search` with the same real `DiscoveryResults` composition used by
   Home.

The first is preferred for the initial implementation because it creates one
query/state implementation. Do not leave a real Home search beside a visually
similar mock `/search` page. Creator and Tag result entity types remain future
scope unless the backend defines those contracts.

## 9. Caching and privacy

The frontend should rely on HTTP semantics rather than add a second in-memory
cache in Epic 10B.

- Anonymous discovery may later use short-lived public caching keyed by all
  normalized query dimensions.
- Browser fetch behavior must honor server ETag/Last-Modified if introduced.
- Authenticated Library, bookmark state, and Continue Reading are private and
  must never be placed in a public/shared cache.
- Home can render public cached discovery and separately fetch private
  Continue Reading.
- Do not persist raw search history locally in Epic 10B.
- Do not log raw query text, tokens, or user-private reader state from the
  browser.

## 10. Thai search communication

Phase 1 backend behavior is deterministic character-sequence matching. The UI
should:

- accept Thai text unchanged;
- avoid wording that promises stemming, semantic matching, typo correction, or
  word segmentation;
- provide a neutral no-results message and allow users to shorten/refine text;
- retain the exact submitted query in the control after a response;
- test Thai queries with and without spaces and document the actual result.

PostgreSQL `ILIKE`/trigram matching can find Thai character sequences but does
not understand Thai words. `unaccent` does not solve Thai segmentation. Better
Thai relevance is a future engine/tokenizer decision, not a frontend heuristic.

## 11. Ranking presentation

| Rank | Frontend behavior |
|---|---|
| LATEST | Label as latest published Stories |
| UPDATED | Label as recently updated Stories; do not imply latest Episode unless backend semantics change explicitly |
| RELEVANCE | Available only for non-empty `q`; label as most relevant |
| POPULAR | Hidden until authoritative engagement contract exists |
| TRENDING | Hidden until window/decay/event contract exists |
| Recommendations | Separate personalized section in a future authenticated contract, never fabricated from public order |

The frontend must not recompute or blend server ranks.

## 12. Epic 10B test plan

### Typed client tests

- serializes each query parameter and combinations correctly;
- trims/omits empty `q`, preserves Unicode, and URL-encodes special characters;
- does not send unavailable sorts;
- maps additive nullable Episode metadata and cover URL;
- preserves Problem Details and refresh behavior.

### Component tests

- initializes controls from URL and updates URL deterministically;
- query/filter/sort changes reset page;
- back/forward restores state;
- stale/aborted requests cannot overwrite newer results;
- loading, empty, validation, network, retry, and pagination states;
- Thai exact character-sequence query behavior is represented honestly;
- latest Episode action uses `resolvePublicEpisodeHref`;
- Home public results still render if Continue Reading fails;
- anonymous Home never calls personal endpoints without a session;
- no mock fallback or `dangerouslySetInnerHTML`.

### Browser E2E

- anonymous LATEST and UPDATED discovery;
- English and Thai basic queries;
- Story type, Category, Tag, creator, language, and content rating filters;
- combined filters and deterministic page navigation;
- shared/back-forward URL state;
- empty and validation behavior;
- Story Detail and NOVEL/COMIC/VIDEO reader routing;
- existing creator authoring/publish workflows;
- authenticated Continue Reading remains isolated;
- no content from legacy mock search appears.

## 13. Open frontend questions

1. Is Home the canonical search route, or should `/search` share the same real
   components?
2. Should query changes submit explicitly or debounce after product UX review?
3. Which filters must be visible initially versus behind an expanded panel?
4. Should latest published Episode metadata add a direct “start/latest” action
   on cards, or remain informational?
5. How should UPDATED be labeled if product later includes Episode activity?
6. Is exact creator slug filtering exposed through creator links only, or a
   user-entered control?
7. What no-results guidance is preferred for Thai Phase 1 limitations?

## 14. Epic 10B implemented integration

Home treats the URL query string as the source of truth for `q`, pagination,
StoryType, active category slug, normalized textual tag, creator slug, language,
content rating, and sort. Reload, back navigation, and shared links restore the
same request. A submitted non-empty query exposes and defaults to `RELEVANCE`;
clearing it removes that option. Latest and Updated remain available without a
query.

The client sends one discovery request per state transition and consumes
additive nullable latest-Episode metadata from the response, so Story cards
create no Episode N+1 requests. API errors use the existing Thai-first mapping
with retry, and empty results are distinct from failures. Anonymous discovery
has no session requirement or mock fallback; Library and Continue Reading keep
their private authenticated contracts.
