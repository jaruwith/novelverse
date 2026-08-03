# Community C Frontend Likes, Reports, and Moderation

## Discussion integration

The shared Story/Episode DiscussionPanel consumes server-authored `likeCount`,
`isLikedByViewer`, and `canLike` fields for roots and Replies. It never infers Like
authority from authorship presentation, creator badges, Story ownership, or role.
Anonymous readers see the count. `isLikedByViewer` means a relationship exists,
while `canLike` means the current viewer may mutate it now. An ineligible viewer may
therefore receive `true/false`; the UI shows the confirmed Liked state without an
enabled Unlike action because the backend requires ACTIVE/profile eligibility for
both PUT and DELETE. When mutation is available, `aria-pressed` mirrors
`isLikedByViewer`; “Like Comment” and “Unlike Comment” remain distinct from Story
Like on Story Detail.

Like and Unlike use the shared authenticated client, no-store requests, duplicate
suppression, AbortController, session generation, and server-confirmed results.
There is no optimistic count. A `401` clears private state through the centralized
session transition; `404`/`409` reconcile from the relevant root/Reply list; `429`
and network failures preserve confirmed values.

## Comment reports

Authenticated viewers can open a target-bound `CommentReportDialog` for any active
projected Comment. The dialog sends only reason and optional details to the dedicated
Comment report route. The Comment body is never copied into frontend state for the
report request or logs; the server captures restricted evidence transactionally.
The modal traps focus, restores it on close, suppresses duplicate submissions, and
uses the same session/request guard as other Discussion mutations.

Mutation ownership is operation-scoped rather than global: root create, per-root
Reply create, per-Comment edit/delete/Like/report each receive a stable key and their
own guarded request. Starting a report cannot invalidate an unrelated Like, and two
Comments may reconcile independent Likes in either completion order. Session,
terminal-401, and route generations still invalidate every scope synchronously;
completed keys are removed so the map stays bounded.

## Moderator queue

The existing moderator-only queue now filters and labels COMMENT targets and renders
restricted report-time evidence as plain text. It distinguishes VISIBLE, HIDDEN, and
DELETED current state and identifies report-time spoiler state. It neither interprets
HTML nor exposes evidence on public/creator routes. Hide/Restore requests include a
cryptographically random operation ID and retain existing Story/Episode/User behavior.
Loads are abortable and session-generation bound.

## Reconciliation and accessibility

External Hide, Restore, account unlink, or lifecycle changes are reflected on the
next authoritative list/reply reconciliation. Hidden roots conceal their subtree;
restored content returns only when the server projects it. Tombstones have no Like or
report controls. All controls are keyboard accessible, counts are labelled, reports
use field labels and linked status/error text, and evidence uses plain text with
preserved line breaks.

## Security and persistence

Community C introduces no mock fallback, Comment cache, localStorage/sessionStorage
payload, IndexedDB, service-worker cache, unsafe HTML, Markdown, actor ID, or
client-derived authorization. Existing token storage remains owned by the centralized
legacy session client and is not duplicated by Community.

## Tests and release boundary

Focused parser, API, controller, UI, session, report, evidence, and moderator tests
cover server capability contradictions, stale completion, duplicate clicks,
accessibility, and literal rendering. The real-stack workflow uses PostgreSQL,
Release API, Next.js, and real JWTs for Like persistence, reporting, moderation,
privacy unlink, Story and all reader formats, and mock-fallback detection.
Blocker-closure validation passed lint, typecheck, 214/214 tests, the 121-route
production build, and consecutive 74.9- and 73.2-second real-stack workflows; the
first successful pass's Community portion completed in 20.0 seconds with
`mockFallbackDetected: false`.

Reviews/Ratings, notifications, feeds, mentions, blocks/mutes, reactions, realtime,
creator moderation, retention expiry, and legal-hold operations remain out of scope.
The first independent Community review failed because the parser rejected the valid
liked-but-ineligible projection and the controller used one global mutation request
ID. Those defects and their deferred-promise regressions are now closed. A fresh
independent approval review is still required before release approval.

During blocker-closure validation, two Browser E2E attempts failed because the
harness still used the superseded pre-ADR Like/report quota thresholds. The harness
was corrected to cross the approved capacity-30 Like bucket and capacity-5 report
bucket, after which two consecutive complete real-stack runs passed. The failed
attempts remain part of the validation history rather than being relabelled as
passes.

## Final evidence-summary closure

The later focused approval review found no remaining product defect but failed on
two evidence gates: the backend unlink/moderation race lacked deterministic coverage,
and the real-stack final JSON did not explicitly say whether Community mutation
concurrency and limiter assertions had completed. This document preserves that
failed approval history; final approval still belongs to a subsequent review.

The E2E workflow now creates a new evidence state for each process. Both fields
default to `false`:

- `communityMutationConcurrencyVerified` becomes `true` only after the stale
  edit/concurrent server update has returned `409`, the UI has reloaded confirmed
  truth, and a subsequent edit has reconciled from the new server tag;
- `communityLimiterAssertionsVerified` becomes `true` only after the Create,
  Like/Unlike, and Comment-report real API paths have each crossed their configured
  quota and observed `429`.

The successful-summary helper refuses a partial state or a detected/unknown mock
fallback. Four dependency-free Node tests cover false defaults, partial execution,
failed-summary rejection, boolean types, unknown limiter kinds, and isolation across
consecutive state instances. Fresh validation passed those 4/4 tests, the 110/110
cumulative Community/frontend integration selection, lint, typecheck, and the
121-route production build. Two consecutive full real-stack runs passed in 88.1 and
78.3 seconds (Community portions 20.618 and 22.686 seconds); both final JSON objects
reported `communityMutationConcurrencyVerified: true`,
`communityLimiterAssertionsVerified: true`, and `mockFallbackDetected: false`.
