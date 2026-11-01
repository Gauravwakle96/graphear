# AI reconstruction and learning studio

This upgrade extends the existing React/TypeScript, Express and SQLite application.
It retains the original accessible diagram workspace, private learning sessions,
provider adapters and saved source material.

## Interface and workflow

The learning studio follows the supplied [NoteGPT note-taker reference](https://notegpt.io/ai-note-taker):
a product sidebar, centered converter, separate file/video/audio/YouTube/text
inputs, paired output settings and a saved-session library. Graphear retains its
forest/sage identity, self-hosted Manrope typography, light/dark themes, keyboard
controls, reduced motion and source-review warnings.

1. Import an image in the original workspace and select **Structure image with
   AI**, or choose **Open AI reconstruction** in source review. The normalized
   raster is handed to the learning form in browser memory. Nothing is uploaded
   by this handoff. Existing local OCR remains a geometric draft.
2. Alternatively upload educational material or paste text in **Learning**.
   Select subject, learner level, note style, quiz difficulty and question count.
3. Choose a diagram format, faithful/simple/expanded detail and point-based or
   connected notes. Add up to 2,000 characters of presentation instructions.
   Format is a preference: source meaning and scientific notation take priority.
4. Select study, scholarship, hackathon or general-process purpose. Process
   guides use supplied requirements and explicitly identify missing details;
   they cannot invent official eligibility, deadlines or awards.
5. Authorize private storage and provider processing, then create the session.
   Review the original, notes, diagrams and citations before relying on output.
6. Use the floating **AI** button for source-grounded questions, a new diagram
   or a proposed edit. Review its components, connections and warnings. **Apply
   to workspace** changes the local working copy; **Save changes** persists it.
   Discarding a preview does not save it.
7. Use the notes outline and reading-size controls, revision exercises, timed
   tests, flashcards and exports. The **Checklist** tab turns a selected note
   section into next steps, storing only item identifiers on this device.

The assistant changes personal learning content and available appearance
controls. It does not execute arbitrary code, modify the deployed application
through a prompt or submit scholarship/hackathon applications.

## Backend contracts and safeguards

Optional preferences extend the shared strict options schema; older sessions
remain readable. Generation instructions incorporate those preferences while
retaining source accuracy, supplied source IDs and uncertainty rules.

`POST /api/learning/:id/diagram-preview` accepts the instruction, optional existing
diagram ID and current session revision. It reads authorized stored source text
and representative images, calls the actual configured provider and validates
the returned typed diagram. Edits preserve the existing diagram ID. New diagrams
receive a server-generated ID. All proposals remain unreviewed drafts.

Owner authorization, origin/CSRF checks, request limits, finite provider call
budgets, cancellation/timeouts, strict JSON validation and revision checks apply.
The endpoint does not write the analysis or increment its revision. Existing
revision-checked session saving persists explicitly accepted changes. Concurrent
AI actions on one session are rejected. API credentials remain backend-only.

The image handoff decodes local base64 bytes without a network request; the
existing Content Security Policy is preserved. Uploaded content is untrusted
source data, never authority to execute tools or change application instructions.

## Cost and limits

The laptop-hosted demonstration uses the configured Gemini free allowance and
free Cloudflare tunnel. Billing activation and paid fallbacks are not introduced.
Its application cap is 50 reserved calls/day, with 25 per guest and 12 per source
job. Failed requests and bounded structural corrections count toward these
limits. Provider quotas can still stop generation earlier. Uploads are limited
to 20 MB and recordings to five minutes in the current demo.

YouTube notes require permitted caption access or supplied authorized transcripts
or recordings. URL-only processing is not universally available. Gemini
audio/video end-to-end behavior, representative handwritten/scientific fidelity,
blind-user usability, permanent hosting and guest-account recovery remain
limitations. The particular OSI image shown in chat is not available as a saved
backend upload; its reconstruction requires the new consented image workflow.

## Verification

Release commands and actual-model evidence are recorded in
[RELEASE_VERIFICATION.md](RELEASE_VERIFICATION.md). Unit/browser fixture responses
are confined to tests; production uses the configured real AI provider.

Automated coverage percentages refer to the existing selected legacy modules,
not complete coverage of every new feature. A successful bounded diagram test
does not establish universal recognition or a hackathon score.
