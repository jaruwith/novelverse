# Frontend–Backend Integration

Verified against the source in `C:\work\NovelVerseApi` on 2026-07-25. The API repository is read-only for this integration.

## Verified route map

| Frontend function | Backend contract |
|---|---|
| `developmentLogin` | `POST /api/v1/dev/auth/social-sign-in` → `{ user, tokens }` |
| automatic refresh | `POST /api/v1/auth/refresh` with `{ refreshToken }` → token pair |
| `getCurrentUser` | `GET /api/v1/users/me` |
| `getCurrentLegalDocuments` | `GET /api/v1/legal-documents/current` |
| `acceptLegalDocuments` | `POST /api/v1/legal-acceptances` with IDs and `DEVELOPMENT` source |
| `updateCurrentUserProfile` | `PUT /api/v1/users/me/profile` with `{ displayName, creatorSlug }` |
| `listStories` | `GET /api/v1/creator/stories?page=&pageSize=` → `PagedResponse<StorySummaryResponse>` |
| `createNovelStory` / `createComicStory` / `createVideoStory` | `POST /api/v1/creator/stories` with explicit StoryType |
| `getStory` | `GET /api/v1/creator/stories/{storyId}` → `StoryResponse` |
| `publishStory` | `POST /api/v1/creator/stories/{storyId}/publish` |
| `listEpisodes` | `GET /api/v1/creator/stories/{storyId}/episodes?page=&pageSize=` |
| `createDraftEpisode` | `POST /api/v1/creator/stories/{storyId}/episodes` |
| `getEpisode` | `GET /api/v1/creator/stories/{storyId}/episodes/{episodeId}` |
| `updateEpisode` | `PUT` to the episode route with all required metadata fields |
| `getEpisodeContent` | `GET .../{episodeId}/content` → `{ episodeId, wordCount, blocks }` |
| `replaceEpisodeContent` | `PUT .../{episodeId}/content` with `{ blocks }` |
| `publishEpisode` | `POST .../{episodeId}/publish` |
| media upload | `POST /api/v1/media-assets` with real multipart data |
| comic pages | `GET` / `PUT .../{episodeId}/comic-pages` |
| video content | `GET` / `PUT .../{episodeId}/video-content` |

Enums use uppercase snake-case JSON (`DRAFT`, `PUBLISHED`, `TEXT`, `IMAGE`,
`DIVIDER`, `PUBLIC`, `UNLISTED`). TEXT allows 20,000 trimmed characters,
rejects empty text and HTML markup, and requires null `mediaAssetId`. IMAGE
references an uploaded ACTIVE owner-owned `NOVEL_CONTENT` MediaAsset. COMIC
pages reference `COMIC_PAGE` assets. VIDEO stores validated YouTube metadata
without uploading video bytes. DIVIDER sends both nullable values as null.

## Authentication and creator prerequisites

The backend uses JWT bearer authentication, not cookies. In Development only, `/login` calls the simulated social sign-in endpoint. The frontend stores the returned access token, refresh token, and both expiry timestamps in local storage. Requests attach only the access token as `Authorization: Bearer`. A 401 causes one refresh attempt; refresh failure clears the session and the creator guard redirects to `/login?next=...`. Tokens are never logged.

This local-storage decision is the smallest integration supported by the current backend. Production OAuth is not implemented by the API. New development users have `PENDING_LEGAL_ACCEPTANCE` status. The development form explicitly asks for acceptance, fetches the current documents, accepts the required Terms of Service and Privacy Notice, and then sets the creator profile. Before creator operations, the backend requires an `ACTIVE` account plus a profile with both display name and creator slug. The creator layout checks `/users/me` and displays the prerequisite rather than using the legacy mock `RoleProvider`.

## API architecture and errors

`src/features/novel-editor/api.ts` is the single typed transport layer. Components do not call `fetch` directly. The client maps RFC Problem Details fields (`title`, `detail`, `status`, `instance`) and backend extensions (`errorCode`, `errors`, `traceId`). Trace identifiers are retained for diagnostics but never displayed. UI behavior distinguishes validation (400), session (401), forbidden account/access (403), ownership-concealed missing resources (404), lifecycle conflict (409), and recoverable server/network failures.

Owned story and episode queries deliberately return 404 for both missing and not-owned records. The UI does not reveal which condition occurred.

## Environment and local run

Copy `.env.example` to `.env.local`. The verified HTTP launch URL is `http://localhost:5039`; HTTPS is `https://localhost:7005`.

1. Start PostgreSQL with the database/account expected by the API configuration.
2. Start `NovelVerseApi` using its Development HTTP profile.
3. In `C:\work\novelverse`, run `npm install` and `npm run dev`.
4. Open `/login`, use the Development login, and complete the creator profile if necessary.
5. Open `/creator/stories`.

## CORS and local browser operation

The API now defines a named, configuration-backed `LocalFrontend` CORS policy. Development permits `http://localhost:3000`, bearer/content request headers, and the API methods used by the editor. It does not enable credentials. CORS runs after HTTPS redirection and before authentication/authorization, allowing OPTIONS preflight to complete.

Fresh creator accounts can create NOVEL, COMIC, or VIDEO Stories and DRAFT
Episodes. The editors and readers are functional foundation UI and intentionally
avoid redesign or polish.

Pagination is typed and the current pages request the first 20 records. Production OAuth and a hardened server-managed token strategy remain unavailable until the backend supplies the production auth flow.

Legacy `/dashboard` pages remain mock wireframes and may continue using `RoleProvider`. They are not imported by or used as data sources for `/creator`.

Run `npm run test:e2e:local` against the healthy local stack to verify NOVEL
text/image persistence, COMIC page authoring, VIDEO metadata, publication,
reload, and public rendering without mock fallback.
