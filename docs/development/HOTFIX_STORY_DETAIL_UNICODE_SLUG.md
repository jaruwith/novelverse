# Story Detail Unicode slug hotfix

## Observed behavior

Discovery generated a correctly encoded public Story URL for a Unicode slug, but client navigation could supply the dynamic Next.js parameters in their encoded form. Story Detail forwarded those values as application slugs. The shared API client then encoded each path segment, turning `%E0...` into `%25E0...`; the API correctly returned its generic not-found response for that nonexistent literal slug.

## Boundary decision

Dynamic public route segments are decoded exactly once at the Next.js route boundary. Components and application-domain state receive raw slugs. The shared API client retains `encodeURIComponent` for every outbound path segment, so raw Unicode, spaces, and reserved characters are encoded exactly once before an HTTP request.

Malformed percent encoding is rejected by the route boundary and renders the existing generic unavailable response without calling an API or exposing an exception.

## Affected routes

- `/stories/[creatorSlug]/[storySlug]`
- `/read-novel/[creatorSlug]/[storySlug]/[episodeSlug]`
- `/read-comic/[creatorSlug]/[storySlug]/[episodeSlug]`
- `/watch-video/[creatorSlug]/[storySlug]/[episodeSlug]`

Creator authoring routes use identifiers rather than public slugs. Legacy mock routes do not feed these public API clients and are outside this hotfix.

## Regression evidence

Focused tests cover raw and encoded Unicode, ASCII slugs, creator slugs, spaces and special characters, one-pass decoding, malformed encoding, Story and Episode loading, generic missing-Story behavior, and single-encoded Story/NOVEL/COMIC/VIDEO API URLs. The real-stack Browser E2E creates a Thai Story and Episode, navigates from Discovery, reloads Story Detail and the NOVEL reader, verifies content, and rejects `%25E0` requests or mock fallback.

## Limitations

This change does not alter public URL formats, stored slugs, redirects, backend eligibility, or database state. It does not normalize arbitrary query-string values or identifier-based creator authoring routes.
