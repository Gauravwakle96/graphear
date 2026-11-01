# Graphear learning platform

This upgrade adds an AI Learning area alongside the existing local diagram
workspace. The existing React/TypeScript, Express and SQLite application is
retained. There is no production mock provider or hardcoded generated learning
content. OpenAI and Gemini adapters call their actual APIs when configured.

## Backend setup

Use Node 24+, npm, FFmpeg and FFprobe. FFmpeg 9.0.2 was available on the development
machine. The Dockerfile includes FFmpeg, but its container build has not been
verified here.

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
GEMINI_MODEL=gemini-3.8-flash
```

Restart the API after configuration. Model access depends on your provider
account; models are configurable. Never use `VITE_*` for secrets, paste a key into
chat, commit `.env`, or reuse Codex authentication as an application API key.
Generation and transcription are billable according to the provider. Set provider
spending limits as well as the application's call limits.

Open `http://127.0.0.1:5173/#learning`. Without a configured key, source drafts can
be saved but AI processing is unavailable. Legacy local OCR remains usable without
an AI provider.

## Implemented workflows

| Input            | Processing                                                                                     | Source references                          |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| PNG/JPEG/WEBP    | Magic-byte checks, image normalization, vision/OCR and structured analysis                     | Uploaded image                             |
| PDF              | Text extraction plus bounded page rendering; vision OCR for scanned pages                      | Physical page and text continuation        |
| DOCX             | Text and embedded raster images                                                                | Document sections; not physical pages      |
| PPTX             | Slide text and embedded raster images                                                          | Slide number; embedded images are separate |
| MP3/WAV/M4A      | Local mono WAV segments, provider transcription                                                | Coarse recording intervals                 |
| MP4/MOV/WEBM/MKV | Audio processing, representative frames and visual scene-change candidates                     | Frame times and recording intervals        |
| YouTube URL      | Public URL validation, permitted metadata/captions or supplied transcript/authorized recording | Caption intervals when available           |
| Pasted text      | Bounded source sections, structured analysis                                                   | Text sections                              |

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

Live Gemini generation and one complete raster flowchart workflow were verified
with synthetic sources. Other live cases hit provider overload, timeouts and the
free daily quota. Representative handwriting and subject-level accuracy remain
unverified. See [the release report](RELEASE_VERIFICATION.md). Automated HTTP
contract tests use explicitly synthetic responses. Diagrams are drafts; source
citations alone cannot prove correctness.

Office vector drawings, slide animations and physical DOCX page layout are not
reconstructed. Videos use representative/scene-change candidates, which can miss
important content; timestamps are genuine frame times but audio citations are
three-minute intervals. Public YouTube URLs alone do not grant caption download
rights: backend OAuth must have appropriate permission, otherwise supply a
transcript or authorized recording. No restricted downloader is included.

Production internet exposure still needs deployment review, appropriate provider
privacy terms, monitoring, user account/recovery decisions and isolated untrusted
document processing/antivirus where required. Current bounded parsing is not an
operating-system sandbox. A temporary ₹0 HTTPS demo is verified; permanent
hosting, real blind-user validation, learning gains and hackathon outcomes are
not established.

See [live evaluation](LEARNING_EVALUATION.md) and [implementation report](AI_IMPLEMENTATION_REPORT.md).
