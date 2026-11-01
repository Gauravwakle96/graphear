# Findings & Decisions

## Requirements
- User authorized the complete Graphear build and push to https://github.com/Gauravwakle96/graphear.
- Accepted concept: import/review, accessible exploration/editing/undo, what-if comparison, repair missions, teach-back, portable exports and speech.
- No claim of proven learning improvement or guaranteed hackathon prize; benchmark data is synthetic.

## Research Findings
- Repository was empty; cloned to C:/Users/gaura/Documents/graphear.
- Node 24.14.1, npm 11.11.0, Git 2.53.0 and Chrome installed. GitHub connector authenticated as Gauravwakle96.
- Official Node SQLite, Express 5 and Tesseract.js docs read. npm versions and engines checked.
- ECC frontend/backend patterns, accessibility/security/verification guidance and Impeccable operate guidance apply.
- Impeccable context ran once. Product screens are code-led; accepted flowchart canvas plus exploration panel remains the core structure.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Local originals, server graph snapshots | Personal image pixels remain on device; only explicit save/share uploads graph text |
| Explicit draft review | OCR text and proposed connections are not treated as verified structure |
| Deterministic graph traversal/diffs | Correct bounded reachability, cycles and version reasoning without LLM guesses |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- https://nodejs.org/api/sqlite.html
- https://expressjs.com/en/guide/migrating-5.html
- https://github.com/naptha/tesseract.js/blob/master/docs/api.md
