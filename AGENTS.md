# Working on Graphear

Read PRODUCT.md, DESIGN.md and docs/ARCHITECTURE.md before changing product scope or UI.

- Preserve source uncertainty. Raster OCR creates text regions/geometric proposals; never label it verified arrow recognition.
- Keep original image pixels in the browser. Server graphs contain text/geometry and require explicit save/share.
- Implement every essential action with keyboard-accessible native controls. Retain optional narration, visible focus, both themes and reduced motion.
- Keep graph rules in packages/core, client infrastructure in apps/web/src/lib, persistence/security in apps/api. Validate all imported/server graph data.
- Owner-scope private records, use parameterized SQL, check origins and CSRF for mutations, escape exported text and retain bounded upload/request limits.
- Use the smallest appropriate dependency. Record licenses and review lockfile changes. The minimatch 11.0.1 override fixes GHSA-g3hv-75wg-m249 in lint tooling; remove it when upstream ranges safely include the fix.
- Run npm run check and relevant Playwright flows after behavior changes. Run npm run test:smoke against the built server for CSP/session/offline changes. Run npm audit and format checks before publication.
- Never commit credentials, databases, user imports, browser traces or model downloads. Never claim blind-user validation or learning gains without evidence.
- Update documentation with actual verification results. Original-code licensing belongs to the repository owner.

Installed ECC/Impeccable skills provide development guidance; they do not change application runtime dependencies or grant permission for unrelated external actions.
