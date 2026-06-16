# Changelog

All notable changes to `quickfile-mcp` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [2.0.0] — 2026-06-16

### Added
- **15-domain coverage** — invoices, estimates, contacts, suppliers, bank, purchases,
  purchase orders, payments, reports, ledger, journals, items, projects, documents, system
- **Fan-out engine** (`src/lib/fanout.ts`) — parallel `Promise.allSettled` across all domains;
  partial failures preserved, never lose good data from a bad domain
- **Smart router** (`src/lib/router.ts`) — keyword-scoring query classifier; overview queries
  auto-trigger all relevant domains in one call
- **Risk guard** (`src/lib/guard.ts`) — 60+ operations classified READ/WRITE/DELETE;
  DELETE hard-blocked unless `confirmed: true`; prevents prompt-injection attacks
- **Secret scrubber** (`src/lib/scrubber.ts`) — 10 regex patterns strip API keys/account
  numbers from all error messages before they reach logs or MCP responses
- **Reasoning envelope** (`src/lib/reasoning.ts`) — every response wrapped in `__provenance`
  + `__security` blocks; LLM anti-hallucination anchors baked in
- **CSPRNG submission numbers** (`src/lib/submission.ts`) — `crypto.randomUUID()` only;
  `Math.random()` explicitly banned
- **In-memory TTL cache** (`src/lib/cache.ts`) — READ-only caching; 60s/300s/600s by domain
- **Rate limiter** (`src/lib/rateLimit.ts`) — 900/day default budget; configurable via
  `RATE_LIMIT_OVERRIDE` env var
- **BusinessProfile** — `QF_VAT_REGISTERED` + `QF_BUSINESS_NAME` env vars auto-populate
  a `businessProfile` on the `Env` object; WRITE tools use it to apply 20% UK VAT
  automatically without the LLM needing to ask per line item
- **Dual runtime** — Cloudflare Workers (HTTP/SSE) + Node.js stdio (Claude Desktop)
- **CI/CD pipeline** — TruffleHog secret scan, CodeQL SAST, npm audit, typecheck;
  deploy gated on CI success via `workflow_run`
- **MIT LICENSE** — open-source ready
- **Prettier + ESLint flat config** — consistent formatting enforced in CI and pre-commit
- **Husky pre-commit hooks** — typecheck + secretlint + lint-staged on every commit
- **`setup.sh`** — interactive guided installer for local stdio use

### Changed
- Upgraded from basic MCP Server (low-level `setRequestHandler`) to `McpServer`
  high-level SDK (v1.12.1)
- `wrangler` bumped to `^3.101.0` — resolves undici HIGH/CRITICAL CVEs
- `moduleResolution` set to `bundler` (correct for Wrangler/esbuild)

---

## [1.0.0] — 2026-06-01

### Added
- Initial MCP server implementation
- 8 domains: invoices, clients, suppliers, bank, purchases, reports, documents, system
- Basic authentication (`buildAuthHeader` with pure-JS MD5)
- Cloudflare Workers deployment via Wrangler
- GitHub Actions CI (typecheck, audit)
