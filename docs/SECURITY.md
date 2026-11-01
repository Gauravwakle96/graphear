# Security and trust boundaries

- Browser uploads are limited to 5 MB (JSON 1 MB), with raster signatures checked and decoded images capped at 16 million pixels. Active SVG elements, event handlers and external references are rejected. No user SVG is inserted into the page DOM.
- Graphs use strict Zod validation, bounded labels/geometry, unique IDs and valid edge references. React escapes labels; HTML/SVG exports escape text. Model output is not implicitly trusted.
- All SQLite values use parameterized queries. Session secrets are cryptographically random, stored as SHA-256 hashes, and placed in HttpOnly/SameSite=Strict cookies (Secure in production). Mutation routes check exact origins and constant-time CSRF comparison.
- Every private project operation is scoped to the authenticated owner. Sharing creates an immutable text/geometry snapshot and replaces prior links. Deleting/revoking invalidates public access.
- Helmet supplies security headers/CSP; scripts, fonts, OCR and workers are self-hosted. Inline graph positioning styles are allowed; external script execution, object embedding and framing are denied.
- Request counters are persistent. Limits are conservative per socket IP; proxy deployment needs care. `ALLOWED_ORIGINS` must contain exact trusted frontend URLs.
- Secrets, databases, imports, test traces and OCR downloads are ignored. No cloud AI key is required. Dependency audits and staged-change review are part of verification.

This prototype has not undergone a third-party penetration test. It is not a clinical, legal or safety-critical interpretation service. Use synthetic material when demonstrating it publicly.

Guest sessions expire after 30 days without recovery. Expired session project data is retained on the operator's disk until administrative deletion; no automatic deletion of saved projects is performed. Operators must establish retention/backups, TLS, disk protections and account recovery for a public service. Old rate-limit buckets are pruned independently of saved projects.

Learning checks establish properties of the graph, not correctness of the original diagram. Confirmed review is a user's assertion, not a guarantee. Independent source imports may use different IDs, affecting version matching.

Implementation guidance includes the official [OWASP CSRF prevention cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). The API uses a server-generated synchronizer token per session, checked alongside Origin and SameSite cookies. These layers do not replace XSS prevention.

## AI Learning extension

The separate consented AI Learning mode, private file processing, provider layer, endpoints, limits and known deployment/accuracy constraints are documented in [AI_LEARNING.md](AI_LEARNING.md). Legacy local imports remain on-device.
