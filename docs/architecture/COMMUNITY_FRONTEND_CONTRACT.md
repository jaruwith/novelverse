# Community Frontend Contract

- Status: Community B/C implemented locally; independent cumulative review and Beta/Production gates remain open
- Baseline: `v1.2.0-alpha.1`
- Scope: Community v1 architecture only
- Backend authority: `NovelVerseApi/docs/architecture/COMMUNITY_ARCHITECTURE.md`

## Purpose and boundary

Community v1 adds a real, shared discussion experience to Story Detail and every
Episode Reader format. Anonymous visitors can read eligible discussions. Active
authenticated members can post root Comments and one-level Replies, edit or
delete their own content, Like useful Comments, and report abuse. Moderator UI
extends the existing real queue to Comment reports and Hide/Restore.

Required v1 behavior:

- Story and Episode discussions;
- one-level Replies;
- one Like reaction;
- author edit and irreversible delete;
- whole-Comment spoiler conceal/reveal;
- reporting and platform-moderator Hide/Restore;
- creator badge without creator moderation power;
- bounded keyset pagination and deterministic ordering;
- session-safe, server-confirmed mutation reconciliation.

Deferred or excluded:

- Reviews and Ratings use a later, separate Community architecture;
- no feeds, mentions, blocks, mutes, multiple reactions, creator pinning,
  notification center, real-time delivery, rich HTML, Markdown, or mock fallback;
- History, Library, and Continue Reading behavior is unchanged.

The legacy mock Comment surfaces and mock administrator Comment page are not v1
evidence. Implementation must remove, redirect, or clearly retire every reachable
mock route before release. The mock Following page is outside this package.

## Insertion points and ownership

One shared `DiscussionPanel` owns Community data loading and mutation state.

- Story Detail renders it after the Episode list and before unrelated footer
  content, using canonical creator and Story slugs already returned by the server.
- `ReaderFrame` renders it after format content and the Reader Navigation/report
  region. NOVEL, COMIC, and VIDEO retain all format-specific rendering.
- The moderator queue uses its existing application shell and receives a typed
  COMMENT target presentation.

The shared panel owns Comment/Reply lists, pagination, composers, edit/delete,
Like, report entry, spoiler reveal, focus, announcements, and session safety. It
does not own Story/Episode content, Reader Navigation, progress writes, engagement
views, format layout, or moderation authority.

`DiscussionPanel` is the orchestration boundary, not one monolithic component.
The typed client/parser, session-safe controller hook, root list, Comment item,
Reply list, composer/editor, and confirmation/report dialogs remain separable
responsibilities with narrow props. Shared state owns request identity and
server reconciliation once; leaf components own rendering and local accessible
interaction only. No leaf duplicates lifecycle, authorization, or cursor rules.

No client code invents a target ID or actor ID. Public target routes use raw
Unicode slugs internally and the existing canonical encode-once route resolver at
the outbound boundary. A Discussion target is a discriminated union:

```ts
type DiscussionTarget =
  | { kind: "STORY"; creatorSlug: string; storySlug: string }
  | {
      kind: "EPISODE";
      creatorSlug: string;
      storySlug: string;
      episodeSlug: string;
    };
```

## Typed API boundary

The client adds typed methods and runtime parsers for:

- list/create Story Comments;
- list/create Episode Comments;
- list/create direct Replies;
- edit/delete own Comment;
- Like/Unlike Comment;
- report a COMMENT target;
- moderator queue/detail/Hide/Restore with COMMENT presentation.

All methods accept `AbortSignal` where a response can outlive a route or session.
Runtime parsing validates routing IDs, parent relationship, timestamps, version,
sort, nullable body, tombstone and spoiler state, safe public author shape,
capabilities, counts, and cursor metadata. Unknown fields do not become authority.
Incomplete, malformed, internally contradictory, or oversized projections fail as
typed response errors instead of reaching rendering code.

No request includes `UserId`, moderator identity, lifecycle reason, internal note,
or caller-computed Like/count authority. Create commands include a freshly
generated in-memory cryptographically random UUID idempotency key; a retry of the
same pending draft reuses the same key, while a material normalized body/spoiler
change receives a new key. Tokens and keys are never placed in URLs or payload
caches.

Community A closes the viewer-capability boundary explicitly. Every Comment
projection includes `isOwnedByViewer`, `canEdit`, and `canDelete`, plus nullable
`editTag`. Anonymous and other-user reads return false capabilities and a null
tag. An eligible owner receives the server-derived capabilities and exact tag;
hidden-profile generic author presentation does not change ownership. A target
creator or moderator receives no author capability merely from that role.
Tombstones expose neither capabilities nor a tag. The frontend must use these
fields for author controls and must never infer ownership from display name,
creator slug, badge, profile visibility, or any locally known user identifier.
Capabilities remain UX assistance; mutations remain server-authorized.

The backend CORS allowlist must accept `Idempotency-Key` and `If-Match` and expose
`Retry-After`, `ETag`, and `Idempotent-Replay`. Browser tests must prove the real
cross-origin preflight and header readability rather than mocking them.

Community responses are treated as `no-store`. No Comment, draft, Like state,
cursor, private author capability, report, or moderation payload is stored in
`localStorage`, `sessionStorage`, IndexedDB, Cache API, or a service worker.

## Read state machine

Every load is bound to route identity, request ID, and centralized session
generation. Changing route, logging out, terminal `401`, or signing in as another
user synchronously invalidates the prior generation and aborts supported requests.
Late success, failure, and finally callbacks are discarded.

States are explicit:

- **loading:** the current page has no confirmed result;
- **empty:** a confirmed eligible target has no root Comments;
- **ready:** confirmed roots render in stable server order;
- **load-more:** retain confirmed rows while the next cursor is requested;
- **page retry:** retain confirmed rows and retry only the failed cursor;
- **target unavailable:** generic discussion unavailable state on target `404`;
- **transient failure:** current confirmed content remains, with retry;
- **session transition:** private viewer capabilities/drafts/errors clear
  synchronously and the public list is revalidated for the new generation.

Root and Reply pagination are independent. Each root expands and paginates only
its direct Replies. Items are deduplicated by ID while preserving server order;
cursor progress is accepted only from the matching request. The UI never infers a
total, never issues an unbounded request, and never recursively fetches children.

Default root sort is Oldest. Newest is the only alternative. Changing sort aborts
the previous request and clears its cursor. Replies are Oldest only.

## Mutation reconciliation

Mutations are server-confirmed. The UI may show a busy affordance but does not
fabricate an authoritative Comment, Like count, tombstone, or moderation state.

### Create and Reply

- Anonymous users see a sign-in action with the existing validated local `next`
  path; no open redirect is accepted.
- Only an active authenticated session exposes an enabled composer.
- The draft is normalized and validated locally for timely feedback, but the
  backend remains authoritative; local scalar guidance rejects lone surrogates
  before `Array.from(value.normalize("NFC"))` counting.
- A successful create inserts the parsed server item only if its route/request/
  session generation still matches.
- A transient failure preserves the draft and idempotency key for safe retry.
- A Reply composer is available only under a visible active root; Replies cannot
  reply to Replies.

### Edit

Edit starts from the server body, version, and server-issued `editTag`. Save sends
that exact tag in `If-Match`; the client never synthesizes it. Success
replaces only the matching item. `409` retains the editor, announces the conflict,
and offers a server refresh without silently overwriting either body. Cancel
restores the last confirmed projection.

### Delete

Delete uses an accessible confirmation dialog and `If-Match`. The UI waits for
`204`, then reconciles by removing the item or fetching the neutral root tombstone
when Replies require it. Delete is not presented as reversible. Moderator Restore
is never shown for author deletion.

### Like

Like and Unlike use one in-flight mutation per Comment per session generation.
Buttons expose `aria-pressed`, busy state, and the last confirmed count. The UI
does not permanently increment ahead of the server. Late responses after route or
session change are ignored. Self-Like is rejected by the Comment contract;
hidden, deleted, and unavailable responses are reconciled from typed Problem
Details.

`isLikedByViewer` is existing relationship state and `canLike` is current mutation
eligibility. The parser accepts authenticated `true/false` for an ineligible viewer
but continues to reject it for anonymous, owner, or tombstone projections. Because
the backend applies ACTIVE/profile eligibility to Unlike as well as Like, the client
renders confirmed “Liked; unavailable to change” text without fabricating an Unlike
permission when `isLikedByViewer` is true and `canLike` is false.

Mutation request ownership is scoped by stable operation keys: root create,
per-root Reply create, and per-Comment edit, delete, Like/Unlike, and report. An
unrelated mutation never invalidates another operation's success, error, or finally
callback. Route/session invalidation aborts all scopes, while completion removes its
key so the in-memory map remains bounded.

### Report and moderation

The existing Report dialog gains COMMENT as a typed target and retains accessible
modal, reason, busy, error, and confirmation behavior. It never renders internal
notes or moderation identity publicly. Creators receive no extra moderation
control.

The real moderator queue labels Comment targets, shows authorized evidence, and
performs Hide/Restore with the existing concurrency and server-confirmed audit
workflow. A hidden root and its visible Replies disappear together from public
state after revalidation; the moderator UI does not leak evidence into public
caches.

The client respects the backend's three record classes. Public discussion UI may
render only current body/spoiler, safe author projection, Likes, and neutral
tombstones. Operational lifecycle, idempotency, concurrency, and moderation state
remain server authority except for the safe capabilities/edit tag required by the
contract. Restricted report-time snapshots and moderation audits are available
only within authorized platform moderation/safety UI, use `private, no-store`,
and never flow into public pages, creator tools, engagement metrics,
recommendations, discovery, analytics, notifications, browser persistence, or
ordinary client logs.

## Content rendering and spoilers

Comment bodies are plain text. Rendering uses React text nodes with preserved
newlines; no `dangerouslySetInnerHTML`, Markdown renderer, HTML parser, automatic
linkification, or script/style interpretation is allowed. Emoji and safe Unicode
remain text. The server-normalized value is authoritative after a mutation.

`isSpoiler` covers the whole body. Before reveal, the body is neither visually
shown nor exposed in the accessible name/description tree. A real button reveals
it for the current mounted item; reveal state is ephemeral and clears on route or
session transition. It is not a CSS blur over readable text.

The unrevealed button has an understandable label such as “Reveal spoiler
comment by {safe author}”, exposes `aria-expanded`, and controls the body region.
It is keyboard operable, retains focus when revealing, and announces availability
without announcing the hidden body. The body enters the accessibility tree only
after activation.

Neutral author-deleted/account-deleted root tombstones contain no author, body,
spoiler content, capability, or reason. Moderator-hidden content is absent from
public responses rather than represented with an internal state label.

## Error contract

Every API failure uses the existing typed Problem Details path:

| Status | UI behavior |
|---|---|
| `400` | field or cursor validation near the initiating control |
| `401` | clear private Community state via centralized session handling; offer sign-in |
| `403` | generic not-allowed state without role or policy inference |
| `404` | conceal unavailable target/Comment and revalidate the affected list |
| `409` | preserve user input; announce concurrency/idempotency conflict and refresh |
| `413` | preserve draft; announce body-size limit |
| `429` | preserve draft/state; expose server `Retry-After` and disable retry until eligible |
| `5xx` | retain confirmed content/draft where safe and offer bounded retry |

Errors, loading, retry, and busy state belong to the matching generation and
request. A stale callback cannot clear a newer busy state or show an old user's
error.

## Accessibility contract

- Discussion has a labelled region and heading; roots form a semantic list and
  each item is an article with stable heading/author/time relationships.
- Reply lists are labelled by and structurally nested beneath their root without
  implying depth beyond one.
- Composer labels, instructions, error references, current/max character count,
  spoiler checkbox, and submit state are programmatic and not color-only.
- Posting focuses the confirmed Comment; replying focuses the confirmed Reply;
  edit returns focus to the edited item; delete moves focus to the next logical
  item or discussion heading.
- Polite live announcements cover post, edit, delete, Like, page load, retry,
  conflict, and moderation results without repeating the full body.
- Delete and Report dialogs use the existing modal focus trap, initial focus,
  Escape/close behavior, return focus, labelled title, and described errors.
- All actions are native buttons/links and keyboard reachable. No reader Arrow key
  handler fires while focus is in a composer, button, dialog, interactive Reply,
  or video-provider interaction.
- Like state uses text and `aria-pressed`; hidden/tombstone/spoiler state is not
  conveyed by color alone.
- Loading and pagination preserve focus and do not reorder already confirmed rows.
- Desktop and mobile expose the same actions and reading order with touch targets
  meeting the existing design-system minimum.

## Security and privacy invariants

- Actor authority comes only from the authenticated server session.
- Canonical routes encode each raw Unicode segment exactly once.
- The client cannot cross-target a Reply because it sends only the selected root
  ID to the dedicated route and accepts the server projection.
- Plain-text rendering prevents stored XSS; no generated or user-supplied href is
  rendered from a Comment body.
- Session generation, request IDs, and aborts prevent cross-user payload or Like
  state leakage and late-response overwrite.
- Private Community data and drafts have no browser persistence or module-global
  actor cache.
- Oversized bodies, flood limits, ownership, hidden state, and moderation are
  backend decisions; disabled UI is never a security control.
- Logs and analytics must exclude body text, tokens, idempotency keys, report
  evidence, internal notes, and moderator identity.

## Query-facing UX budgets

- Initial and incremental pages request 20 items; user selection may request at
  most the server maximum of 50.
- Root and each expanded Reply list make one request at a time and abort stale
  work.
- The client never preloads every Reply list or polls.
- The default response has a measured 128 KiB target and every response has a
  hard 256 KiB limit. Page size is an upper bound; a byte-capped response may
  contain fewer items while preserving `hasMore` and a cursor after the last
  emitted item.
- Loading skeletons do not manufacture counts, authors, or Comments.

## Executable validation plan

Focused frontend tests must cover:

- Story and Episode insertion, including NOVEL, COMIC, and VIDEO Readers;
- anonymous read/sign-in, active account composer, inactive-account denial;
- parsers rejecting malformed targets, parents, versions/edit tags, authors, tombstones,
  capabilities, counts, and cursors;
- root sorts, boundary pages, load-more retry, Reply expansion/pagination, ID
  deduplication, route change cancellation, and late-result rejection;
- create/replay, edit/no-op/conflict, delete confirmation/tombstone, Like/Unlike,
  report, and typed `400/401/403/404/409/413/429/5xx` behavior;
- logout, terminal `401`, User A to User B, same-user re-login, and stale success,
  error, and finally callbacks;
- account-unlinked public author/body/Like removal, incoming Reply tombstones,
  moderator-only evidence preservation, and no evidence leakage into public or
  creator surfaces;
- spoiler body absent from the accessibility tree until reveal;
- focus restoration, live announcements, modal semantics, `aria-pressed`, field
  errors, character count, mobile controls, and reader keyboard exclusions;
- plain-text rendering, NFC/scalar parity, bidi-control rejection, Unicode
  encode-once, no browser persistence, and no mock
  import/fallback;
- no client expiry job, numeric retention claim, or public purge operation.

The real-stack browser suite uses PostgreSQL, the Release API, Next.js, and real
JWT sessions. It must cover Story and Episode discussion, all three Reader formats,
root/Reply creation, edits, deletes, Likes, two-user isolation, creator badge and
non-authority, moderator report/Hide/Restore, hidden-root subtree behavior, logout
and account switch, Unicode content/routes, rate-limit `429`/`Retry-After`,
accessibility focus/announcements, and `mockFallbackDetected: false`.

## Delivery and release gate

1. **Community A:** backend Story/Episode Comments, one-level Replies, author
   mutations, tombstones, pagination, limits, and viewer capabilities.
2. **Community B:** shared typed Story/reader Discussion UI without mocks or
   Comment payload persistence.
3. **Community C:** implemented locally with Comment Likes, reporting, moderator
   Hide/Restore, privacy unlink execution, restricted evidence, and cumulative
   clean-database, security, accessibility, scale, and real-stack validation.
4. **Community D:** independent architecture/conformance review, evidence, and Git
   closure.

No slice claims Community release readiness before reporting, moderation,
privacy cleanup, rate limits, clean-database proof, and real-stack E2E all pass.

Implementation may begin with the policy-neutral schema and immediate privacy
unlink contract; it does not require a numeric retention duration, expiry date,
or purge worker. Beta/Production launch additionally requires formal approval of
the retention duration/clock, legal-hold authority/release, audit expiry, purge
operation and ownership, moderator staffing/SLA, and the applicable distributed
limiter deployment decision.

## Accepted limitations and rollout gates

- No notifications or outbox are persisted in v1.
- No Review/Rating architecture is bundled.
- No multi-level Replies or ranking are supported.
- Drafts are intentionally ephemeral.
- The legacy mock Comment/admin surfaces must be retired during implementation.
- A future production account-deletion orchestrator must invoke the backend's
  internal unlink boundary. Public author identity, authored body/spoiler state,
  outgoing and incoming Likes, and reporter identity are removed or anonymized
  immediately while incoming Replies remain under neutral tombstones and
  restricted evidence remains moderator/safety-only.
- Community v1 performs no automatic time-based safety-record expiry. The prior
  24-month proposal was rejected during independent review as unsupported; no
  duration, expiry date, legal approval, or purge worker is claimed. Formal expiry
  and legal-hold operations remain a Beta/Production launch gate.
- An equivalent distributed limiter is mandatory before multi-instance writes;
  cursors require no shared key ring.

The frontend state and policy-neutral retention contract is closed for
implementation. Production launch remains gated as stated above.
