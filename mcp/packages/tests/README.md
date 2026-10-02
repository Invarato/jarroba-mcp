# @jarroba/mcp-tests

**An MCP server that audits tests instead of writing them — and is meant to be pointed at your own
work.**

```bash
claude mcp add jarroba-tests -- npx -y @jarroba/mcp-tests
```

```jsonc
// Claude Desktop, Cursor, Cline, VS Code…
{ "mcpServers": { "jarroba-tests": { "command": "npx", "args": ["-y", "@jarroba/mcp-tests"] } } }
```

4 tools · **~1.8k tokens** of context · stdio, runs on your machine · nothing is uploaded.

## Why this exists

Told to *"make the tests pass"*, an agent has two roads: diagnose the bug, or widen the matcher /
drop the assertion / skip the case. **The second is cheaper**, it produces green, and it looks like
work.

A better model does not fix that, and neither does asking nicely in the prompt — the incentive is
structural. It needs a judge **outside** the model. That is what this is: the only part of the
[Jarroba Tools](https://jarroba.com/tools/) catalogue whose purpose is to disagree with whoever calls
it.

## The tools

| | |
|---|---|
| `test_audit` | Case by case, what a test file **actually** asserts: which assert about a value, which only check that something exists, which assert nothing at all, and which are disabled — **with the evidence** for each verdict, so you can check the checker. TypeScript, JavaScript, Python, Java, Go. |
| `test_diff_audit` | Compares **two versions** of the same file and says whether the change **strengthened or weakened** the safety net: widened matchers (`toBe` → `toContain` → `toBeGreaterThan`), assertions that vanished, cases that stopped running. Run it on your own diff before claiming you are done. |
| `test_cases` | From a **type** to the cases worth writing — equivalence partitions and boundary values from a TypeScript signature or a JSON Schema — saying which technique applies and **why**. Boundary values mean nothing without an ordering, so a boolean and an enum do not get them. Includes a `fast-check` property test, and **the five cases that matter most if you only have time for five** (which never start with the typical value). |
| `test_debt` | Every disabled test **with its age**, from `git blame`. None of these appears in a coverage report, because as far as the runner is concerned they do not exist — it is the debt nobody measures and the one that lasts longest. Sorted oldest first, which is what makes it actionable. |

Executes nothing. No test is run, no code is evaluated: it parses with tree-sitter.

## It does not accuse lightly

A matcher it does not recognize comes back as **"indeterminate"**, never as "asserts nothing". When
in doubt it abstains, because a false accusation is how a tool like this gets switched off. If your
team has a home-made `expect()`, declare it in `dialects` and it stops hedging.

Measured against a labelled corpus in five languages (TypeScript, JavaScript, Python, Java, Go):
**21 accusations, 21 of them true, zero false positives**, and zero cases the parser failed to
delimit. That is the honest size of the measurement — 21 accusations, not a benchmark — and it is
re-run on every change, so it is a floor rather than a claim.

## Privacy

Transport is **stdio**: your MCP host launches this as a subprocess and talks over stdin/stdout.
There is no endpoint, no account and no telemetry. `npx` downloads the package from npm the first
time; after that nothing goes out.

`test_audit` and `test_debt` accept file paths and read whatever the process that launched them can
read, so they are exactly as privileged as your MCP host. `test_debt` also shells out to `git blame`
in the folder you point it at — that is where the age comes from, and it is the one thing a browser
could never do.

## More

Want everything (90 tools: logs by path, databases on a real ephemeral PostgreSQL, JTD diagrams,
SPARQL, `make` simulation)? [`@jarroba/mcp`](https://www.npmjs.com/package/@jarroba/mcp).
Just the logs? [`@jarroba/mcp-logs`](https://www.npmjs.com/package/@jarroba/mcp-logs).

MIT — see [LICENSE](LICENSE). Source: [github.com/Invarato/jarroba-mcp](https://github.com/Invarato/jarroba-mcp/tree/main/mcp).

This package redistributes tree-sitter grammars (MIT, third-party); their notices are in
`dist/tree-sitter/NOTICE.txt`.
