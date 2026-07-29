# Social Graph Frontend Contract

Epic 12C implements the minimal Story Detail Like/Follow UI described below.

## Planned API shape

Authenticated actions will use typed API methods such as `PUT/DELETE /api/v1/stories/{storyId}/like` and `PUT/DELETE /api/v1/creators/{creatorSlug}/follow` (final routes must match the backend contract). Requests contain no actor ID or count. Responses are additive state projections: `isLiked` or `isFollowing`, with server timestamps where useful. Repeated actions are safe no-ops; conflicts use existing Problem Details conventions.

Anonymous readers see a sign-in requirement rather than a fabricated or locally persisted social state. URL, Story Detail, Library, and reader state remain independent from social actions.

## UI and cache boundaries

Like is placed on Story Detail and Follow on the public creator surface when those surfaces exist. Controls are hidden or disabled for inaccessible, hidden, unpublished, or deleted targets. The frontend never renders a public like/follower count in 12C. Personalized state must not share anonymous discovery caches; Library and Continue Reading remain separate from social responses.

Mutations are server-confirmed rather than optimistic: do not flip Like/Follow state before acceptance, so rollback is deterministic and no speculative count is shown. After a successful mutation, update only the affected typed state. On 401, clear both viewer-specific states, preserve Story content, and return controls to sign-in behavior. A Story-social 404 uses generic Story unavailable rendering; a CreatorProfile-social 404 conceals only Follow state/control so independently visible Story content remains. On 409, refetch the affected authoritative state once and avoid retry loops. A 429 or network failure retains the last server-confirmed state and leaves Story/reader content usable.

## Notifications and future consumers

The frontend does not poll or deliver notifications in 12C. A later outbox-backed API may provide unread notification summaries. Recommendation and analytics responses must never expose another user’s graph or raw event facts. Blocked users and hidden targets are filtered server-side, not merely hidden with CSS.

## Testing contract

Epic 12C tests cover anonymous access, authenticated toggles, duplicate/concurrent requests, reload persistence, hidden/restored Stories and CreatorProfiles, privacy unlink, 400/401/404/409/429 handling, no mock fallback, no `dangerouslySetInnerHTML`, and regression of Story Detail, readers, Library, Bookmark, Progress, Moderation, and Engagement. Browser tests use real API fixtures and verify Like/Follow persistence without exposing counts or identities.

## Implemented behavior

Story Detail reads authenticated Like and Follow state from server-backed state endpoints and sends explicit PUT/DELETE mutations. Anonymous users are redirected to sign-in. Central session-change notifications clear viewer state on logout/terminal 401 and refetch it after login, preventing cross-viewer reuse. Expected errors reconcile as specified above; a failed 409 refetch or network request retains prior server-confirmed state. Controls are disabled during a mutation and use `aria-pressed`; self-follow 400 and hidden-Creator 404 conceal Follow control. Counts and user identity lists are not rendered.

## Non-goals

No notification center, public counts, user-to-user graph, recommendation ranking, or analytics dashboard is added by Epic 12C. Anonymous Like/Follow mutation remains unsupported.
