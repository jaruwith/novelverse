# Moderation Frontend Contract

## Epic 11 implementation

Authenticated Story and Episode surfaces submit the typed textual report
contract. Comments remain React text and are never interpreted as HTML. The
minimal `/moderation/reports` route checks the current user's `MODERATOR` role
before loading the server-authorized queue and supports filters, paging, review,
dismiss, hide, and restore actions. Server 401/403/404/409 Problem Details are
mapped to safe Thai-first messages.

Library items use additive `isAvailable` and `unavailableReason` fields. Hidden
items keep their bookmark but render generic Thai unavailable text without a
reader link. Continue Reading receives only actionable progress entries.

## Purpose

Epic 11 adds minimal real reporting and moderator workflows without changing
the application design system. The backend remains authoritative for target
access, roles, workflow transitions, moderation state, and concealment.

## Reporting

Story Detail and each Episode reader/watch route expose a report action.
Anonymous visitors see a sign-in requirement preserving their destination.
Authenticated users get a native dialog/form with target summary, required
reason, optional plain-text comment (1,000 characters), remaining-length
feedback, disabled submission, success, duplicate conflict, network error, and
retry states.

Requests use the typed client:

```text
POST /api/v1/moderation/reports
{ targetType, targetId, reason, comment }
```

No target ID is displayed unnecessarily. Comments are React text and never
HTML. USER targets remain API-ready; the current static/mock profile pages are
not expanded into a new production profile feature in Epic 11.

## Moderator route

`/moderation/reports` loads current-user identity and then the protected API.
It renders no moderator actions for ordinary users. Client gating improves UX,
but a forged route or request still receives backend 403.

The functional route provides queue paging, status and target filters,
newest/oldest sort, selected report detail, start review, dismiss, hide-and-
resolve, and restore. Hide/restore require confirmation. Loading, empty, retry,
validation, conflict, and unavailable-target states use Thai-first messages.
There are no charts, bulk actions, analytics, AI suggestions, or mock fallback.

## Hidden content

Public Story/Episode APIs return ordinary 404 for hidden targets, so existing
public routes render the same generic unavailable/not-found state without
mentioning moderation.

Library consumes additive `isAvailable` and `unavailableReason`. It retains the
saved item, displays `เนื้อหานี้ไม่พร้อมให้บริการ`, and removes actionable
reader navigation. Continue Reading omits a hidden Story/Episode or uses another
backend-selected eligible Episode; it never constructs a broken fallback URL.
Bookmark and progress records remain persisted.

Home/Search refresh from the real API after actions and contain no client cache
or mock fallback. There is no service worker or response cache to invalidate.

## Types and errors

All enums mirror OpenAPI stable values. Problem Details are mapped centrally:
401 sign-in, 403 insufficient role, 404 generic unavailable, 409 duplicate or
workflow/action conflict, and network retry. Trace IDs and internal moderation
details are not displayed.

## Test contract

Component tests cover anonymous/authenticated reporting, validation, success,
duplicate and retry states; moderator authorization, queue filters/paging,
details, transitions, confirmations, conflicts; hidden public routes; Library
availability and Continue Reading safety; no arbitrary HTML and no mocks.

Real Browser E2E creates generated ordinary/moderator users and eligible Story
and Episode fixtures, exercises report-to-hide-to-restore workflows, verifies
404 concealment and reader-state survival, then reruns NOVEL/COMIC/VIDEO and
discovery regressions without retaining screenshots, traces, media, or tokens.
