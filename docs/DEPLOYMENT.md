# Deploying Graphear for ₹0

The chosen deployment runs the complete production build and backend on the
existing Windows laptop. Private SQLite data and uploads persist on its disk;
Cloudflare Quick Tunnel provides a public HTTPS address without an account or
domain. No paid service is provisioned. The current Gemini project has billing
disabled; requests use available free quota and fail visibly when it is exhausted.

**This is a temporary hackathon demo.** The laptop, network connection and tunnel
must remain online. The public hostname changes when the tunnel restarts, and
Cloudflare explicitly documents Quick Tunnels for testing/development. This does
not establish production uptime or a permanent hosted URL. A stable deployment
needs an appropriate hosting account and persistent storage.

## Start the free demo

1. Install Node 24 and FFmpeg/FFprobe. Install the project's locked dependencies
   with npm ci and prepare the OCR assets with npm run prepare:ocr.
2. Configure the ignored backend .env without replacing existing credentials.
   Select Gemini and a model available with free quota. Never put secrets in
   VITE_* variables, GitHub comments or the repository. Some Gemini models
   support GEMINI_THINKING_BUDGET=0 for lower latency; leave it blank when the
   selected model requires thinking.
3. Install Cloudflare's official cloudflared binary. This workspace uses the
   portable Windows binary in ignored data/tools/cloudflared.exe, verified
   against the release's SHA-256 digest. For another installation set
   CLOUDFLARED_PATH to that binary's absolute path.
4. Run:

```sh
npm run check
npm run serve:free
```

The launcher uses loopback port 3180, opens a free HTTPS tunnel, and starts the
production server with the exact assigned HTTPS origin. It never expands trusted
origins from request Host headers. The database lives in
data/production/graphear.sqlite and originals/derived files in
data/production/learning. Existing development databases remain separate.

The console prints the URL. Ignored data/deployment/current.json records the
current URL, release and owned process IDs. Its existence does not prove the site
is still online: verify /api/health. Keep the process running; Ctrl+C stops its
owned server and tunnel. The launcher does not change startup tasks, power settings
or firewall configuration. Public traffic travels through the outbound tunnel;
the backend listens only on loopback.

Private guest access is tied to a 30-day cookie on the current hostname. Export
important study material before restarting the tunnel: a new hostname cannot read
the old cookie even though the underlying database still exists. A permanent
account/recovery workflow has not been implemented. Do not delete the database to
work around lost cookies.

## Verification and limits

GitHub Actions installs media tools, runs lint, unit/API/extraction tests,
typecheck/build, the dependency audit, Chromium tests and production smoke.
A dependent job builds the Linux Docker image and verifies non-root execution,
media tools, owner/origin boundaries and data persistence after container
replacement. Automated tests use separate fixtures and empty AI credentials.
Live provider evaluations are separate and use actual API requests.

On the actual public URL verify HTTPS, secure cookies, private uploads and
cross-owner denial; then create an authorized learning session and inspect its
real notes, diagrams, tutor answers, revision and exports. Compare labels,
relationships, citations, formulas and values with the original. Schema
validation is not proof of educational accuracy. Verify cancellation, deletion,
upload limits and provider failure messages.

Quick Tunnels support at most 200 in-flight requests and no SSE. Graphear uses
bounded polling, not SSE. Default API limiting conservatively shares the socket
IP quota behind the tunnel. PROXY_TRUST_HOPS remains 0; enable 1 only after
verifying exactly one trusted proxy supplies the rightmost client IP and that
there is no alternate public path to the origin. Avoid blanket proxy trust.

Graphear has one durable processing worker, bounded file/media sizes, explicit
call budgets and timeouts. Failed/cancelled provider requests count against the
application budget. Free model availability is not guaranteed; the application
does not silently fall back to paid APIs or fabricate results. Guest ownership,
source review and provider consent remain required.

Set `AI_FREE_TIER=1` only when the selected provider account has been verified
to use free allowance. This changes pricing copy, not billing settings. Known
provider cooldowns are stored in SQLite and enforced before new AI calls. The
workspace shows an approximate reset, disables generation/tutor actions and
continues to accept source drafts and private downloads. Check availability
refreshes configuration without consuming a generation request.

The current quota update runs backend and tunnel as independent hidden processes
with file-directed logs. Its URL and owned PIDs are in the ignored deployment
state. The first reload lost the old tunnel; guest cookies from that hostname do
not transfer automatically. Saved database records and files were retained, and
the original learning record was compared against its protected backup.

## Docker on an existing host

Docker Compose also runs the full app and injects only listed runtime secrets
from the ignored .env. It mounts graphear-data at /app/data and binds port 3001 to
loopback. No credentials are baked into the image. Do not print docker compose
config with real secrets present: resolved configuration includes their values.

```sh
docker compose up -d --build
curl -fsS http://127.0.0.1:3001/api/health
```

For an existing HTTPS host configure APP_PUBLIC_URL or ALLOWED_ORIGINS explicitly.
Render's RENDER_EXTERNAL_URL is supported if the owner independently chooses
that host, but no paid Render service or disk is selected or created here.
Static-only hosting cannot provide this Express/SQLite/media-processing backend.
Keep one instance and verify storage is writable by the non-root runtime user.

## Backup and rollback

For a consistent full backup, stop only the Graphear launcher/service, archive
the production data directory or Docker named data volume into a protected
location, then restart it. Include the database, files and guest ownership
records. Protect backups as private student material and keep a copy separate
from the live disk. Do not run docker compose down -v on storage you want to keep.

Restore to separate storage and test before relying on a backup. Never overwrite
the live database during a speculative rollback. Application rollback should
pin a known successful Git commit and retain compatible persistent data;
inspect database schema compatibility before running an older release.

Original/derived assets expire after seven days by default; extracted text, notes
and history remain private until deletion. YouTube needs permitted captions or
a supplied authorized transcript/recording. Real handwriting, subject-level
fidelity, blind-user usability and production capacity require additional
representative evaluation; no hackathon placement or uptime guarantee is made.

Official references:
[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/),
[cloudflared releases](https://github.com/cloudflare/cloudflared/releases),
[Gemini generation API](https://ai.google.dev/api/generate-content).
