# Task Plan: Upgrade Graphear into an AI learning platform

## Goal
Extend the existing app with real configurable AI, private multimodal ingestion, source-linked learning workspaces and exports; verify actual behavior and report live-key limitations.

## Next Step
Finish live AI verification and deployment packaging. Deploy to an authorized host with persistent storage and verify the hosted application.

## Current Phase
Phase 9

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
- [ ] Inspect available AI credentials and hosting access without exposing secrets
- [ ] Finish secure deployment configuration, container verification and meaningful live tests
- [ ] Document actual remaining blockers and results
- **Status:** in_progress

### Phase 10: Public deployment
- [ ] Deploy a verified full-stack release with persistent storage and backend credentials
- [ ] Verify HTTPS, private sessions and actual hosted learning workflows
- [ ] Deliver the working URL and deployment report
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add separate Learning feature | Preserve legacy graph model and local workflows |
| OpenAI and Gemini adapters | Actual APIs with explicit backend configuration; no production mocks |
| Existing guest ownership/session model | Maintain authentication compatibility |
| Source-linked typed representations | Preserve diagram category and uncertainty |

## Errors Encountered
| Error | Resolution |
|-------|------------|
