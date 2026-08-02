# Epic 14B Reader Navigation Frontend Foundation

## Scope

Epic 14B completes the public flow from Discovery and Story Detail into NOVEL, COMIC, and VIDEO readers, authoritative adjacent navigation, and authenticated latest-per-Story Reading History. It consumes `GET /api/v1/stories/{creatorSlug}/{storySlug}/episodes/{episodeSlug}/navigation` without adding href, ordinal, total, identity, or future Series assumptions.

## Typed contract and routing

The navigation client accepts raw application slugs, independently encodes creator, Story, and Episode segments once, forwards `AbortSignal`, and validates identifiers, routing slugs, `StoryType`, current visibility, numbers, and nullable neighbors before use. Next.js route segments continue to decode exactly once through the existing boundary helper. The existing public route resolver remains the only NOVEL/COMIC/VIDEO href authority; Back to Story uses the same independently encoded segment convention. No URL, stored slug, redirect, or API-client encoding rule changed.

## Shared shell and mixed-result state

`ReaderNavigationShell` owns Story/Episode headings, Back to Story, visible previous/next controls, boundary and UNLISTED messaging, retry, keyboard behavior, focus restoration, and an assistive route announcement. Format components retain content rendering, engagement evidence, video provider behavior, progress calculations, and report controls.

Content and navigation are independent cancellable requests. A matching success renders the full shell and permits one progress write. Content failure, navigation 404, an unsupported Story type, or an Episode-ID mismatch produces generic full-reader concealment and no write. A network, 429, timeout, or 5xx navigation failure preserves readable content, exposes retry, hides untrusted Back/neighbor links, and delays progress. Route changes abort both reads, discard late results, and abort an in-flight progress write.

PUBLIC Episodes use server-supplied nullable adjacency. Missing neighbors are valid first, last, or single boundaries. UNLISTED Episodes remain direct-only with no neighbor metadata or fabricated links.

## Keyboard and accessibility

ArrowLeft and ArrowRight supplement the visible controls. Shortcuts are ignored for form fields, links, buttons, contenteditable regions, dialogs, embedded/provider interactions, composition, modifiers, and absent neighbors. Default browser behavior is prevented only for an actual navigation. The Episode heading receives focus after validated route completion and an `aria-live` message announces the Episode.

## Story Detail pagination

Story Detail explicitly requests 20 Episodes, retains server order, reports `shown / total`, and loads bounded subsequent pages. It de-duplicates by Episode ID, maintains distinct initial and incremental retry states, never changes the global Episode-list default, and uses the canonical resolver for every Unicode-safe link. The public backend list remains responsible for excluding UNLISTED and other ineligible Episodes.

## Reading History and Continue Reading

`/history` is now a real authenticated `GET /api/v1/me/reading-progress?page=&pageSize=20` projection named “Reading History.” Supporting text explains that it contains the latest Episode per Story, not every visit. It includes loading, empty, retry, bounded pagination, newest-first server order, and type-correct links. Anonymous access redirects to `/login?next=%2Fhistory`.

Home requests the top three; Library requests a bounded recent three; History provides the paged projection. All use the same server-confirmed `ReadingProgress` type and route resolver. Session events clear private rows before refetching, terminal 401 redirects/clears, and logout or User A-to-B changes cannot retain the prior user’s view. Dashboard data is not copied to localStorage, sessionStorage, IndexedDB, or a service-worker cache; only the existing authentication token mechanism remains.

## Backend Reader State follow-ups

The authenticated reading-progress GET endpoints now return `Cache-Control: private, no-store`. Paged and per-Story lookups share the same published, deletion, moderation, and Story/Episode relationship predicate. Inaccessible targets are omitted or generically concealed; no replacement Episode is guessed. These changes add no endpoint, mutation, migration, or navigation-contract field.

## Validation coverage

Automated tests cover contract parsing for every Story type and visibility, Unicode single encoding, nullable boundaries, mixed content/navigation outcomes, retry, concealment, ID mismatch, cancellation, progress timing, shell controls, keyboard exclusions, focus/announcement behavior, all three reader integrations, bounded Story Detail pagination, real History states, session switching, and shared Continue Reading truth. The real-stack Browser E2E uses PostgreSQL, the Release API, Next.js, and real JWTs to cover more than 20 Episodes, visible and keyboard navigation, first/last boundaries, Unicode deep links, NOVEL/COMIC/VIDEO shell integration, History, Library, Home, logout/isolation, moderation, and absence of mock fallback.

## Limitations

- Navigation deliberately has no ordinal or total, so the UI never displays “Episode X of Y.”
- UNLISTED Episodes expose no adjacent navigation.
- History remains one latest Episode per Story and has no delete-one or clear-all action.
- Comments, Reader Settings, scheduling, and Series/Season/Volume remain outside Epic 14B.
- Video keyboard input is intentionally not captured while provider interaction owns focus.
