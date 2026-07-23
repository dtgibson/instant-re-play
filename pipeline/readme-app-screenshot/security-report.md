# Security Report — README App Screenshot

## Verdict

**PASS — no security or privacy findings.** The change is documentation-only,
uses a static repository-local PNG populated with synthetic sample data, and
does not alter an application, authentication, database, or deployment trust
boundary.

## Scope reviewed

- `pipeline/readme-app-screenshot/change-brief.md`
- `README.md` and its working-tree diff
- `docs/instant-re-play-play-log.png` at full 1920 × 820 resolution
- `pipeline/readme-app-screenshot/pr-description.md`
- `pipeline/readme-app-screenshot/qa-report.md`
- `pipeline/readme-app-screenshot/how-to-run.md`
- complete tracked and untracked working-tree path list

The product-bearing change is limited to `README.md` and
`docs/instant-re-play-play-log.png`. The remaining changed files are Weft
pipeline documentation. No files under application source, API routes, server
actions, middleware, authentication, database/schema/migrations, seed data,
tests, package manifests, public runtime assets, or deployment configuration
changed.

## Findings

No blocking, high, medium, low, or informational security findings were found.

### Screenshot data and privacy

**PASS.** Full-resolution visual inspection confirms that the PNG contains the
shipped Play Log interface populated with representative sample entries. The
visible productions and credited people are the documented synthetic/sample
archive content. The only displayed account identity is `dev@localhost`, the
application's synthetic local-development user; no personal email address,
private archive entry, production account identifier, tenant/project ID, or
other user-specific data is visible.

No password, session value, bearer token, API key, Supabase URL/key, database
URL, allowlist value, cookie, magic link, source map, stack trace, console
output, request details, or environment value appears in the image. The PNG
contains no browser chrome, address bar, developer-tools badge, debug overlay,
toast, modal, drawer, or other transient/debug UI. Its observed PNG chunk data
does not expose textual metadata or embedded credentials.

The capture notes describe an isolated temporary PGlite database with
`DATABASE_URL`, Supabase variables, and `ALLOWED_EMAILS` unset. That setup is
consistent with the visible `dev@localhost` development identity and removes a
path from the capture process to production or personal archive data.

### README embed safety

**PASS.** The README adds a single standard Markdown image:

```markdown
![Instant Re-Play Play Log populated with sample theatre visits](docs/instant-re-play-play-log.png)
```

The target is a fixed relative path to a checked-in PNG. It contains no HTML,
SVG, script, data URI, event handler, iframe, remote URL, redirect, query
parameter, or user-controlled interpolation. Rendering it on GitHub or in a
repository fork does not execute repository code or make a request to a third-
party content host. The descriptive alt text contains no active content.

### Trust boundaries

**PASS / unchanged.** The change adds no input handling, output encoding path,
authorization decision, data flow, network request, privileged operation, or
new dependency. Existing application and auth claims in the README are
unchanged by this diff. No app/auth/data code was modified, so the current
trust boundaries and controls are neither weakened nor expanded.

## Next.js checklist

| Concern | Result | Rationale |
| --- | --- | --- |
| Server/client component boundaries | Not applicable | No Next.js or React source changed. |
| Route handlers and server actions | Not applicable | No route, action, mutation, or request parsing changed. |
| Middleware and authorization | Not applicable | No middleware, session, invite, or authorization code changed. |
| XSS and unsafe HTML rendering | PASS | The README uses ordinary Markdown with a local raster asset; no HTML, SVG, script, or executable URL was introduced. |
| Secrets and environment exposure | PASS | No secret value is present in the diff or visible image. Capture instructions name environment variables only and deliberately unset them; they do not include values. |
| Remote images / image configuration | Not applicable | The asset is repository-local documentation and is not loaded through the Next.js image runtime. No remote image host or configuration changed. |
| Headers, CSP, redirects, caching | Not applicable | No runtime response or Next.js configuration changed. |
| Dependencies and build scripts | Not applicable | No package manifest, lockfile, dependency, or script changed. |
| Development artifacts in production output | PASS | The screenshot has no Next.js development-tools badge, debug overlay, browser chrome, or stack trace. Runtime production output is unchanged. |

## Supabase checklist

| Concern | Result | Rationale |
| --- | --- | --- |
| Authentication and session validation | Not applicable | No Supabase client/server, cookie, callback, or session code changed. |
| Authorization / allowlist enforcement | Not applicable | No allowlist or access-check code changed. |
| Row Level Security and database policy | Not applicable | Supabase provides identity only in this project, and no Supabase schema or policy changed. |
| Public versus privileged keys | PASS | No key is embedded in the README asset or change. The capture ran with Supabase variables absent, and no service-role key is used or documented as a value. |
| Auth tokens, magic links, cookies, user identifiers | PASS | None are visible in the PNG or added text. `dev@localhost` is explicitly synthetic local-development identity, not a production account. |
| Storage buckets and public object access | Not applicable | The PNG is a Git repository asset, not a Supabase Storage object. No bucket or storage policy changed. |
| Production project identifiers / endpoints | PASS | None appear in the image or new README line. |

## Evidence and residual risk

- Image: 1920 × 820, 8-bit RGB, non-interlaced PNG.
- SHA-256:
  `27ff5a5261bf5b2083ed2a61353a3073c69fe0239bc53238b1e24308cc9333c4`.
- README placement and local path resolve as documented in the QA report.
- QA reports 104/104 tests passing and confirms the corrected second capture
  removed the development-tools badge.

Residual risk is negligible and limited to the normal possibility that a
future replacement image could contain private data. Future screenshot updates
should repeat the isolated sample-data capture and full-resolution privacy
inspection used here.

## Disposition

Approved to proceed. No remediation or security follow-up is required.
