# Verifying the AI learning engine

Automated tests validate schemas, HTTP contracts, private ownership, extractors,
job behavior, browser controls and export files. Test provider responses and
browser learning content are explicitly synthetic. They do not establish live
model accuracy. The application includes no production mock provider.

Configure backend `.env`, then run:

```powershell
npx tsx scripts/evaluate-learning.ts --manifest C:\path\to\authorized-samples\manifest.json
```

This calls the selected actual provider and can incur charges. Results and source
text are private in ignored `data/live-evaluation/`. Do not commit them. Original
and derived files are removed after each successful case; failed case files stay
in the private evaluation folder for investigation and should be deleted when no
longer needed. Session/database records stay in this private folder.

Example manifest, with paths relative to the manifest:

```json
[
  {
    "name": "Computer network diagram",
    "file": "network.png",
    "expectedKind": "network",
    "expectedNodes": [
      { "name": "client", "aliases": ["Client", "Browser"] },
      { "name": "server", "aliases": ["Server"] }
    ],
    "expectedEdges": [
      { "from": "client", "to": "server", "label": "request" },
      { "from": "server", "to": "client", "label": "response" }
    ],
    "requiredNotePhrases": ["request", "response"]
  }
]
```

Include flowchart, network, circuit, biology (`scientific`), UML and a **real
handwritten** diagram. Extend with PDF, DOCX, PPTX, audio and video cases. For
YouTube, add a `youtube` URL with authorized caption access or supply `text`/a
recording you have permission to use. No restricted media downloader is included.

Expected edges default to `"direction": "forward"`. Use `"direction": "none"`
for undirected physical connections such as circuit wires; endpoint order then
does not matter. A generated bidirectional edge counts as two directed connections.

The runner measures expected labels and directed/undirected relationships and reports
missing/extra edges. Alias matching and keyword checks are a useful first check,
not semantic proof. Have a subject-competent reviewer compare each reconstruction
and note section with its original source, including labels, branch conditions,
circuit ports, class attributes, biological structures, numbers, formulas, page
references, timestamps, uncertainty and marked additional explanations. Record
reviewer corrections; schema validity alone cannot certify meaning.

The latest compatible-provider run completed synthetic text, raster image and
audio learning jobs. Exact image labels and a directed relationship were checked;
an audio-generated timed quiz was submitted to the real backend. A real tutor
answer was also checked. Video extraction/transcription succeeded, while video
generation failed schema/source validation or upstream availability/quota.
YouTube draft/attached-transcript handling passed at the public URL without AI
calls; URL-only caption generation was not live-verified. Synthetic
handwriting-style text is not real handwriting. See
[the workflow report](LEARNING_WORKFLOW_UPGRADE.md) for the current results.
