# Graphear

**Explore. Repair. Understand.** An accessible flowchart workspace for blind and low-vision students and the teachers who prepare their diagrams.

Graphear joins source review, keyboard exploration, editable graph structure, version comparison and graph-grounded exercises. It is a working hackathon prototype. Its examples are synthetic; accessibility with actual blind users and OCR accuracy have not been established through a user study.

## AI learning upgrade

The **Learning** studio adds private multimodal uploads, real configurable AI providers, source-linked notes, typed diagrams, tutoring, quizzes, timed tests and exports. Choose diagram detail, point-based notes and custom instructions; review AI diagram proposals before explicitly saving them. Study and application-process checklists retain progress on your device. The supplied NoteGPT reference informs its converter and library layout while preserving Graphear's accessible workspace.

A backend API key is required; none ships with the repository. The current free demo uses Gemini. Actual PDF/text generation is verified in bounded cases; representative educational accuracy remains subject to source review.

See [setup and architecture](docs/AI_LEARNING.md), [the new workspace workflow](docs/AI_WORKSPACE_UPGRADE.md), [evaluation](docs/LEARNING_EVALUATION.md) and [implementation report](docs/AI_IMPLEMENTATION_REPORT.md).

## What works

- Import PNG/JPEG, plain SVG and validated Graphear JSON. English OCR runs in the browser with self-hosted Tesseract assets.
- Review extracted text regions, step types and proposed connections against the original source. Explicitly confirm the structure after correcting it.
- Follow decision branches through labelled native controls, retrace a route and use optional system narration.
- Add/remove/rename/move steps, edit connections and undo/redo up to 30 edits.
- Compare versions using stable IDs, including changes in reachable outcomes.
- Repair an authored missing-connection mission and answer exercises calculated from the graph.
- Save in IndexedDB or a private guest workspace backed by SQLite. Publish/revoke immutable read-only snapshots.
- Export editable JSON, visual SVG, structured text and standalone HTML learning packs.
- Use responsive layouts, light/dark themes, reduced motion and a cached offline shell.

Raster OCR identifies text and makes **geometric connection suggestions**. It does not reliably detect arrows or understand arbitrary scientific diagrams. Source review is essential. Browser voice availability and offline voice operation depend on the OS.

## Run locally

Requires **Node.js 24+**, npm and Git. Legacy local mode needs no paid API or API key. AI Learning mode requires a backend provider key; media inputs also require FFmpeg/FFprobe. Initial package/OCR downloads require internet access.

```sh
git clone https://github.com/Gauravwakle96/graphear.git
cd graphear
npm ci
npm run prepare:ocr
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on port 3001, reached through Vite's same-origin proxy. SQLite files are created in the ignored `data/` directory. An optional `.env` can be copied from `.env.example`; no secrets belong in version control.

```sh
npm run check           # lint, unit/API tests with coverage, typecheck, production build
npm run test:e2e        # browser flows, real synthetic raster OCR, responsive axe checks
npm run test:smoke      # built server, cookie/CSP, OCR and offline behavior
npm run benchmark      # synthetic graph algorithm measurements
npm run format:check   # formatting
npm audit              # includes development tooling
npm audit --omit=dev    # runtime dependencies
```

Browser tests use installed Chrome locally. For Linux/CI, install Playwright's browser and use its CI configuration:

```sh
npx playwright install --with-deps chromium
CI=1 npm run test:e2e
```

On Windows PowerShell, set `$env:CI='1'` separately if Chromium should be used instead of installed Chrome.

## Production build and deployment

```sh
npm run prepare:ocr
npm run build
npm start
```

The Express process serves `dist/web` and `/api` on the same origin. Use a persistent SQLite volume and HTTPS reverse proxy for public deployment. Set `NODE_ENV=production`, `HOST=0.0.0.0` inside a container, and `APP_PUBLIC_URL` or `ALLOWED_ORIGINS` to the exact public URL. Render's `RENDER_EXTERNAL_URL` is supported. Production session cookies are Secure. Proxy trust remains disabled by default; `PROXY_TRUST_HOPS=1` requires a verified single reverse proxy with no direct public access to the origin.

`docker compose up --build` supplies a single service, runtime AI secrets from the ignored `.env`, and a persistent volume. The ₹0 HTTPS demo, release and backup instructions are in [deployment](docs/DEPLOYMENT.md). Consult the verification report for actual container and hosted verification results.

No public deployment is provisioned automatically. The production service requires a long-lived Node host with writable storage; static-only hosting can serve the frontend but cannot provide the private workspace API. A backend outage leaves local saves and exports usable.

The service worker caches assets after a successful visit. Offline use requires those assets to have been fetched; OCR assets must also have been cached. It excludes every `/api` response. Updates should change the cache version in `apps/web/public/sw.js` when shell compatibility changes.

## Structure

```text
apps/web/        React UI, client imports, exports and local storage
apps/api/        Express API, authentication and SQLite persistence
packages/core/  Validated graph schema, algorithms, examples and learning
scripts/        Dev/build tooling, OCR assets and benchmark
tests/          Playwright browser and accessibility checks
docs/           Architecture, API, security, demo and verification
```

Private workspace access uses a 30-day guest session cookie, with no email/password recovery. Clearing cookies or expiry removes access to that session's diagrams; keep JSON backups. This is a deliberate prototype scope choice, not a multi-tenant enterprise account system. In legacy local mode, original image pixels are held only in the browser import session. AI Learning mode explicitly uploads private material and sends selected content to the configured provider with consent; server graphs still contain potentially sensitive **text and geometry**. Anyone holding a share link can read its snapshot.

See [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [security](docs/SECURITY.md), [demo script](docs/DEMO.md) and [verification](docs/VERIFICATION.md).

## Dependencies and licensing

React/Vite/TypeScript, Express, Helmet, Zod, Tesseract.js, Lucide, Manrope, Playwright, axe and Vitest provide the implementation. Manrope is self-hosted through Fontsource under the SIL Open Font License; Lucide icons are ISC; Tesseract.js is Apache-2.0. Third-party packages retain their own licenses. See [third-party notes](docs/THIRD_PARTY.md).

The repository owner has not selected a license for Graphear's original code. Publication on GitHub alone does not grant an open-source license.
