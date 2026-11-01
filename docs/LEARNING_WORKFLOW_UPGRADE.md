# Student learning workflow upgrade

Inspection retained the existing React/Express/SQLite application, private
learning sessions, backend AI adapters, media/document extractors, diagram editor,
notes, tutoring, revision and exports. This increment strengthens that workflow.

## Implementation plan

1. Expose learning level, purpose, note format, difficulty and question count at
   upload. Store optional preferences so existing sessions remain readable.
2. Accept bounded UTF-8 TXT/Markdown notes and authorized VTT/SRT transcripts.
   Validate content and retain supplied timestamps. Add transcript attachment
   and guidance to the existing YouTube URL workflow.
3. Keep official YouTube metadata/caption access. Missing caption rights require
   a supplied transcript or authorized recording. Do not introduce a restricted
   downloader or scrape protected player data.
4. Add optional timed tests, pause/resume and explicit submission. Compute scores
   on the backend, permit unanswered timed questions and save question snapshots.
5. Recommend source topics to revisit after incorrect choice answers without
   extra AI calls. Written answers remain explicitly self-reviewed.
6. Preserve owner authorization, CSRF, limits, source validation, themes and
   keyboard interaction. Test boundaries, scoring, browser flows and the build.

## Provider research

The MIT-licensed [API directory](https://github.com/engrshuvodas/open-free-api-directory)
was inspected. It lists general services, including the official YouTube API.
It does not establish unrestricted free multimodal processing or caption rights.
Its patterned OpenAI key strings were not accepted as verified credentials.
No additional paid service or unrelated directory API is installed.

The supplied local FreeLLMAPI gateway is supported separately through its Responses
or Chat Completions API. Text (`gpt-oss-120b`), vision (`qwen3-vl-plus`) and
transcription (`whisper-large-v3-turbo`) are explicitly configured on the backend.
The deployed JSON-object mode includes the complete schema in the prompt, with
strict Zod and source/relationship validation afterwards. A single optional
corrective generation consumes the same daily and ingestion-job budgets. Invalid
corrections, timeouts and quota failures remain visible. Model discovery and a
valid key do not prove every generation will succeed.

## PDF failure recovery

The owner's saved `Unit 1.pdf` contains 16 extracted pages and about 30,000 text
characters. Its generation failed with gateway upstream unavailability; the
original and page extraction were preserved. A separate full native-text test
through another gateway model also failed upstream. No successful full PDF
recovery or model switch is claimed.

Failed sources with extracted text now offer an explicit **Retry using extracted
text** action. It is owner-scoped and revision-checked, reuses extracted content,
skips image calls and records a warning: original visual figures were not analyzed
in that attempt. Generated diagrams explain the available text; they are not
claimed as verified reconstructions of uninspected figures. A source without
extracted text cannot use this action. The ordinary retry can restore image
analysis. Provider and application quotas still apply.

## Verification

- `npm run check`: 90 unit/API tests across nine suites, lint, typecheck and the
  production build passed. Existing coverage scope covers selected legacy
  modules; its percentage is not the new platform's coverage.
- The student upgrade initially passed all 23 browser tests. The added explicit
  text-only recovery has a separate browser regression; final results are in
  [the release report](RELEASE_VERIFICATION.md).
- Production smoke and parseable private PDF/DOCX/flashcard/ZIP export tests
  passed. The dependency audit reported zero vulnerabilities.
- The actual public URL passed secure cookies, origin/CSRF rejection,
  cross-owner denial, private TXT/VTT uploads/downloads, disguised text rejection,
  YouTube draft/attached-transcript revisions and 390/1440-pixel browser checks
  without runtime errors. No AI response was injected into the public site.
- The original saved-session digest matched the protected pre-deployment
  snapshot after these checks. Subsequent user-created sessions were preserved.

## Real AI evidence and practical limits

Actual gateway calls completed text-to-learning, image-to-learning and uploaded
audio-to-learning on authorized synthetic sources. The raster result preserved
both exact labels and its arrow direction. An audio-generated timed quiz was
submitted and scored by the real backend. Live-generated notes exported to
parseable PDF/DOCX/ZIP, and a separate tutor answer was checked.

Uploaded video extraction, transcription and frame observations succeeded.
Video analysis failed structural/source validation, upstream availability or
quota; no invalid result was rendered. A later actual public text-to-learning
attempt also failed upstream. Therefore hosted generation is currently
intermittent, and successful public PDF/video generation is not established.
The key was accepted by the gateway, including successful real generations;
the current upstream failures are separate from authentication.

Public YouTube URLs alone do not grant caption-download rights. Configure
permitted official OAuth access or supply an authorized transcript/recording.
The tested draft used synthetic attached text to verify the workflow; it did not
prove that text matched the linked video's contents. Real handwritten/subject-level
fidelity, blind-user usability and learning gains remain unverified.

No paid infrastructure, billing activation, paid fallback, public-repository
credential or production mock was introduced. The free HTTPS demo depends on
the laptop, FreeLLMAPI, tunnel and internet staying online. Gateway quota and
availability still limit generation.
