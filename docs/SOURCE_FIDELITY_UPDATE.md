# Source reconstruction and direct YouTube learning

This increment fixes the reported difference between the uploaded OSI image and
its generated structure. Graphear retains its existing React/TypeScript,
Express/SQLite application, private sessions and source-review workflow.

## Image reconstruction

- Raster import now offers **Reconstruct with AI** before any upload. The next
  form selects the format, detail and instructions and asks for processing consent.
- **Extract text locally** remains on-device. It produces text regions without
  inventing connections from text proximity; it is explicitly not arrow recognition.
- Backend vision inventories the complete image and named structural components.
  Multiple observations for the same source are merged, preventing later legends
  from replacing the earlier device/layer description.
- Detailed notes and faithful/expanded diagrams are checked against that inventory.
  Missing components trigger bounded correction when enabled. Final corrected
  output is checked again before storage. An explicitly named omission remains a
  visible uncertainty, rather than a claim of complete reconstruction.
- Lightweight models use compact focused reconstruction. The backend creates
  nodes from the real source inventory, including relationship endpoints; the
  model supplies explanations and relationships using permitted source labels.
  Invented placeholder nodes and arbitrary connection IDs are rejected.
  Mind maps declare each source label's parent and one central topic root;
  missing parents, repeated labels, forests and cycles are rejected.
  Circuit/UML/ER/sequence/class/scientific corrections retain the richer format.
- A primary-component overview is derived from explained components and their
  existing connections. The complete inventory diagram remains selectable.
  Ordered steps cannot be mislabeled as whole-part containment.
- New mind-map trees receive a hierarchy layout when it fits the existing bounds.
  Overlapping model positions are separated. **Focus selected component** and
  **Fit whole diagram** support reading and navigating large diagrams.

The actual saved `images.png` was read with Gemini. Initial attempts omitted
components and were rejected during evaluation. The final reconstruction contains
all seven named OSI layers, devices, headers and data units: **22 nodes and 21
connected hierarchy relationships**, four point-based detailed note sections and
five questions. A connected mind map is a conceptual view of the source, not a
claim of pixel-identical rendering or detection of every original arrow.

Manual source review flagged the chart's ambiguous IMAP grouping and distinguished
the illustrated TCP sequence-number field from UDP. These review edits are visible
as uncertainty/additional explanation; they are not hardcoded generation responses.
The original image and previous database revisions were preserved in ignored backups.

Inventory matching does not establish factual correctness. Legibility, omitted
minor annotations and scientific meaning still require comparison with the source.

## Public YouTube URLs

Gemini's official video-input API can read supported public YouTube URLs directly.
Graphear sends the canonical URL in sequential bounded intervals, then generates
notes, diagrams and practice from timestamped observations. At most six video
requests cover the permitted prefix, leaving room in the job budget for later
generation and correction. It does not download a
restricted video or bypass platform access controls. Other configured providers
continue to need permitted captions or supplied transcripts/recordings.

The form exposes direct processing only for a configured compatible provider.
`LEARNING_YOUTUBE_MINUTES` defaults to 30, with a permitted 1–60 minute setting.
Longer material is processed only within the selected prefix. Observations are
model interpretations, not official captions; source warnings preserve this distinction.
Public YouTube metadata supplies duration when available. Unavailable content,
empty observations, clip-relative/overlapping intervals and times beyond the
confirmed duration are rejected. Each interval's uncertainty is scoped to that
interval. Observed components, relationships and references are retained.

Detailed-note validation checks inventoried terms and substantive video topics.
Missing explanations use a focused notes request, followed by at most one small
request for remaining points. Existing validated diagrams and practice are
preserved. Diagram correction retains inventoried relationships and source
references; ordered groups retain every adjacent connection. Corrected structures
are revalidated before saving, including after a bounded structural repair.

The public OSI test video is **16:39**, confirmed through public metadata.
Earlier outputs with an invented 27:18 duration or opening-topic-only coverage
were rejected during evaluation. The final actual-model workflow checks all
seven layers in notes and diagrams, topic timestamps, practice and PDF export.
Exact final counts and browser evidence are in [RELEASE_VERIFICATION.md](RELEASE_VERIFICATION.md).
This verifies one public video, not every URL or universal subject accuracy.

## Verification and limits

Actual check results and public quiz/export/browser acceptance are recorded in
[RELEASE_VERIFICATION.md](RELEASE_VERIFICATION.md). Provider protocol, source
merging, diagram hierarchy, permissions, failures, direct URL processing and
interface behavior have automated coverage. Synthetic providers remain confined
to tests; production contains no mock notes or AI responses.

Backend provider/key choices and private data are preserved. No billing activation
or paid fallback was added. The existing free allowance and application/provider
quotas still apply, including evaluation and failed calls. The configuration
default remains 50 calls/day; the current temporary demo has an explicit
100-call application cap, retaining provider free quotas and no billing fallback.
The public Cloudflare
demo requires the laptop and tunnel to remain online; its hostname is temporary.
