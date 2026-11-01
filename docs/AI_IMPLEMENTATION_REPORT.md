# AI learning implementation report

The latest fixes and actual owner-image/public-video evidence are in
[SOURCE_FIDELITY_UPDATE.md](SOURCE_FIDELITY_UPDATE.md). Gemini now supports bounded
public YouTube URL-only analysis; older caption-only limitations below describe
the earlier implementation.

The latest diagram reconstruction, NoteGPT-style learning studio, contextual AI
preview and checklist changes are documented in [AI_WORKSPACE_UPGRADE.md](AI_WORKSPACE_UPGRADE.md).
Current tests and actual Gemini evidence are in [RELEASE_VERIFICATION.md](RELEASE_VERIFICATION.md).
The sections below retain earlier implementation evidence and its scope.

Graphear now has a private AI Learning workspace alongside its existing accessible
diagram application. React/TypeScript/Vite, Express and SQLite were retained;
legacy local OCR, graph exploration, repair, sharing and exports were preserved.
The inspected design and architecture are recorded in
[the implementation plan](AI_IMPLEMENTATION_PLAN.md).

**The current free HTTPS demo uses Gemini 3.1 Flash Lite.** Actual Gemini
generation recovered both saved PDF sessions with six detailed note sections,
a source-linked draft diagram and five questions each. A public text lesson
preserved both request/response directions, rendered notes/diagrams and passed
timed-quiz scoring. Earlier FreeLLMAPI text, image and audio learning succeeded;
video extraction worked but full generation failed validation or availability.
Gemini uploaded audio/video remains unverified end to end. Public YouTube
URL-only learning now uses Gemini's official video input; permitted captions
or supplied transcripts/recordings remain the alternatives for other providers.
The latest increment adds uploaded text/subtitles, learner preferences, saved
YouTube transcript drafts, timed tests and source-topic revision feedback.
Generation now enforces requested question counts and broader long-document
notes, checks cited figures in focused requests, and supports an explicit single
Gemini correction within call budgets. Invalid figures are omitted with a warning
while validated notes remain available. Billing was not activated and no paid
fallback was introduced.
See [the current workflow report](LEARNING_WORKFLOW_UPGRADE.md).
The historical initial implementation checks below are supplemented by
[the release report](RELEASE_VERIFICATION.md), including actual live results,
free-quota failures and the temporary hosting limits. Production contains no mock
provider or hardcoded generated notes. Automated provider/completed-session tests
use explicitly synthetic responses and must not be presented as live AI results.

## Implemented features

| Area           | Implementation                                                                                                           | Qualification                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Unified inputs | Drag/drop and file picker, previews, size/format checks, upload progress, text and YouTube URL modes                     | Images/documents: 20 MB; media: configurable 100 MB default                                                |
| Images         | PNG/JPEG/WEBP normalization, backend vision/OCR calls, category and component analysis                                   | Model accuracy and handwritten recognition need real evaluation                                            |
| PDF            | Text extraction, real page rendering and scanned-page vision OCR, page references                                        | Bounded to 50 pages; representative figures may be omitted                                                 |
| DOCX/PPTX      | Text, embedded raster images, section/slide references                                                                   | Office vector drawings/animations and DOCX physical pagination not reconstructed                           |
| Audio/video    | Local FFmpeg extraction, segmented transcription, representative frames and genuine scene-change times                   | No full-video API upload; coarse audio intervals and sampled scenes can miss content                       |
| YouTube        | URL validation, public metadata, Gemini interval analysis, permitted captions or supplied transcript/recording fallback  | Caption downloads need appropriate OAuth rights; no restricted downloader                                  |
| Diagrams       | Validated JSON, category-specific data, React Flow editor, ELK layout, Mermaid-compatible notation, escaped SVG          | Circuit/UML/scientific details use custom schematics; no claim of validated anatomy or circuit correctness |
| Notes          | Detailed, short and exam formats; definitions, explanations, components, applications, tables, citations and uncertainty | Additional explanations marked separately; citations do not prove factual accuracy                         |
| Tutor          | Questions about stored source material and notes, cited answers, optional additional diagrams, chat history              | One real gateway client/server answer checked; representative tutoring remains unverified                  |
| Revision       | Flashcards, mixed practice questions, difficulty/count selection, saved attempts and explanations                        | Choice answers auto-graded; written answers use self-review                                                |
| Sessions       | Private saved workspaces, renaming, edits, revision conflicts, retry/cancel, deletion and retention                      | Existing guest authentication retained; no new account/recovery system                                     |
| Exports        | Notes PDF/DOCX/Markdown, flashcards PDF, diagram SVG/PNG, complete study ZIP                                             | PDF has limited font coverage; unsupported glyphs fail explicitly, ZIP records the limitation              |
| UI             | Existing Manrope/forest/sage identity, Source/Notes/Diagrams/Tutor/Revision/Export views, themes and keyboard controls   | No real blind-user or screen-reader usability study                                                        |

Supported structured categories include flowchart, mind map, block, UML, ER,
network, circuit, sequence, class, concept map, timeline, scientific and process.
Not every category is serialized into Mermaid: types that require richer detail
retain their structured representation and use the interactive editor/custom SVG.
Automatic layout reduces overlap; manual source review remains necessary.

## Architecture and security

- Shared schemas and grounding/relationship checks live in `packages/core/src/study.ts`.
- Backend-only provider adapters in `apps/api/src/ai` expose generation and
  transcription contracts. OCR, extraction, analysis, questions and tutoring are
  separate service stages. Provider switching is explicit through `AI_PROVIDER`;
  there is no silent fallback to another provider.
- Private learning routes and SQLite records reuse existing guest authentication,
  CSRF/origin checks and owner authorization. Model data is validated before
  storage and rendering; raw model HTML, SVG or Mermaid is never directly rendered.
- Uploads use generated paths outside the webroot, signature/extension/size checks,
  two bounded in-memory slots and one upload per owner. Office decompression and
  XML are bounded; media tools run without a shell or remote protocols.
- A durable single worker processes jobs, with cancellation, timeouts, explicit
  retries, per-job/per-owner/global call budgets and interrupted-job handling.
  Media cancellation waits for process termination before returning. Private
  deletion waits for active work; upload retention is 168 hours by default.
- The original SQLite database was backed up to ignored
  `data/backups/before-ai-learning.sqlite`. No secrets or uploaded materials belong
  in the publication. API configuration exposes availability, never key values.

## Initial implementation verification (historical)

Verification was performed locally on Windows, Node 24 and Chrome.

| Check                        | Actual evidence                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/API/extraction tests    | 68 tests passed across 8 suites; extraction suite includes cancel/timeout behavior                                                                                                                                             |
| Provider HTTP contracts      | OpenAI vision/strict JSON and multipart transcription; Gemini inline images/JSON; refusal, malformed output, quota and incomplete-output handling tested with synthetic responses                                              |
| Real extraction/export files | PDF text and rendered pages, Office text, WAV chunks, MP4 frames, a real visual transition at approximately 3 seconds, parseable PDF/DOCX/ZIP/SVG/PNG                                                                          |
| Private API boundaries       | Authentication, foreign origins, consent, cross-owner access, stale revisions, invalid citations, tutor/practice persistence, cancellation/deletion                                                                            |
| Browser tests                | 20 passed: 13 existing flows and 7 Learning tests; completed AI content is explicitly synthetic                                                                                                                                |
| Accessibility/layout         | Automated axe checks on Learning input at desktop 1440, tablet 820, mobile 390 in both themes, and fixture source view; keyboard editing, citations and theme colors checked                                                   |
| Production smoke             | Passed on the built server: CSP/headers, secure guest cookie flags, share creation, offline navigation, private Learning draft creation/deletion without AI requests, real local OCR, no cached API data or runtime exceptions |
| Lint/typecheck/build         | `npm run check` passed: lint, 68 tests with the existing coverage filter, typecheck and production build                                                                                                                       |
| Dependency audit             | `npm audit`: zero reported vulnerabilities; runtime audit and final formatting result recorded in verification                                                                                                                 |
| Coverage scope               | Existing coverage filter covers original core/API modules only. Its 91.59% lines must not be attributed to the new AI platform                                                                                                 |

The UI review scored all four bounded fixes resolved in a **ship** verdict:
unsaved outer navigation, citation focus, initial media seeking and actual
Manrope notation. This verdict is limited to those fixes. Formatting passed.
Final publication/check results are recorded in
[verification](VERIFICATION.md). The build reports large lazy Mermaid/ELK chunks;
the editor loads ELK only when layout is requested. No load/performance benchmark
for the new platform or penetration test is claimed. Container verification,
temporary HTTPS deployment, later checks and provider limitations are recorded
in [the release report](RELEASE_VERIFICATION.md). The quota update passed 74
unit/API tests and 21 browser tests, production smoke/exports, lint, typecheck,
build, formatting and a zero-vulnerability dependency audit.

## Required credentials and next validation

Set `COMPATIBLE_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` in the **backend `.env`**, select
`AI_PROVIDER`, and choose a model available to that account. Defaults and all
limits are documented in [.env.example](../.env.example) and
[setup instructions](AI_LEARNING.md). Preserve an existing `.env`; never use
`VITE_*` for secrets or paste keys into chat. Restart the API after configuration.
Application API credentials are separate from Codex login credentials.

For official YouTube metadata, optionally configure `YOUTUBE_API_KEY`. Caption
downloads additionally require `YOUTUBE_OAUTH_TOKEN` with permission for that
video. Caption download requires those rights; Gemini public-video analysis uses
its official video-input API instead. Other providers need an authorized
transcript or recording; private-video restrictions and platform controls are not
bypassed. Set provider spending limits before running generation or evaluation.

Follow [the live evaluation procedure](LEARNING_EVALUATION.md) using authorized
flowchart, network, circuit, biology, UML and real handwritten diagrams, plus
document/media inputs. Compare labels, connections, formulas, numbers, citations,
notes and uncertainties against each source. The runner's label/edge checks are
only an initial measurement; a subject-competent reviewer must verify meaning.

The remaining production decisions are deployment/privacy review, monitoring,
account recovery, isolated processing of untrusted documents where needed, and
real-user/source-fidelity evaluation. SQLite currently targets a single host;
bounded parsers are not an operating-system sandbox. No guarantee of universal
recognition, educational accuracy, learning gains or hackathon placement is made.
