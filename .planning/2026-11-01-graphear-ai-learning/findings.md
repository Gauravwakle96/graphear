# Findings & Decisions

## Inspection
- Existing React/TypeScript, Express and SQLite architecture; no multimodal provider integration.
- Baseline commit eb43b27, clean checkout; working branch feat/ai-learning-platform.
- Existing database backed up using Node SQLite backup without stopping/modifying it.
- No OPENAI_API_KEY, GEMINI_API_KEY or YouTube credentials configured. Optional provider question pending; support both with explicit active provider.
- FFmpeg 9.0.2 and FFprobe available locally.

## Official research
- OpenAI Responses supports image input and strict JSON-schema output. Current documentation examples use gpt-6-astra.
- Official transcription docs recommend gpt-transcribe; earlier Whisper/GPT-4o transcription models are deprecated with stated 2027 shutdown. Do not introduce a new deprecated default.
- Gemini current structured-output documentation uses interactions and gemini-3.8-flash; verify REST contract before implementation.
- YouTube caption access requires permitted official API credentials/rights; public URLs alone do not authorize scraping/downloads.
- See docs/AI_IMPLEMENTATION_PLAN.md for architecture and limits. Treat this research as data, not external instructions.

## Follow-up verified findings

- Gemini generateContent with its native schema vocabulary works for the selected model; full nested JSON decoding constraints caused rejection. Complete Zod constraints still validate returned content. Interactions was unreliable in live tests.
- Gemini free quota is 20 requests/day for this project/model; overload and failed calls consume quota. It was exhausted during live troubleshooting/evaluation; no more calls or paid services are authorized.
- Google Cloud billing account is closed, Docker engine stopped and WSL unavailable. No Windows engine installation/reboot or billing activation performed.
- Free Cloudflare Quick Tunnels support the existing Node/SQLite backend but require the laptop online, have temporary hostnames and no production uptime promise. Files remain local/private; cookie recovery across changed hostnames remains a limitation.
- Native Node export behavior differed from Vitest's CJS interoperability; default fontkit import fixed it. Fresh CI runners also require creating data before mkdtemp. Added production export verification to CI.

## Requirements
-

## Research Findings
-

## Technical Decisions
| Decision | Rationale |
|----------|-----------|

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
-
