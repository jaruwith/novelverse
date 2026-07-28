# Social Graph Frontend Contract

Epic 12C is architecture-only. No Like or Follow UI is implemented in this sprint.

## Planned API shape

Authenticated actions will use typed API methods such as `PUT/DELETE /api/v1/stories/{storyId}/like` and `PUT/DELETE /api/v1/creators/{creatorSlug}/follow` (final routes must match the backend contract). Requests contain no actor ID or count. Responses are additive state projections: `isLiked` or `isFollowing`, with server timestamps where useful. Repeated actions are safe no-ops; conflicts use existing Problem Details conventions.

Anonymous readers see a sign-in requirement rather than a fabricated or locally persisted social state. URL, Story Detail, Library, and reader state remain independent from social actions.

## UI and cache boundaries

Like is placed on Story Detail and Follow on the public creator surface when those surfaces exist. Controls are hidden or disabled for inaccessible, hidden, unpublished, or deleted targets. The frontend never renders a public like/follower count in 12C. Personalized state must not share anonymous discovery caches; Library and Continue Reading remain separate from social responses.

Mutations are server-confirmed rather than optimistic: do not flip Like/Follow state before acceptance, so rollback is deterministic and no speculative count is shown. After a successful mutation, update only the affected typed state. On 401, preserve content and offer login. On 403/404, use generic unavailable or authorization messaging. On 409, refetch the target state once and avoid retry loops. Network failure leaves reader/discovery content usable and offers a bounded retry.

## Notifications and future consumers

The frontend does not poll or deliver notifications in 12C. A later outbox-backed API may provide unread notification summaries. Recommendation and analytics responses must never expose another user’s graph or raw event facts. Blocked users and hidden targets are filtered server-side, not merely hidden with CSS.

## Testing contract

Epic 12D/15 tests should cover anonymous access, authenticated toggles, duplicate/concurrent requests, reload/back persistence, hidden/restored Stories, blocked/deleted users, optimistic update rollback, 401/403/404/409 handling, no mock fallback, no `dangerouslySetInnerHTML`, and regression of Story Detail, readers, Library, Bookmark, Progress, and Moderation. Browser tests must use real API fixtures and verify a Like/Follow state survives reload without exposing counts.

## Non-goals

No social UI, notification center, public counts, user-to-user graph, Likes, Follows, recommendation ranking, or analytics dashboard is added by Epic 12C architecture design.
