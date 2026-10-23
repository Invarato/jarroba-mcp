# Changelog

All four packages (`@jarroba/mcp`, `@jarroba/mcp-logs`, `@jarroba/mcp-tests`, `@jarroba/mcp-calc`) share one
version number. Each release is built and published from this repository's CI, with npm provenance.

## 0.2.0 — 2026-10-23

- Built on the MCP TypeScript SDK **v2** (`@modelcontextprotocol/server`, with zod 4) instead of v1
  (`@modelcontextprotocol/sdk`). The servers now speak **both** protocol eras over stdio: the 2025 `initialize`
  handshake that today's clients use (2025-11-25 and earlier, unchanged), and the stateless **2026-07-28** revision
  (`server/discover`). The test suite runs a client of each era against the same server.
- Tools, names, descriptions and annotations are unchanged. Input schemas change shape as the SDK v2 generates
  them: no `additionalProperties: false` (unknown arguments are still dropped, as before), no
  `execution.taskSupport`, and the few `$ref`s are now written in place. Context cost goes down slightly (~1 %).
- Lighter install: `@jarroba/mcp` goes from 109 runtime packages to 17. The v1 SDK brought an HTTP server stack
  that a stdio server never used.

## 0.1.11 — 2026-10-21

- Tested on Linux, Windows and macOS with Node 22 and 24, plus a conformance check with the official MCP Inspector.
  The packages now declare `engines: node >=22`.
- `test_debt` on Windows: paths are reported with `/`, and test files in every language are recognised (it found
  only 3 of 5 languages there).
- `diagram_render` can write an `.svg` as well as a `.png`.
- GitHub Releases now carry the four packages exactly as npm serves them, with a Sigstore attestation:
  `gh attestation verify jarroba-mcp-0.1.11.tgz -R Invarato/jarroba-mcp`.
- Repository: `CONTRIBUTING.md`, issue templates, OpenSSF Scorecard and the OpenSSF Best Practices badge.

## 0.1.10 — 2026-10-18

- New tools: `sns_filter` (does an AWS SNS filter policy let a message through), `log_distinguish`, `csv_diff`.
- `rabbit_route` takes the RabbitMQ line (`version`: 4.0 or 4.3), now calibrated against real brokers.
- `access_check` evaluates AWS `Condition` blocks with `requestContext`; its trace is fully in English.
- `k8s_manifest_check` adds reliability checks in the style of kube-score; `headers_audit` adds an A+…F grade;
  `practice_check` adds `alsoConsider` when it does find matches.
- `mcp_catalog_audit` and the five `api_*` tools now answer in English (some answers were in Spanish).
- `spreadsheet_audit` is annotated as what it is: it reads a file by path (`openWorldHint: true`).
- `@modelcontextprotocol/sdk` raised to ^1.32.1. `SECURITY.md` with private vulnerability reporting.

## 0.1.9 — 2026-10-09

- New tools: `rabbit_route`, `kafka_partition`, `kafka_assign`, and solution chemistry: `chem_ph`,
  `chem_titration`, `chem_solubility` (every constant with its citation).
- `cedar_check` validates entities against the schema (`entityErrors`).
- `practice_check` gains `area` (list an area's entries) and returns `nearest` candidates when nothing matches.
- `serverInfo` reports the package version (it was a fixed `0.2.0`).

## 0.1.8 — 2026-10-02

- First release built and published from this public repository (npm trusted publishing, staged with 2FA).
- No internal comments or machine paths in the published bundles (0.1.7 and earlier had them; deprecated).
