# AI learning upgrade: inspection and implementation plan

The existing application is React 19/TypeScript/Vite, Express 5 and Node 24 SQLite. Its shared core validates bounded flowcharts and implements traversal/diffs/practice. Local Tesseract OCR produces draft geometry; it is not multimodal understanding. Guest cookies, CSRF/origin checks, local/private libraries, revocable graph sharing and exports already work. There is no existing remote AI integration to replace. The baseline repository is clean at eb43b27.

## Missing modules

All multimodal learning features are new: document/media ingestion, source-linked notes, multi-notation diagrams, tutor, AI exam practice, learning-session persistence and rich exports. Preserve the legacy workspace, API and data tables.

## Architecture

1. Add shared, strict learning schemas: source references, note sections, typed diagrams, flashcards/questions and tutor answers. Require citations or explicit additional-explanation/uncertainty labels. Validate IDs, connections, geometry and evidence references; do not accept raw AI SVG/Mermaid/HTML.
2. Add a backend provider interface for structured generation, vision and transcription. Implement actual OpenAI and Gemini adapters, configured only through server environment variables. Do not switch providers silently, synthesize production notes, or use Codex credentials. Missing credentials produce a clear unavailable state.
3. Add owner-scoped learning-session/job/upload tables beside the current tables. Durable bounded jobs survive restart, use explicit progress/cancellation/timeouts and a global call budget. SQLite remains a single-host deployment choice.
4. Validate magic bytes, size, image dimensions, document containers and media duration. Extract PDF/Office text with page/slide references, use bounded page OCR, transcribe short audio chunks and analyze sampled frames. FFmpeg/FFprobe are installed locally and will be documented/packaged for deployment.
5. Retrieve YouTube metadata and captions through official permitted APIs. Protected captions need backend OAuth with suitable rights. When captions are unavailable, accept a user-supplied transcript or authorized media upload; never download restricted YouTube audio or bypass controls.
6. Analyze sources once into detailed/short/exam notes, typed diagram representations, revision material and evidence references. Chat uses stored source context. Cache within each owner's session; no private content is shared across users.
7. Add a Learning navigation area preserving Manrope, forest/sage/amber/blue tokens, themes and accessible controls. Provide uploads/previews, progress, notes, diagrams, tutor, revision, editing/save and exports. Use React Flow for node editing, generated Mermaid for compatible notations and safe custom SVG for scientific/circuit presentations.
8. Test source extractors and API security, provider contracts with explicit test-only fixtures, browser flows, exports and regression tests. A separate live evaluation runner must call real configured providers on flowchart/network/circuit/biology/UML/handwritten inputs; technical meaning requires checking source relations, not only schema validity. Missing keys and missing real handwritten samples must remain recorded limitations.

## Consequential changes and limits

The legacy local mode keeps image pixels in the browser. The new AI mode explicitly uploads selected material to private backend storage and selected content to the chosen external provider; this requires a clear user consent control. Uploads have configurable retention and explicit deletion. Existing graph saves and share links are unchanged.

Use configurable size/duration/page/frame/call limits, not an unlimited “any file” claim. Provider reasoning can still be wrong; reconstructed diagrams remain drafts for source review. Authentication stays the existing private guest workspace with its documented expiry/recovery limits. Paid provider usage requires a user-configured key and spending controls.

Inspection found no configured provider keys. Default implementation supports both adapters, with the active provider explicit in environment configuration; live verification remains pending credentials. No public deployment or prize guarantee is inferred.
