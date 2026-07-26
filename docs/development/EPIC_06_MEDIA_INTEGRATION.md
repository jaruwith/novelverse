# Epic 6 frontend media integration

The existing Novel Editor now uses the real `POST /api/v1/media-assets`
multipart API. Its native picker accepts JPEG, PNG, and WebP. While a request is
active the image button is disabled; a successful response creates an IMAGE
block with `mediaAssetId` and the returned content URL. Failures display a Thai
message and do not alter editor content.

Autosave continues to serialize only `type`, `textContent`, and `mediaAssetId`;
image bytes are never embedded as base64. Reload maps backend `mediaUrl`,
dimensions, and MIME metadata into the editor. The shared renderer displays the
same image in editor and Preview. Removing a block does not delete its reusable
MediaAsset.

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and—with
PostgreSQL, API, and frontend running—`npm run test:e2e:local`. The browser
workflow creates a temporary 2×2 PNG outside the repository and removes it.
