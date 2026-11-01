# Release and ₹0 demo verification

The complete Graphear frontend and Express backend are publicly reachable through
a free Cloudflare Quick Tunnel on the existing Windows laptop. The launch on
2026-11-01 includes the quota-handling update, local persistent SQLite/uploads, backend-only
Gemini credentials and no paid infrastructure. The deployment configuration and
restart/backup procedure are in [DEPLOYMENT.md](DEPLOYMENT.md).

Current URL: https://professionals-compiler-explaining-uri.trycloudflare.com

This is a temporary demo URL. It works while the laptop, network and launcher
remain online and can change after restart. Cloudflare Quick Tunnels are documented
for testing/development, not guaranteed production uptime. Guest cookies belong
to the current hostname; export important work before restarting the tunnel.

## Application and release checks

| Check                     | Observed result                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/API/extraction       | 74 tests passed across 9 suites on Windows                                                                                            |
| Lint/typecheck/build      | Passed on the final runtime code                                                                                                      |
| Browser regression        | 21 tests passed against the production bundle, including free-quota notice, disabled retries and availability refresh                 |
| Dialog race               | Reproduced with Chromium; fixed stale native close events; 8 repetitions passed                                                       |
| Production smoke          | Passed: frontend, CSP, secure cookies, offline navigation, local OCR and private drafts                                               |
| Production export API     | Parseable private PDF, DOCX, flashcard PDF and ZIP through the built Node server; explicit test fixture, no AI calls                  |
| Actual AI content exports | Live-generated flowchart notes exported to a parseable PDF/DOCX, 15-entry ZIP, SVG and a 1140-pixel-wide PNG                          |
| Dependency audit          | Zero reported vulnerabilities                                                                                                         |
| Credential handling       | Ignored backend .env, restricted Windows ACL, no browser API keys or image-layer secrets; staged credential-pattern review passed     |
| Linux CI/container        | [Release 42463dd run](https://github.com/Gauravwakle96/graphear/actions/runs/41303326288) passed both verification and container jobs |

Linux CI now installs FFmpeg/FFprobe. Its Docker job verifies non-root execution,
media tools, frontend/CSP, private access and persistence after replacing the
container. Production export tests were added after finding a Node ESM/CommonJS
fontkit import issue; the import was corrected and the test creates its own data
directory on fresh runners. Current branch check results are available in
[GitHub Actions](https://github.com/Gauravwakle96/graphear/actions).

The original coverage filter covers selected legacy core/API modules; its
percentage must not be attributed to all new AI functionality. Large lazy
Mermaid/ELK build chunks remain. No new-platform load test, penetration test or
real-user learning study was performed.

## Actual public URL checks

The actual HTTPS URL was tested at 2026-11-01 11:56 UTC:

- Frontend and /api/health returned 200; CSP headers were present.
- Sessions set Secure, HttpOnly and SameSite=Strict cookies. Foreign origins
  were rejected and anonymous private access returned 401.
- Private draft creation/read/deletion worked; another owner received 404.
- Genuine PNG upload/download worked; spoofed PNG bytes were rejected.
  Anonymous and cross-owner file access were denied.
- Chrome at 390×844 rendered the Learning workspace and completed private draft
  creation/deletion without runtime errors. No AI request was made by this check.

The hosted process was not restarted during these checks. Container replacement
persistence was verified in Linux CI; permanent hosting and uptime are not claimed.

## Live AI evidence and limits

The existing Gemini key was configured on the backend without printing it or
changing Codex credentials. OpenAI support remains available but was not live
tested because no OpenAI application key was configured. The Gemini adapter now
uses Google's documented generateContent endpoint and native structural output
schema. The complete Zod constraints and source/relationship checks still run on
every generated result before storage/rendering. Unsupported unions fail visibly.

| Live case                                               | Result                                                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured network-text request                         | Actual Gemini response validated; Client → Server request and Server → Client response preserved with source-linked notes                      |
| Raster flowchart learning job                           | Completed OCR/vision, notes, diagram, flashcards and questions; all 3 expected labels and both expected edges matched, with no unexpected edge |
| Full text learning job                                  | Timed out; the successful separate structured request does not establish this full workflow                                                    |
| Network/circuit images                                  | Provider temporarily unavailable                                                                                                               |
| Biology/UML/handwriting-style/PDF/DOCX cases            | Blocked by free quota; no accuracy success claimed                                                                                             |
| Live tutor, extra questions, audio/video and YouTube AI | Not completed; automated contracts/extractors are tested, but live semantic behavior remains unverified                                        |

The printed flowchart and network source were synthetic authorized fixtures.
Handwriting-style font is not a real handwritten sample. The 100% edge match is
for that one three-node fixture and is not a universal accuracy score. Its source
labels/directions and cited note summary were inspected; representative circuit,
biology, UML and real handwritten fidelity still needs subject-level review.

Gemini reported a free limit of **20 requests/day** and a reset about 20 hours
after the last test. Troubleshooting and live checks consumed that quota. Further
AI calls were stopped; billing was not enabled and no paid fallback was added.
The backend now persists known provider cooldowns and rejects processing, tutor
and extra-question requests before another provider call. The UI shows an
approximate reset in the browser's timezone, disables these actions, permits
drafts and downloads, and refreshes availability at reset or on explicit request.
The current reset estimate is 2026-11-02 08:00 UTC / 13:30 IST, based on earlier
provider metadata, not a new AI request. `AI_FREE_TIER=1` selects free-allowance
copy; it does not change the provider account's billing settings.

New generation remains unavailable until quota is available. The free launcher caps
application calls at 20/day by default, but the provider quota also includes other
uses of the same project. A typical image needs both vision/OCR and analysis calls;
tutoring and media transcription also consume quota. Free operation does not imply
unlimited requests or dependable model availability.

Private live reports, exported files, browser captures, SQLite databases and the
portable tunnel binary stay in ignored data directories. No generated study
content was hardcoded into the production application.

## Quota update deployment and provider-switch attempt

Local lint, 74 unit/API tests, typecheck, build, 21 browser tests, formatting,
production smoke and parseable production exports passed. npm audit reported
zero vulnerabilities. All four verification/container jobs for published
`cbebe94` passed on GitHub; newer publication results must be checked separately.

The first backend reload detached the original launcher. Its tunnel exited after
the parent was terminated, and the old hostname returned Cloudflare 1033. Public
access was restored with independently redirected backend/tunnel processes and
the new URL above. The private database and files were retained. A before/after
digest verified the original saved learning session was unchanged, and the
learning-call counter was unchanged. Old guest cookies do not transfer to the new
hostname; automatic guest recovery remains unimplemented.

The new actual HTTPS URL was checked on 2026-11-01 at 12:27 UTC: health, secure
sessions, foreign-origin rejection, cross-owner rejection, validated private PNG
uploads/downloads, mobile draft creation/deletion, visible quota/reset notice,
disabled processing and no billable-retry copy passed without AI calls.

User-supplied replacement credentials were rejected with HTTP 401 by the
documented Vercel AI Gateway and OpenAI authentication endpoints. No generation
request was made with them, and the configured Gemini provider was preserved.
A subsequent third-party credential requires the issuing service's documentation
URL before its endpoint, privacy terms and image capability can be verified.
Never share replacement secrets in chat; configure them in the backend `.env`.

Remaining validation: representative learning inputs, tutor/media/YouTube live
results, real handwriting, blind-user usability, account recovery and sustained
capacity. The demo and implemented modules do not establish production uptime,
universal reconstruction accuracy or a guaranteed hackathon result.
