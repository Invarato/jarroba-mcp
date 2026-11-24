# Changelog

All four packages (`@jarroba/mcp`, `@jarroba/mcp-logs`, `@jarroba/mcp-tests`, `@jarroba/mcp-calc`) share one
version number. Each release is built and published from this repository's CI, with npm provenance.

## 0.3.2 — 2026-11-24

- Six new tools on engines that already power the web:
  - `checksum` (`core`): the CRCs of the reveng catalogue, Adler-32 and Fletcher-16, custom Rocksoft parameters, and which
    algorithm gives a value you have — also with the bytes swapped, as Modbus sends it.
  - `arithmetic_check` (`ai`): recalculates every operation written with "=" in a text and says which are wrong and what
    they should say, with real-life percentages and decimal comma or point.
  - `document_hygiene` (`security`): what a .docx or .xlsx still contains before it is sent out — tracked changes, comments,
    very hidden sheets, pivot caches, hidden rows with data, metadata. Reads the file by path.
  - `late_payment_interest` and `receivables_aging` (`business`): Spanish statutory late-payment interest (Ley 3/2004)
    stretch by stretch at each half-year's official rate plus collection costs, and aging, DSO and average collection
    period from an invoices CSV.
  - `market_basket` (`ml`): frequent itemsets and association rules with lift, from baskets or order lines.

- New tool `ml_triage` (new domain `ml`): a CSV triaged before training — task (binary classification or regression),
  imbalance, constant and identifier columns, gaps, high-cardinality categories and leaks, and four models scored with
  seeded cross-validation next to the majority-class or mean baseline, saying when none beats it. When two models'
  mean ± std ranges overlap it recommends the simpler one (`tiesWith` names the other). Reads the file by path.

- New tools `os_schedule`, `os_page_replace`, `os_banker`, `automata_from_regex` and `cyk_parse` (new domain `cs`):
  operating-systems and automata coursework solved like the textbook — CPU scheduling Gantt charts and times (7
  algorithms), page replacement with both fault-counting conventions, the banker's algorithm and deadlock detection,
  regex to Thompson NFA, DFA and minimal DFA, and the CYK table — checked against the published solutions, each with a
  link that replays it step by step.

- New tools `business_days` and `legal_deadline` (new domain `dates`): working days between two dates, or N working days
  ahead, with the official holidays of Spain by region (including the ones moved to Monday) and six more countries, naming
  every day skipped; and the last day of a Spanish administrative (Ley 39/2015) or court (LEC/LOPJ, with the 2025 reform of
  non-business days) deadline, with the articles applied.

- `api_collection_convert` and `api_breaking_changes` answer entirely in English: conversion errors and warnings, each
  change's detail and reason, and the Markdown report used to come out partly in Spanish. Breaking-change ids are now a
  closed list, so a new rule cannot ship without its English id.

## 0.3.1 — 2026-11-13

- New tool `forecast` (new domain `forecast`): a time series forecast with intervals, where Holt-Winters, automatic
  ARIMA/SARIMA and the two naive baselines are all backtested with a rolling origin — it says whether any model really
  beats the naive forecast and how much of the promised interval coverage was achieved, plus anomalies and a likely
  level shift. Daily series can take official holidays (Spain by region, other countries) or your own dates.
- New tools `llm_memory` (does a language model fit a GPU: weights by quantization, KV cache, the longest context that
  fits and the decode speed ceiling; mixture-of-experts aware) and `semantic_cache_threshold` (a semantic cache's
  similarity threshold from question pairs measured with your own embedding model, with a link that loads the curve
  into the Architecture Simulator's LLM gateway).
- `archsim_simulate` reports the LLM gateway's wrong answers served from a semantic cache and the traffic sent to the
  fallback model, when there is any.
- New tool `code_smells`: eight code smells in JavaScript or TypeScript (long function, long parameter list,
  conditional on type, message chain, large class, feature envy, duplicated code, global instance), each with its lines,
  Fowler's refactoring, the design pattern that usually resolves it and a `practice_check` entry on when not to refactor.
  Tolerates half-written code and reads by path.
- New tools for business in Spain: `work_calendar` (the yearly work calendar of a workplace with the BOE public
  holidays, squared with the annual hours of the collective agreement), `shift_validate` (a pasted rota checked against
  the Workers' Statute: rest between shifts, weekly rest, daily hours, night work) and `cash_forecast` (13-week cash
  forecast from a Norma 43 or CSV bank statement; reads it from a file so it never enters the conversation).
- New tools `archsim_from_terraform` (Terraform / OpenTofu turned into an architecture with each resource's cloud
  technology and price, simulated) and `archsim_from_pipeline` (a GitHub Actions, Azure Pipelines, GitLab CI or
  declarative Jenkins pipeline simulated as CI/CD: lead time, waiting for a runner, cost, DORA level).
- `work_calendar`: `region` is optional (national holidays only); `shift_validate`: per-person contracted hours and
  minors (`people`), with the rules for minors and the yearly overtime cap.
- The domain `payroll` becomes `business` (it now holds those three and `pension_base`); `payroll` still works as an
  alias in `JARROBA_MCP_DOMAINS`.
- The database engines load 0.02 MB instead of 0.52 MB (they no longer pull in Angular).
- MCP TypeScript SDK 2.4.0 (was 2.3.1). The tools that already existed announce and answer exactly as in 0.3.0.

## 0.3.0 — 2026-10-26

- `prompt_review` understands prompts in English (a prompt that did say what to do when the model does not know was
  flagged as an error), reviews task briefs for agents with `kind: "task"` (deliverable, where to look, how to verify,
  what not to touch), flags an expert persona used to buy accuracy, shouting in capitals and long prompts with no
  structure, and every finding says what to fix and which dated practice backs it (an id for `practice_check`).
  **Breaking:** findings now come as `{code, level, fix, details, practice}` in English instead of internal Spanish ids.
- New MCP prompt `write_prompt`: a fixed method to write a system prompt or a task brief — ask what is missing, draft,
  review with `prompt_review`, check the techniques with `practice_check`, deliver with what changed.
- `diagram_render` also measures the rendered diagram (`measure`, on by default): overlapping nodes and labels cut short,
  with the JTD ids, plus every node box in a JSON next to the image.
- New tool `pension_base` (new domain `payroll`): the regulatory base of a Spanish retirement pension from the monthly
  contribution bases — both systems while they coexist, gaps, CPI update — with the percentage and the monthly pension.
- New tools `maven_plan` and `gradle_plan`: what `mvn <command>` would actually run in a project (module by module, phase
  by phase, goal by goal, and where each goal comes from), for Maven 3 and 4, with a review of the pom; and the task
  order and status from the output of `./gradlew <tasks> --dry-run`.
- Examples: a minimal MCP server with the SDK v2 in TypeScript and Python, and a check that connects with a client of
  each protocol era (`mcp/examples/sdk2-two-eras`), run by CI against both and against this server.

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
