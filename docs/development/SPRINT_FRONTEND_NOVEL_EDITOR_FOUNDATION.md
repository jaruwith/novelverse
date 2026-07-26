# Novel Editor Foundation — Contract Corrections

The editor UX foundation remains intact: block editing, shared safe renderer, 1.5-second autosave, serialized writes, explicit draft save, save-before-publish, navigation warning, responsive episode drawer, and recoverable local content.

The earlier API assumptions were replaced after direct inspection of `NovelVerseApi`:

- bearer JWT plus refresh-token rotation replaces mock role authorization for `/creator`;
- creator list endpoints return `PagedResponse<T>`, not arbitrary array/envelope variants;
- episode metadata `PUT` requires `title`, nullable `slug`, `episodeNumber`, `sortOrder`, `visibility`, and nullable `synopsis`;
- content returns `{ episodeId, wordCount, blocks }`, while replacement sends `{ blocks }`;
- response block identifiers/timestamps and frontend `localKey` are never sent;
- enums serialize as uppercase snake-case;
- the exact TEXT limit is 20,000 trimmed characters and HTML is rejected by the backend;
- IMAGE requires `mediaAssetId`, so the Image button remains a non-mutating coming-soon action;
- publish is `POST .../{episodeId}/publish`;
- creator ownership is concealed with the same 404 used for a missing resource.

See [FRONTEND_BACKEND_INTEGRATION.md](./FRONTEND_BACKEND_INTEGRATION.md) for the route map, local setup, Problem Details mapping, CORS blocker, and production-auth boundary.
