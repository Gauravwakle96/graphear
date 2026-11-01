# Task Plan: Upgrade Graphear into an AI learning platform

## Goal
Extend the existing app with real configurable AI, private multimodal ingestion, source-linked learning workspaces and exports; verify actual behavior and report live-key limitations.

## Next Step
The ₹0 temporary HTTPS demo is deployed and verified. Repeat the pending live tutor/media/subject cases after the Gemini free quota resets; keep production uptime and accuracy limitations explicit.

## Current Phase
Phase 10: verified temporary free demo; remaining live evaluations limited by provider quota

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints
- [x] Document in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define approach
- [x] Create project structure
- **Status:** complete

### Phase 3: Shared contracts and AI providers
- [x] Implement typed learning contracts and actual provider adapters
- [x] Document architecture and validate provider HTTP contracts
- **Status:** complete

### Phase 4: Ingestion, persistence and background processing
- [x] Secure inputs and source references
- [x] Owner-scoped jobs and learning sessions
- **Status:** complete

### Phase 5: Learning workspace and diagram formats
- [x] Complete upload/notes/tutor/practice/editor flows
- [x] Preserve existing interface and accessibility
- **Status:** complete

### Phase 6: Exports and security
- [x] PDF/DOCX/Markdown/SVG/PNG/packages
- [x] Review trust boundaries and dependency findings
- **Status:** complete

### Phase 7: Testing and production verification
- [x] Test critical workflows and regressions: 68 unit/API tests and 20 browser tests passed
- [x] Check live-evaluation availability: no credentials configured; no live run claimed
- [x] Record limitations and credential/evaluation instructions
- **Status:** complete

### Phase 8: Delivery
- [x] Review outputs and complete the scoped visual/documenter handoffs
- [x] Deliver code and implementation report on GitHub; remote implementation commit verified
- **Status:** complete

### Phase 9: Live verification and release operations
- [x] Inspect available AI credentials and hosting access without exposing secrets
- [x] Finish secure deployment configuration, container verification and meaningful bounded live tests
- [x] Document remaining quota, accuracy and permanent-hosting limits in RELEASE_VERIFICATION.md
- **Status:** complete

### Phase 10: Public deployment
- [x] Deploy the full-stack release on the existing laptop with persistent storage and backend credentials; use a free temporary HTTPS tunnel under the user's ₹0 requirement
- [x] Verify actual HTTPS, private sessions/files and hosted draft workflows; hosted AI calls not run because free quota is exhausted
- [x] Record the working URL and deployment report; permanent uptime remains outside this temporary demo
- **Status:** complete

## Decisions Made

### Phase 11: Free quota recovery and provider-switch request
- [x] Persist known upstream cooldowns and prevent repeated processing/tutor calls
- [x] Show approximate reset, free-allowance copy and availability refresh; preserve drafts/downloads
- [x] Verify 74 unit/API tests, 21 browser tests, lint/typecheck/build, production smoke/exports, formatting and dependency audit
- [x] Restore public tunnel after launcher detachment; compare the original private record with its backup
- [ ] Connect the requested replacement provider: two authentication checks returned 401; latest third-party key needs its issuing documentation URL
- **Status:** quota handling complete; provider change awaiting valid service/credentials

| Decision | Rationale |
|----------|-----------|
| Add separate Learning feature | Preserve legacy graph model and local workflows |
| OpenAI and Gemini adapters | Actual APIs with explicit backend configuration; no production mocks |
| Existing guest ownership/session model | Maintain authentication compatibility |
| Source-linked typed representations | Preserve diagram category and uncertainty |

## Errors Encountered
| Error | Resolution |
|-------|------------|
