This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## NovelVerse platform foundation

The real API-backed creator application is available under `/creator/stories`
and supports NOVEL, COMIC, and VIDEO Stories. NOVEL provides structured content
and image upload, COMIC provides ordered media pages, and VIDEO stores supported
YouTube references. Minimal Preview/readers verify every format; visual polish
is intentionally deferred.

Configure `NEXT_PUBLIC_API_BASE_URL` when the backend is not served from the
same origin. See
[`docs/development/SPRINT_FRONTEND_NOVEL_EDITOR_FOUNDATION.md`](docs/development/SPRINT_FRONTEND_NOVEL_EDITOR_FOUNDATION.md)
for routes, API assumptions, validation, architecture, and limitations.
Media upload integration is documented in
[`docs/development/EPIC_06_MEDIA_INTEGRATION.md`](docs/development/EPIC_06_MEDIA_INTEGRATION.md).

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e:local
```

## Getting Started

Start PostgreSQL, apply backend EF migrations, and start NovelVerseApi at
`http://localhost:5039`. Copy `.env.example` to the ignored `.env.local`, then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
