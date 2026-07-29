# Epic 9A — Frontend Public Discovery

The public root route now uses `GET /api/v1/stories` and
`GET /api/v1/categories`; it has no mock fallback. Visitors can filter published
Stories by NOVEL, COMIC, VIDEO, and active category, page through deterministic
results, and retry network failures.

Story cards link to `/stories/{creatorSlug}/{storySlug}`. Story Detail loads safe
public Story metadata and its published Episode list. Episode links are produced
only by `resolvePublicEpisodeHref`:

- NOVEL → `/read-novel/{creatorSlug}/{storySlug}/{episodeSlug}`
- COMIC → `/read-comic/{creatorSlug}/{storySlug}/{episodeSlug}`
- VIDEO → `/watch-video/{creatorSlug}/{storySlug}/{episodeSlug}`

The new Novel route consumes the public content endpoint and renders the existing
safe text/image/divider renderer. Comic and Video retain their established
public readers. All public routes work without authentication; creator routes
retain their existing guards.

Unit tests cover loading, StoryType/category filtering, empty and retry states,
cards, detail metadata, Episode states, anonymous API calls, and route mapping.
The local vertical-slice Playwright script verifies discovery, each Story Detail,
and all three reader destinations using real API-created content.

Deferred work includes search ranking, library/bookmark/history, popularity,
recommendations, ratings, comments, reader polish, and large Episode-list UI
pagination.
