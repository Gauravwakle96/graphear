# Deploying Graphear

The app serves the complete frontend and API from one Node process. SQLite,
private originals and derived files need persistent storage. Static website
hosting alone cannot run the learning platform. Deployment has not yet been
provisioned; this file records the concrete deployment configuration.

## Render configuration

[`render.yaml`](../render.yaml) creates one Docker web service on the current
`feat/ai-learning-platform` branch, with a 1 GB disk at `/app/data`, health checks
at `/api/health`, and automatic deployment only after GitHub checks pass.
It selects Gemini explicitly and prompts for `GEMINI_API_KEY` as a backend secret.
No key is included in the repository or Docker image. OpenAI remains supported:
change `AI_PROVIDER`, configure `OPENAI_API_KEY` and a model available to the account.

The proposed Standard service has 2 GB RAM. Render's listed price on 2026-11-01
is $25/month plus $0.25/month for the 1 GB disk, excluding AI usage and any taxes,
extra bandwidth or account charges. This is an estimate, not an authorized purchase.
The $7 Starter service has 512 MB RAM; document rendering, image processing and
FFmpeg have not been capacity-tested within that limit. Free Render services
cannot attach the persistent disk required by this design.

To provision after selecting an account and budget:

1. Connect this GitHub repository in the hosting account and create a Blueprint
   using the published branch. Review the service and disk prices before confirming.
2. Supply the selected AI key in Render's secret environment field. Preserve the
   existing local `.env`; never paste keys into chat or GitHub comments.
3. The server derives its exact allowed origin from Render's
   `RENDER_EXTERNAL_URL`. For a custom domain set `APP_PUBLIC_URL` to its HTTPS
   origin and add any additional trusted origins in `ALLOWED_ORIGINS`.
4. Leave `PROXY_TRUST_HOPS=0` initially. It conservatively shares the socket IP
   quota behind a proxy. Set `1` only after confirming the service receives all
   public traffic through exactly one proxy that supplies the rightmost client IP,
   and that clients cannot reach the origin directly. Never use blanket proxy trust.
5. Verify the checks below on the actual HTTPS URL before declaring deployment done.

The proposal limits uploads to 20 MB, media to five minutes and provider requests
to 50/day globally. These are bounded demo settings, not measured concurrent-user
capacity. Increase disk size and limits only after measuring usage. The optional
Gemini thinking budget is `0` for the selected Flash model's low-latency mode;
leave it blank or select a supported budget for models requiring thinking.

## Docker on an existing host

Configure the ignored backend `.env` using `.env.example`; Docker Compose injects
only listed runtime settings. It mounts `graphear-data` at `/app/data` and binds
port 3001 to loopback. Place an HTTPS reverse proxy on the same host for public
access, configure the exact origin, and use `PROXY_TRUST_HOPS=1` only for that
verified single-proxy topology. Do not print `docker compose config` while keys
are present: resolved configuration contains secret values.

```sh
docker compose up -d --build
curl -fsS http://127.0.0.1:3001/api/health
```

The container runs as the `node` user with dropped capabilities. Confirm the disk
is writable by that user on the chosen host. Keep one instance: SQLite and the
single durable worker are not configured for horizontal scaling.

## Release verification

GitHub Actions installs FFmpeg/FFprobe, runs lint, unit/API/extraction tests,
typecheck/build, the dependency audit, Chromium tests and production smoke. A
dependent job builds the Linux Docker image and verifies non-root execution,
media tools, origin/owner boundaries and persistence after container replacement.
The container test uses unique disposable fixtures and no personal AI keys.

On the public deployment verify:

- HTTPS serves the intended commit and `/api/health` reports healthy storage.
- Session creation sets Secure, HttpOnly and SameSite=Strict cookies. Foreign
  origins and cross-owner access are denied.
- A private draft and uploaded file survive a deployment/restart; the disk is
  writable and originals cannot be fetched without the owner's session.
- A real authorized source produces validated notes and a diagram; tutor,
  revision and exports work using the chosen backend provider. Compare results
  with the original source. Do not treat schema validity as semantic accuracy.
- Large-file rejection, cancellation, provider errors and deletion are visible.
  Confirm provider/account spending caps and monitor disk, memory and job failures.

Browser tests start a dedicated production server on port 5175 with separate
fixture storage and empty AI keys. They never reuse a personal development server.
Production smoke also disables `.env` loading and actual provider credentials.

## Backups, operations and rollback

Preserve the database, original/derived files and any guest session ownership
records. For an existing Docker host, stop only the Graphear service for a
consistent full backup, then archive its named data volume to a protected backup
directory. Restart the service afterward. Protect backups as private student
material and copy them to a separate durable location; a backup on the same disk
does not protect against disk/account loss. Never run `docker compose down -v`
against a deployment you want to preserve.

For Render, inspect the platform's disk snapshot/restore options and also keep
an independent consistent backup. Stop processing before a full snapshot/export.
Practice restoration to separate storage before relying on a backup. Restoring
an older database can discard sessions created after that snapshot.

Pin a known successful commit before each release. Roll back the service to that
commit while retaining the disk; inspect schema compatibility first. Do not
replace a database with an older schema during an application rollback. Persistent
disk deployments may have downtime and are not a zero-downtime guarantee.

Guest cookies have a 30-day expiry and no account recovery. Saved AI text/notes
remain until deletion; original/derived assets expire after seven days by default.
YouTube captions require permitted access or a supplied authorized transcript or
recording. Real user testing, subject-level fidelity evaluation, processing sandbox
isolation and production capacity measurements remain separate validation work.

Official references: [Blueprint specification](https://render.com/docs/blueprint-spec),
[persistent disks](https://render.com/docs/disks), [pricing](https://render.com/pricing),
[Gemini generation API](https://ai.google.dev/api/generate-content).
