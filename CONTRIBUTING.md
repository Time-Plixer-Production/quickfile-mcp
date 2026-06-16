# Contributing to quickfile-mcp

Thank you for your interest in contributing. This guide covers everything you need
to get set up, add new tools, and open a pull request.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Setup](#local-setup)
3. [Running the Server](#running-the-server)
4. [Code Conventions](#code-conventions)
5. [Adding a New Tool](#adding-a-new-tool)
6. [Adding a New Domain](#adding-a-new-domain)
7. [PR Checklist](#pr-checklist)

---

## Prerequisites

- Node.js ≥ 20
- A QuickFile account with API access (Account Settings → Third Party Integrations)
- A Cloudflare account (for Workers deployment only)

---

## Local Setup

```bash
git clone https://github.com/Time-Plixer-Production/quickfile-mcp.git
cd quickfile-mcp
npm install
```

Create a `.dev.vars` file (gitignored) for local Wrangler dev:

```
QF_ACCOUNT_NUMBER=your_account_number
QF_API_KEY=your_api_key
QF_APP_ID=your_app_id
LOG_LEVEL=debug
QF_VAT_REGISTERED=true
QF_BUSINESS_NAME=Your Company Ltd
```

---

## Running the Server

```bash
# Local Cloudflare Workers dev server (hot reload)
npm run dev

# Typecheck only (no emit)
npm run typecheck

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

---

## Code Conventions

- **TypeScript strict** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all on.
  No `any`. No `!` non-null assertions without a comment explaining why.
- **No `Math.random()`** — all randomness goes through `crypto.randomUUID()` (see `submission.ts`).
- **Secrets never in logs** — all error messages pass through `safeError(err, env)` from
  `scrubber.ts` before being thrown or logged.
- **Every tool response uses `toMCPResult()`** — never return raw QuickFile API responses.
- **Risk classification** — every new `domain/method` pair must be added to `OPERATION_RISK_MAP`
  in `guard.ts` with the correct `READ | WRITE | DELETE` classification.
- **Naming** — tool functions are `register{Domain}Tools(server, env)`.
  Tool names follow `domain_method` snake_case (e.g. `invoice_search`, `client_create`).
- **Prettier** — run `npm run format` before committing. CI blocks on format violations.

---

## Adding a New Tool

1. Open the relevant `src/tools/{domain}.ts` file.
2. Add a new `server.tool(name, description, schema, handler)` call inside the `register*Tools` function.
3. Add the operation to `OPERATION_RISK_MAP` in `src/lib/guard.ts`.
4. Call `assertDeleteAllowed(domain, method, confirmed)` in the handler if the operation is DELETE risk.
5. Run `npm run typecheck` — fix all errors before opening a PR.

---

## Adding a New Domain

1. Create `src/tools/{domain}.ts` — export `register{Domain}Tools(server: McpServer, env: Env): void`.
2. Add the domain to the `QFDomain` union type in `src/types/index.ts`.
3. Import and call `register{Domain}Tools` in `src/index.ts`.
4. Add all operations to `OPERATION_RISK_MAP` in `src/lib/guard.ts`.
5. Update the domain count comment in `src/index.ts` and `wrangler.toml`.

---

## PR Checklist

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes (run `npm run format` to auto-fix)
- [ ] `npm run secretlint` passes — no secrets in staged files
- [ ] New operations added to `OPERATION_RISK_MAP` in `guard.ts`
- [ ] New tools return responses through `toMCPResult()`
- [ ] Error paths pass through `safeError()` before throwing
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] Tests added or updated for new functionality
