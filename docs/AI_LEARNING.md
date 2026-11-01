# Graphear learning platform

This upgrade adds an AI Learning area alongside the existing local diagram
workspace. The existing React/TypeScript, Express and SQLite application is
retained. There is no production mock provider or hardcoded generated learning
content. OpenAI, Gemini and explicitly configured OpenAI-compatible gateway
adapters call their actual APIs when configured.

## Backend setup

Use Node 24+, npm, FFmpeg and FFprobe. FFmpeg 9.0.2 was available on the development
machine. The Dockerfile includes FFmpeg; verification and persistence checks
passed in Linux CI as recorded in [the release report](RELEASE_VERIFICATION.md).

Copy `.env.example` to `.env` **only if `.env` does not already exist**. Set one of:

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=your_backend_key
OPENAI_MODEL=gpt-6-astra
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
```

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your_backend_key
GEMINI_MODEL=gemini-3.1-flash-lite
AI_FREE_TIER=1
GEMINI_REPAIR_INVALID_JSON=1
```

Restart the API after configuration. Model access depends on your provider
account; models are configurable. Never use `VITE_*` for secrets, paste a key into
chat, commit `.env`, or reuse Codex authentication as an application API key.
Generation and transcription are billable according to the provider. Set provider
spending limits as well as the application's call limits.

For a verified free-only account, set `AI_FREE_TIER=1`. This changes pricing copy;
it does not disable billing at the provider. Known 429 cooldowns persist across
backend restarts. The workspace shows an approximate reset, blocks additional
AI requests during that cooldown, and lets students save drafts and download
originals. Availability refresh makes no AI generation request. The current
demo uses Gemini 3.1 Flash Lite with the existing backend key and free allowance;
actual public generation and both saved PDF recoveries succeeded. No paid
fallback is configured. FreeLLMAPI settings are retained privately for rollback.

Gemini native structured output keeps array minima and exact requested question
counts; full Zod validation still runs afterwards. With
`GEMINI_REPAIR_INVALID_JSON=1`, one corrective generation may repair malformed
structure or invalid source relationships, within the same daily/job budgets.
It never retries quota/timeouts or loops after an invalid correction. Leave 0
to disable that extra request. Long documents require broader detailed-note
coverage and receive focused checks of up to three cited diagrams; failed figure
checks omit that diagram with a warning while retaining validated notes/questions.
These checks do not prove factual accuracy.

Public YouTube inputs use sequential bounded Gemini video intervals, public
duration metadata when available, and validated timestamped component/relationship
inventories. Detailed notes must cover substantive source topics. Missing
explanations receive focused correction without regenerating all outputs;
missing diagram components receive an inventory-based reconstruction. A readable
overview and a complete diagram may be shown together. See
[SOURCE_FIDELITY_UPDATE.md](SOURCE_FIDELITY_UPDATE.md) for actual evidence and limits.

### Local FreeLLMAPI gateway

The compatible adapter supports the supplied local gateway and both its
`/v1/responses` and `/v1/chat/completions` endpoints. Configure the following
non-secret settings in the existing backend `.env`; retain other credentials:

```dotenv
AI_PROVIDER=compatible
AI_FREE_TIER=1
COMPATIBLE_NAME=FreeLLMAPI
COMPATIBLE_BASE_URL=http://127.0.0.1:31415/v1
COMPATIBLE_API=responses
COMPATIBLE_MODEL=gpt-oss-120b
COMPATIBLE_VISION_MODEL=qwen3-vl-plus
COMPATIBLE_STRUCTURED_OUTPUT=json_object
COMPATIBLE_REPAIR_INVALID_JSON=1
COMPATIBLE_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
COMPATIBLE_MAX_OUTPUT_TOKENS=4096
```

Set `COMPATIBLE_API_KEY` privately on the backend. Text, vision and transcription
models must be available through that gateway; model discovery alone does not
prove a working generation. The gateway uses configured upstream services, so
this is not offline AI or the official OpenAI API. The consent form names the
gateway and its configured providers. Free routes still have quotas and can fail.
No automatic paid-provider fallback is added by Graphear.

Prefer `json_schema` with models/upstreams supporting strict structured output.
For a gateway that only supports JSON mode, explicitly select
`COMPATIBLE_STRUCTURED_OUTPUT=json_object`; the complete schema is then included
in the prompt. Both modes validate the same structure and source relationships.
An optional single corrective generation consumes the existing daily and job
budgets. Invalid corrections are rejected, and quota/timeouts are not retried.

The local URL is reachable only from a backend on the same computer. It cannot
be reached from an unrelated cloud host, and container loopback is a different
network namespace. Remote gateway URLs require HTTPS. Keep gateway credentials
out of browser configuration, and leave the gateway application running while
using the public laptop-hosted demo.

Open `http://127.0.0.1:5173/#learning`. Without a configured key, source drafts can
be saved but AI processing is unavailable. Legacy local OCR remains usable without
an AI provider.

## Implemented workflows

| Input            | Processing                                                                                                    | Source references                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| PNG/JPEG/WEBP    | Magic-byte checks, image normalization, vision/OCR and structured analysis                                    | Uploaded image                             |
| PDF              | Text extraction plus bounded page rendering; vision OCR for scanned pages                                     | Physical page and text continuation        |
| DOCX             | Text and embedded raster images                                                                               | Document sections; not physical pages      |
| PPTX             | Slide text and embedded raster images                                                                         | Slide number; embedded images are separate |
| MP3/WAV/M4A      | Local mono WAV segments, provider transcription                                                               | Coarse recording intervals                 |
| MP4/MOV/WEBM/MKV | Audio processing, representative frames and visual scene-change candidates                                    | Frame times and recording intervals        |
| YouTube URL      | Public URL validation, Gemini interval analysis, permitted metadata/captions or supplied transcript/recording | Validated topic/caption intervals          |
| Pasted text      | Bounded source sections, structured analysis                                                                  | Text sections                              |

TXT/Markdown notes and VTT/SRT subtitles are also supported, limited to 1 MB,
valid UTF-8 and 180,000 characters. Caption uploads and timestamped pasted
transcripts retain supplied times. Select learning level, study goal, preferred
notes, quiz difficulty and question count before upload. These preferences guide
the analysis and are saved with the session.

Configured Gemini supports public URL-only video analysis through its official
video-input API, bounded by `LEARNING_YOUTUBE_MINUTES` (30 by default).
Other providers need permitted captions or an authorized transcript/recording.
A saved unprocessed YouTube draft can receive pasted text through its source
form. Adding a transcript makes no AI call. Model-generated video observations
are explicitly distinguished from official captions. See
[the source-fidelity update](SOURCE_FIDELITY_UPDATE.md).

Generated material includes detailed, short and exam notes; marked additional
explanations and uncertainty; topic references; source-grounded tables;
typed diagrams; flashcards; mixed practice questions and explanations.

Each private session has Source, Notes, Diagrams, Tutor, Revision and Export views.
Notes and diagram labels, positions and connections are editable with explicit
saves. Diagram review is a separate user action. Tutor answers use stored sources,
notes and recent chat; optional additional diagrams are saved to the same session.
Tests allow difficulty/count selection. Choice answers are graded automatically;
written answers require self-review. Attempts persist, with scores explicitly
limited to automatically checked choices.

Revision includes untimed quizzes and optional timed tests with start, pause,
resume, reset and explicit submission. Unanswered choices in a timed test count
incorrect. Attempts retain question, answer, explanation and evidence snapshots.
Incorrect choices suggest related source topics to revisit without another AI
request. Written answers remain self-reviewed. The timer is browser-based
practice, resets when leaving the workspace, and is not a proctored exam.

Failed sources with extracted text and figures expose **Retry using extracted
text**. The server checks ownership and the current revision, retains the original
and page references, skips image analysis and adds a figure-coverage warning.
This can reduce visual requests; it does not guarantee that the text provider is
available. A source without extracted text cannot use it. **Retry with image
analysis** restores the full visual path after a text-only attempt.

Exports include PDF, DOCX, Markdown, flashcards PDF, SVG, PNG and a ZIP with notes,
diagram representations, source references, chat and practice history. Original
uploads are downloaded separately. Unsupported PDF glyphs fail explicitly;
DOCX/Markdown preserve such text. The ZIP records a PDF limitation if necessary.

## Architecture and API

`packages/core/src/study.ts` defines strict schemas and reference/connection
validation. `study-render.ts` renders escaped SVG and generates supported Mermaid
syntax from validated data. No raw model HTML, SVG or Mermaid is rendered.

`apps/api/src/ai` owns backend-only configuration and provider adapters.
`learning/files.ts` handles file processing; `youtube.ts` handles permitted captions;
`service.ts` separates OCR, transcription, analysis, tutoring and questions;
`store.ts` stores owner-scoped sessions and call reservations; `routes.ts` and
`exports.ts` provide the API and exports. A new provider implements `AIProvider`;
application workflows do not need to change. There is no silent provider failover.

Private endpoints are under `/api/learning`: configuration; list/create/get;
process/cancel; revision-checked edits; chat/questions/quiz; original/source assets;
PDF/DOCX/flashcards/package export; deletion. Mutations reuse guest authentication,
origin checks and CSRF. Configuration returns availability booleans, never keys.

React Flow provides interactive diagrams. Mermaid provides compatible graph and
sequence notation. Custom SVG represents circuit symbols and other schematics.
UML attributes/methods and full relationships remain in structured data and SVG.
Do not interpret a biological schematic as a validated anatomical illustration.

## Limits, privacy and operations

Defaults: images/documents 20 MB; media 100 MB/30 minutes; 50 PDF pages/slides;
16-million-pixel images; at most 80 source sections/180,000 extracted text
characters; eight representative/scene frames; 50 provider calls globally per day,
25 per guest/day and 12 OCR/transcription/analysis calls per source job. Limits are
configurable through `.env.example`. Calls that fail or are cancelled still count.
Large evaluation sets may need an explicitly increased call budget.

Uploads have two concurrent in-memory slots, one per owner; media work is processed
by one durable worker. Requests and subprocesses have timeouts. Interrupted jobs
fail with explicit retry rather than making automatic duplicate billable requests.
Retry reuses extracted sources when available. Deletion waits for active processing
before removing files. SQL writes are parameterized and owner-scoped. Uploaded
files use generated names outside the webroot. Office containers have decompression
limits and reject XML entities. Media subprocesses do not use a shell or remote
protocols. Model output is untrusted and validated before storage/rendering.

Local mode keeps image pixels in the browser. **AI mode explicitly uploads private
material and sends selected content to the configured provider with consent.**
Original/derived files expire after 168 hours by default; text, notes and history
remain private until deletion. Exports, database backups and provider retention
are separate. SQLite is a single-host design. Guest cookies expire after 30 days
and have no account recovery. No learning-session public sharing endpoint exists.

## Material limitations

Real Gemini 3.1 Flash Lite generation recovered the owner's 16-page and 15-page
PDF sessions with six detailed sections, one source-linked draft diagram and
five questions each. Actual public text-to-learning preserved both client/server
directions and passed timed-quiz scoring and browser rendering. These bounded
cases do not establish general PDF/diagram accuracy.

Earlier FreeLLMAPI text-to-learning, raster image-to-learning and uploaded
audio-to-learning jobs succeeded on authorized synthetic sources. Exact image
labels and arrow direction were checked; audio questions were submitted and
scored by the real API. Live video extraction and transcription succeeded, but
generation failed validation or encountered upstream unavailability/quota.
Gemini uploaded audio/video generation has not been live-verified successfully.
Public YouTube URL-only learning is separately live-verified in the latest
[release report](RELEASE_VERIFICATION.md). Representative
handwriting and subject-level accuracy remain unverified. See
[the workflow report](LEARNING_WORKFLOW_UPGRADE.md) and
[the release report](RELEASE_VERIFICATION.md). Automated HTTP
contract tests use explicitly synthetic responses. Diagrams are drafts; source
citations alone cannot prove correctness.

Office vector drawings, slide animations and physical DOCX page layout are not
reconstructed. Videos use representative/scene-change candidates, which can miss
important content; timestamps are genuine frame times but audio citations are
three-minute intervals. Public YouTube URLs alone do not grant caption download
rights: backend OAuth must have appropriate permission. Gemini can instead read
supported public videos through its official video API; other providers need a
transcript or authorized recording. No restricted downloader is included.

Production internet exposure still needs deployment review, appropriate provider
privacy terms, monitoring, user account/recovery decisions and isolated untrusted
document processing/antivirus where required. Current bounded parsing is not an
operating-system sandbox. A temporary ₹0 HTTPS demo is verified; permanent
hosting, real blind-user validation, learning gains and hackathon outcomes are
not established.

See [live evaluation](LEARNING_EVALUATION.md) and [implementation report](AI_IMPLEMENTATION_REPORT.md).
