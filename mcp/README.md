# Jarroba Tools MCP

Local **MCP servers** (stdio) that give an AI the deterministic tools of
[Jarroba Tools](https://jarroba.com/tools/) so it **computes** answers instead of inventing them.
Everything runs on your machine: the host launches the server as a subprocess and talks over
stdin/stdout. There is no network, no endpoint, no account.

The tools reuse the **same logic as the web app** — the services, without Angular — so there is no
second implementation to drift.

## Four packages, because context is not free

Loading all 134 tools costs **~50,000 tokens of context** before you type anything, in a client that
loads every tool definition up front (Cursor and most others; Claude Code with Tool Search turned off).
That is Claude Code's own count: measured with `/context` on 0.1.7 (120 tools: 41,996 tokens) and
extrapolated with `npm run tokens`. Claude Code's **Tool Search**, on by default, only loads a definition
when it is about to be used: there the whole catalogue costs a few hundred tokens. GitHub's official MCP
server is the usual example of the problem; Cursor caps out around 40 tools. A catalogue of 134 is not "more
complete", it is more expensive — and the model also *chooses* worse, because the usual failure of a
big catalogue is not a missing tool, it is calling the one next to it.

So pick the one you actually want:

| Package | Tools | Context | For |
|---|---|---|---|
| **`@jarroba/mcp-logs`** | 11 | **~4,800 tok** | Reading logs that do not fit in your context |
| **`@jarroba/mcp-tests`** | 4 | **~1,800 tok** | Auditing tests — including your own |
| **`@jarroba/mcp-calc`** | 5 | **~1,700 tok** | Maths with units, equations and sheets |
| `@jarroba/mcp` | 134 | ~50,000 tok | Everything |

All four come from the same source. The filter is the `JARROBA_MCP_DOMAINS` environment variable and
each binary sets its own as a **default**, not a cage: install `mcp-logs` and add
`JARROBA_MCP_DOMAINS=logs,core` if you want the general-purpose tools too. Domains: `core`,
`calc`, `diagram`, `kg`, `db`, `ai`, `logs`, `queue`, `project`, `tests`, `api`, `chip`, `chem`, `access`, `archsim`, `security`, `experiments`.

### A newer complement, not a replacement: Tool Search

Since January 2026 Claude Code defers full tool schemas by default and loads them only when the model
decides to search for them — Anthropic reports large context savings on big catalogues in their own
benchmarks. That does not make the package split above pointless: under deferral, tool *names* and the
server's own `instructions` still load at session start, so a 103-tool server still costs more baseline
than an 11-tool one, and not every MCP client defers automatically (some require the caller to opt a
tool in explicitly; older or other clients load everything upfront regardless). It is also why every
server here now sets a concise `instructions` field — under deferral, that field is the only text that
tells the model *when* to search here at all.

## Install

```jsonc
// Claude Desktop (claude_desktop_config.json), Cursor, Cline, VS Code…
{ "mcpServers": {
    "jarroba-logs":  { "command": "npx", "args": ["-y", "@jarroba/mcp-logs"] },
    "jarroba-tests": { "command": "npx", "args": ["-y", "@jarroba/mcp-tests"] }
} }
```

```bash
# Claude Code
claude mcp add jarroba-logs -- npx -y @jarroba/mcp-logs
```

`npx` downloads the package to **your** machine and runs it there. Nothing is uploaded.

---

## What is actually different here

Most of this catalogue is arithmetic a model gets wrong. Two parts of it are something else.

### Reading a log that does not fit in your context

The log tools accept a **file path**, not just pasted text. That is the whole point: a production or
CI log is tens or hundreds of MB and will never fit in a tool call — but the server runs in Node, so
it can open the file itself and hand back only what fits. An agent debugging a red CI run cannot read
the log; it can ask questions about it.

- **`log_analyze`** — format, number of **events** (a 40-line stack trace counts as one), levels,
  time range, errors with their **root cause resolved**, most frequent patterns.
- **`log_reduce`** — cut to a character budget keeping errors with their full trace, the window
  before, and whatever appears only once. Repeats collapse to `[xN]`.
- **`log_patterns`** — group lines into templates (Drain): "connected to 10.0.0.1" and "connected to
  10.0.0.7" are one message. Also returns the **rare** ones, which is usually what you wanted.
- **`log_trends`** — answers *when did it start*, comparing each pattern against **itself** rather
  than total volume. Returns what spiked, what is **new**, and what **stopped appearing** — the last
  one raises no counter anywhere and is often the worse news.
- **`log_around`** — what else clustered around a moment. What started **before** is a candidate
  explanation; what came after is usually a consequence.
- **`log_stacktrace`** — Java/JVM, Python, Node, Go, .NET, Rust, Ruby, PHP: the `Caused by` chain,
  the root cause, and the first frame of **your** code.
- **`log_lint`** — whether the log is *well written*: secrets printed, one line flooding the file,
  timestamps with no time zone, the clock going backwards, no request id.
- **`log_convert`** — JSON / logfmt / syslog 5424 / CSV / OpenTelemetry / ECS, saying up front what
  the conversion **loses**.
- **`log_rotation`** — put rotated logs in **time order**. Rotation numbering runs backwards against
  time, and alphabetically `app.log.10` sorts before `app.log.9`. Use it first, or you read them
  backwards.
- **`log_profile_check` / `log_profile_suggest`** — a reusable profile describing how your team's
  logs look. `check` returns every error with its exact field so a model can correct itself.

### Tools that contradict the caller

Told to *"make the tests pass"*, an agent has two roads: diagnose the bug, or widen the matcher /
drop the assertion / skip the case. The second is cheaper. A better model does not fix that and
neither does asking nicely in a prompt — it needs a judge **outside** the model. This is the only
part of the catalogue that exists to disagree with whoever calls it. Run it on your own work.

- **`test_audit`** — case by case, what a test file *actually* asserts: which assert about a value,
  which only check that something exists, which assert nothing, which are disabled — **with the
  evidence** for each verdict. TypeScript, JavaScript, Python, Java, Go.
- **`test_diff_audit`** — compare two versions and say whether the change **weakened** the safety
  net: widened matchers, vanished assertions, cases that stopped running.
- **`test_cases`** — from a type to the cases worth writing, saying which technique applies and
  **why** (boundary values mean nothing without an ordering, so a boolean does not get them), plus
  the five that matter most if you only have time for five.
- **`test_debt`** — every disabled test **with its age**, from `git blame`. None of these appears in
  a coverage report, because for the runner they do not exist.

It does not accuse lightly: a matcher it does not recognize comes back as **"indeterminate"**, never
as "asserts nothing". If your team has a home-made `expect()`, declare it in `dialects`.

---

## The rest of the catalogue

Available in `@jarroba/mcp`, or by widening `JARROBA_MCP_DOMAINS`.

**Diagrams (`diagram`, 8)** — [JTD](https://jarroba.com/tools/en/jtd.md)
is a JSON format for an AI to author a diagram. `diagram_svg` renders it in plain Node so the model
can actually **see** the drawing; the incremental builder (`diagram_new` / `_add` / `_preview`) lets
it build in pieces and look in a loop, which is the only way it can judge its own output.
`mermaid_validate` runs **Mermaid's own parser** (the version the web uses) on Mermaid code and returns
the error with its line, column and expected tokens — models write Mermaid that does not render
(unquoted parentheses, `end` as an id, a `%` in a pie) and fix it on their own once they see the
parser's error. It parses only; the parser ships as a separate file loaded on first use, so it costs
nothing until then.

**Databases (`db`, 9)** — SQL text becomes a real schema by executing the DDL in an **ephemeral
PostgreSQL** (pglite), not by guessing with regular expressions: translate a dump from
MySQL/SQLite/SQL Server/Oracle, review the design, generate docs or entity classes. Three of them
look at the **data**, not the structure: which join path actually returns rows, which foreign keys
the data supports (counted, not guessed), and row-level-security checks that catch the **silent**
failures — plus a simulation of what a given role can really see, inside a transaction that is
rolled back. `db_query_check` runs a query against your schema — does it run, which columns and types it returns — and,
given `compareWith`, finds the smallest data where two queries disagree (the NOT IN with a NULL), with its INSERTs.
`db_migration_measure` runs a migration on top of your schema and **measures** the lock each
statement actually takes (pg_locks), whether it rewrites or fully scans the table, and writes the safer
version (CONCURRENTLY, NOT VALID + VALIDATE, lock_timeout…) — instead of guessing lock levels. Pass your application's `queries` and it also says which ones the
migration breaks or changes.

**Knowledge graphs (`kg`, 4)** — SPARQL 1.1, SHACL and a "semantics as code" layer over Oxigraph
(WASM, no server), so a metric like "revenue" is computed from the **agreed** definition rather than
a query someone invented.

**AI about AI (`ai`, 6)** — deterministic and model-free, which is what makes them useful here: an
AI can review **its own** system prompt, prepare a RAG corpus, run **its own answer** through a
claim/source check, verify the eval suite it just wrote, or audit the catalogue of an MCP server it
is deciding whether to install — and, given the tools/list it approved earlier, catch a "rug pull" (tools
that changed after approval) — without spending a model call. And before recommending a practice it learned in
training, `practice_check` tells it whether that practice still holds — superseded by what, since when, how
sure — from a dated register; given its knowledge cutoff, only what changed after it.

**Project workshop (`project`, 8)** — simulate `make` without running it and say **why** each target
rebuilds; compare a real `make` log against that prediction (a target rebuilt when the simulation
said "cached" is the signature of an **undeclared dependency**); `git check-ignore -v` without git,
including where git and Docker **disagree** about the same file; and which Docker layers a change
invalidates. `dora_metrics` computes the four DORA metrics from `gh run list` JSON (and `git log` for lead
time), says why each failed deploy counts as failed, and classifies the team against every State of DevOps
report 2019-2024 — saying "ambiguous" when a report's table does not decide.

**Chemistry and solid state (`chem`, 12)** — the textbook case for this whole server. A model invents
chromium's electron configuration, removes electrons from the wrong orbital when ionizing, and
confuses bond energy (D0) with well depth (De). Here that comes from services with measured oracles
and tests. For solutions: the exact pH of any mix of acids, bases and salts with the textbook formula next to
it and how wrong it is (`chem_ph`), titrations with their equivalence points and the best indicator
(`chem_titration`) and whether a salt precipitates and how much dissolves (`chem_solubility`). Every constant
comes with the paper it was measured in.

**Queueing and message brokers (`queue`, 7)** — Erlang B and M/M/c: how many resources you need, how long people wait,
what fraction is turned away. Plus a simulation to **cross-check** the formula. And the broker arithmetic a model
gets wrong in its head, ported from RabbitMQ 4.0.5 and Kafka 4.3.1 and checked against their own tests: which queues a
RabbitMQ exchange routes to and why (`rabbit_route`), which partition a Kafka key lands in (`kafka_partition`, murmur2
with the working shown) and how a consumer group splits partitions (`kafka_assign`: range, roundrobin, sticky,
cooperative-sticky).

**Identity/RBAC (`access`, 4)** — a vendor-neutral identity/RBAC model that mirrors Azure RBAC, AWS
IAM/Organizations, GCP Resource Manager or Kubernetes RBAC, each rule verified against the official
docs. `access_check` answers "can this principal do this action on this scope, and WHY" with a
three-valued verdict (allowed/denied/indeterminate — the third one when an unmodelled condition
would decide it) and a step-by-step trace of which rule decided; `access_who_can` is its dual across
a list of candidate principals; `access_diff` compares two versions of the same scenario (e.g. an
offboarding, or removing a role assignment) and reports who gains or loses access. The scenario is
passed inline in `world` — there is no server-side session to keep in sync. And `cedar_check` runs
**Cedar** policies (AWS Verified Permissions) on the official Cedar engine: parse and schema errors, and
for each request allow/deny with the policies that decided it — a missing permit told apart from a
forbid that wins.

**Architecture simulation (`archsim`, 2)** — the Architecture Simulator's engine for the archsim format
(`archsim.md`, next to `llms.txt`). `archsim_validate` checks the document; `archsim_simulate` runs it
and returns throughput, p50/p95 **response** latency (it ends at the first queue) and **processing**
latency, availability, bottleneck, cost per hour, per-queue lag / "full in N s" / silently lost
messages, and the same findings as the tool's Report. Queues pull (the consumer takes what it can),
caches cut the path, balancers split and services call all their dependencies, autoscaling takes about
a minute to arrive. An optional timed `phase` with a peak, a DDoS or an LLM outage shows the worst of it.

**A/B experiments (`experiments`, 3)** — where a model picks the wrong test. `abtest_analyze` uses the
right one (z or Fisher's exact), gives intervals, the Bayesian P(variant beats control), A/B/n with
Holm/BH correction, and always checks **sample ratio mismatch**; `abtest_sample_size` plans visitors and
days (R's `power.prop.test`); `abtest_sequential` gives the per-look boundaries if you peek (Pocock,
O'Brien-Fleming, Lan-DeMets spending). Checked against R/`ldbounds` reference values in the tests.

**Security (`security`, 10)** — what an agent should check **before acting**, on the same engines as
the web's security tools. `hidden_text_scan` finds instructions a model literally cannot see
(invisible Unicode tag characters, variation-selector and bit encodings, bidi controls, look-alike
letters) and decodes them; `paste_check` finds the secrets in a log or HAR before it goes into a
ticket, says in which request and header each one sits, and returns a redacted copy;
`actions_audit` catches injectable GitHub Actions workflows, `pull_request_target` checkouts and
unpinned actions; `headers_audit`, `email_auth_audit` (SPF/DKIM/DMARC) and `saml_audit` review what
you paste; `agent_config_audit` reviews an agent's own settings, MCP configs, tasks and instruction
files, putting first what runs without anyone approving it; `oauth_audit` checks an /authorize URL and/or a pasted
openid-configuration against RFC 9700 (PKCE S256, state, nonce, PAR, redirect URIs, implicit and password
grants, id_token "none"…); `k8s_network_reach` tells which pods can reach which according to your
NetworkPolicies (only the pairs that connect, with their ports) and explains why one pair is blocked; `k8s_manifest_check` says whether the cluster will accept
them — the official schema of your Kubernetes version (1.33–1.37: unknown fields with the one you meant, wrong
types, removed APIs) and Pod Security Standards per workload and namespace. And `jwt_decode` (in `core`) now also flags what makes a token dangerous to
accept: alg none, no exp, kid injection, a key carried in the header, and — given your key — algorithm
confusion and short HMAC secrets. Static analysis of what you pass: nothing
is fetched, nothing is run.

**General purpose (`core`, 31)** — CIDR/subnetting, token counting with the real tokenizer (OpenAI's, plus Qwen3 and Mistral run locally, and a measured
estimate for Claude), hashes, JWT
decoding, regex (and a static ReDoS check, `regex_redos_check`), spreadsheet formula audit (`spreadsheet_audit`: recalculates an .xlsx/.ods and flags stale values and cycles), timestamps, cron, colors, WCAG contrast, chmod, JSON diff, units (kB vs KiB),
Hamming, IEEE-754, number bases, a programmer's calculator, semver, format conversion, Unicode, and
`json_schema_validate` (a JSON document against a real JSON Schema, draft 2020-12/2019-09/07, with
every error's JSON Pointer — the check for your own structured output).

> `base_convert` (bases 2–64 with localized names) is **not** here: its service depends on
> `LOCALE_ID`. `number_bases` already covers 2/8/10/16.

---

## Privacy, and an honest threat model

**Transport is stdio and everything is local.** No server, no network, no telemetry.

Two things worth knowing rather than discovering:

- **The path-accepting tools read whatever the calling process can read.** That is the point — it is
  how a 200 MB CI log becomes answerable — and in a local stdio deployment the server runs as you,
  so a path means your own files. But under prompt injection the caller is no longer trustworthy, so
  treat it as what it is: these tools are as privileged as the process you launched.
- **What a tool returns enters the model's context.** A log file with hostile text inside it is an
  indirect prompt-injection channel exactly like a web page is. Nothing here sanitizes that, and
  nothing can.

Every tool declares MCP `annotations` so a host can apply graduated confirmation: almost all are
`readOnlyHint: true, openWorldHint: false`. The exceptions are declared honestly — the path-accepting
tools are `openWorldHint: true` (the result comes from the disk, not from the arguments) and
`diagram_render` is the only one that **writes** a file. Note that annotations are a hint for the UI,
never a security mechanism: the spec itself says a client must not trust annotations from a server it
has not decided to trust.

## Development

```bash
cd mcp
npm install
npm run typecheck     # types for the server and its tests
npm test              # smoke: starts the server and calls the tools (222 checks)
npm run test:paquete  # packs, INSTALLS outside the repo, and checks all three packages (~2 min)
npm run catalogo      # the per-domain tool counts, derived
```

> **`npm test` and `npm run test:paquete` are not interchangeable, and that lesson cost seven tools.**
> `npm test` runs the server with `tsx` from inside the checkout, with `node_modules` next to it — so
> it structurally cannot see what only breaks once installed: an asset the bundle does not copy, an
> inlined dependency looking for its own files on disk, a path resolved against the repo. There were
> **213 checks green while the 7 `db_*` tools were broken in the published package**, and that
> failure also killed the process, which is to say the whole session. `test:paquete` packs, installs
> into a temp directory and talks to the installed binary, with one case **per external dependency** —
> and it ends by asking whether the session is still alive, because a tool that kills the process
> reports **success** (it answered) and leaves the other 84 dead.

Adding a tool: import its service, register it, and add it to its domain in
[`src/catalogo.ts`](src/catalogo.ts) — the server refuses to start if a registered tool has no
declared domain, which is also what keeps the counts in this README honest.

## License

MIT — see [LICENSE](LICENSE).
