# Epic 9B — Reader Library & Progress (Frontend)

The public Home, Story Detail, and NOVEL/COMIC/VIDEO readers remain available without authentication. Personal reader state uses the real authenticated API and the existing refresh-token request flow.

## Routes and components

- `/library` renders Bookmarked Stories and Continue Reading. It redirects anonymous users to `/login?next=%2Flibrary`.
- Story Detail offers a bookmark control without making the page private. Anonymous bookmark intent preserves the return destination.
- Authenticated Home renders a bounded Continue Reading section. Personal-state failure is isolated from public discovery.
- All resume links use `resolvePublicEpisodeHref`.

The three public readers call the shared progress recorder only after their public content succeeds. The recorder skips anonymous sessions, coalesces duplicate in-flight calls, suppresses React Strict Mode duplicate writes, and treats progress failure as non-blocking.

## API contracts

The typed API client supports bookmark add/remove/list and progress upsert/list. JWT attachment, refresh rotation, Problem Details mapping, and Thai-first errors remain centralized in the existing client. No user ID is sent and no mock fallback exists.

## Validation

Unit coverage includes Story Detail bookmark behavior, authenticated Library loading/removal, anonymous redirect, Home Continue Reading visibility, route construction, duplicate progress suppression, and non-blocking failures. The real browser workflow verifies bookmark/progress persistence and resume navigation while retaining the existing authoring and anonymous reader slice.

## Limitations

Progress is stored at Episode granularity. Paragraph, Comic page, and Video timestamp resume, offline state, personalization, and UI polish are deferred.
