# Community B Frontend Discussion

- Status: Implemented and under validation on `feature/community-architecture`
- Backend contract: Community A with server-authoritative viewer capabilities
- Scope: Discussion UI only; Community C safety, moderation, Like, and privacy work remains

## Runtime boundary

`DiscussionPanel` is the shared orchestration boundary for Story Detail and the
NOVEL, COMIC, and VIDEO readers. Story Detail supplies a raw Story target;
`ReaderFrame` supplies a raw Episode target after format content and Reader
Navigation. Community failure is contained inside the panel and does not replace
otherwise valid Story or Episode content.

The implementation is split into the strict parser and API module, the
`useDiscussionController` state layer, `CommentList`, `CommentItem`, `ReplyList`,
`CommentComposer`, `CommentEditor`, `DeleteCommentDialog`, and `SpoilerContent`.
Leaf components render accessible interaction; the controller owns request,
pagination, session, and reconciliation state.

Legacy Comment mocks are not used by production Story Detail or reader routes.
The reachable legacy Story/comic chapter surfaces no longer render their mock
Comment list, and the legacy mock admin Comment page is explicitly retired.

## Typed server contract

Targets are discriminated Story/Episode identities. Raw Unicode slugs remain raw
inside components and each outbound route segment is encoded once. Parsers
validate exact public fields, UUIDs, timestamps, parent relationships, target,
sort, page size, cursor consistency, author/tombstone shape, and capability/tag
relationships. Extra fields, including internal user or moderation data, cause a
contract error.

Each Comment projection carries `isOwnedByViewer`, `canEdit`, `canDelete`, and a
nullable `editTag`. UI ownership is never inferred from display name, creator
slug, badge, target ownership, or role. Edit appears only for `canEdit` plus a
server tag; Delete appears only for `canDelete` plus the same approved server
tag. Tombstones and non-owners have no tag or author controls. These fields guide
the UI only; the API authorizes every mutation again.

The shared authenticated API path supplies JWT state and terminal-401 handling.
GET remains anonymous, but invalid supplied credentials remain a 401. Community
calls use `no-store`, accept `AbortSignal`, and preserve typed Problem Details.
Create uses a cryptographically random `Idempotency-Key`; `201` plus
`Idempotent-Replay: false` represents a first result and `200` plus `true` a
replay. Edit and Delete use the exact `editTag` in `If-Match`; ETag is checked
against returned projections. A missing, weak, or mismatched mutation ETag is a
contract error; neither client nor server accepts a synthesized or weak tag.

## State, pagination, and mutations

Roots start OLDEST and may switch to NEWEST. Roots and each expanded Reply list
request 20 rows at a time, retain separate opaque cursors, deduplicate by ID, and
preserve confirmed pages on incremental failure. Replies are OLDEST and exactly
one level. No totals, page numbers, ranking, recursive loading, or unbounded fetch
exists.

Drafts normalize CRLF/CR to LF and use NFC for advisory validation. Counts use
Unicode scalars rather than UTF-16 code units, with limits of 4,000 scalars and
40 lines. React text nodes plus `white-space: pre-wrap` render Thai, emoji,
combining text, and HTML-like input literally; there is no Markdown, HTML parser,
auto-linking, or `dangerouslySetInnerHTML`.

Root and Reply creation never fabricate an item. A failed uncertain submission
retains the same key only while its normalized body/spoiler payload is unchanged;
changed content receives a new key. Successful projections alone enter the list.
NEWEST inserts the confirmed result at the front. OLDEST appends only when the
tail is fully loaded; otherwise it refetches authoritatively.

Edit replaces only the matching server projection. A 409 performs one list or
Reply reconciliation while preserving the last confirmed content and editor
input. Delete uses an irreversible trapped-focus confirmation, waits for 204,
and refetches: a deleted Reply disappears, an empty root disappears, and a root
needed by visible Replies becomes only the neutral server tombstone. No Restore
action exists.

Whole-body spoiler text is not rendered before reveal and therefore is absent
from both visual and accessibility output. A native button with `aria-expanded`
reveals or hides it for the mounted session only. Tombstones expose no spoiler
state.

## Session isolation and errors

Every load and mutation is bound to target identity, request ID, an
`AbortController`, and the centralized in-memory session generation. Target,
sort, logout, terminal 401, or account replacement invalidates and aborts older
work. Success, failure, and finally callbacks check the generation before any
state update. A session event clears drafts, editors, confirmation state, pending
state, and prior viewer capabilities before revalidating the public discussion.
Comment payloads and drafts have no browser or module-global cache.

Independent mutations additionally use bounded operation keys (root create,
per-root Reply create, and per-Comment edit/delete/Like/report), so starting one
operation does not invalidate an unrelated callback. Session or route invalidation
still clears every operation scope synchronously.

Problem Details are reconciled explicitly: 400 retains confirmed state and shows
validation; 401 invalidates private state and refetches anonymous data; 403 shows
generic eligibility feedback; target 404 conceals only the panel; mutation 404
revalidates without lifecycle disclosure; 409 performs one authoritative
reconciliation; 413 and 429 preserve the draft with specific guidance (including
browser-readable `Retry-After`); network and 5xx failures preserve confirmed
content and expose retry.

## Accessibility and reader behavior

The panel is a labelled section with semantic lists/articles, Reply hierarchy,
authors, timestamps, edited/tombstone text, field-linked errors and counters,
native keyboard controls, polite bounded announcements, focus on confirmed
creates/edits, and a trapped-focus Delete dialog with restoration or a logical
fallback. Mobile controls preserve source order and minimum touch height.

Reader Navigation excludes textarea, select, button, link, dialog, and other
interactive descendants from ArrowLeft/ArrowRight shortcuts. The shared panel is
inside that protected reader shell, leaving content rendering, progress writes,
navigation, and the existing Episode Report independent.

## Validation evidence

Focused tests cover strict parsing, exact encoding, create/replay and ETag/header
rules, Unicode validation, capability-only controls, spoilers, pagination retry
and deduplication, one-level Replies, edit conflict reconciliation, delete 204,
focus, terminal 401, and deferred A-to-B callback isolation. Integration tests
assert Story plus all three reader insertion points and scan production Community
sources for mock fallback, unsafe HTML, and private browser persistence.

The real-stack suite exercises PostgreSQL, the Release API, Next.js, and real JWT
sessions for anonymous/owner/other/hidden-profile/creator/moderator views,
idempotent creation, more than 20 roots, Replies, edit conflict, deletion and
tombstones, spoilers, all reader formats, invalid credentials, 400/413/429,
CORS/no-store headers, keyboard isolation, and `mockFallbackDetected: false`.
Exact totals and durations belong to the validation report, not this design note.

## Remaining Community C boundary

Community B intentionally contains no Comment Like, Comment Report, moderator
Hide/Restore, privacy-unlink execution, Reviews/Ratings, feed, notification,
mention, block/mute, reaction, realtime, creator-pinning, or retention-expiry UI.
Community C must deliver the approved abuse, moderation, and privacy controls and
their evidence. Release remains blocked until those controls and the documented
Beta/Production policy and operations gates are complete.
