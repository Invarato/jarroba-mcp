# @jarroba/mcp-logs

**An MCP server that lets your AI read a log it could never fit in its context.**

```bash
claude mcp add jarroba-logs -- npx -y @jarroba/mcp-logs
```

```jsonc
// Claude Desktop, Cursor, Cline, VS Code…
{ "mcpServers": { "jarroba-logs": { "command": "npx", "args": ["-y", "@jarroba/mcp-logs"] } } }
```

11 tools · **~4.8k tokens** of context · stdio, runs on your machine · nothing is uploaded.

## Why this exists

Every log tool for an AI takes *pasted text*. A production or CI log is tens or hundreds of MB, so
pasting is not an option — and the interesting part is never the part you would have pasted.

These tools take a **file path**. The server runs in Node, so it opens the file itself and hands back
only what fits. An agent debugging a red CI run cannot read the log; it can ask questions about it.

## The tools

| | |
|---|---|
| `log_analyze` | Format, number of **events** (a 40-line stack trace is **one**), levels, time range, errors with their **root cause resolved**, most frequent patterns. |
| `log_trends` | **When did it start.** Compares each pattern against **itself**, not against total volume — in a busy service everything rises at 9am and nothing happened. Returns what spiked, what is **new**, and what **stopped appearing**: the last one raises no counter anywhere and is often the worse news. |
| `log_around` | What else clustered around a moment. What started **before** is a candidate explanation; what came after is usually a consequence. Correlation is not causation, and order is what separates them. |
| `log_patterns` | Groups lines into templates (Drain): "connected to 10.0.0.1" and "connected to 10.0.0.7" are one message. Also returns the **rare** ones, which is usually what you were looking for. |
| `log_reduce` | Cuts to a character budget keeping errors with their full trace, the window before, and whatever appears only once. Repeats collapse to `[xN]`. For handing a big log to a model without spending the context on the same line repeated. |
| `log_stacktrace` | Java/JVM, Python, Node, Go, .NET, Rust, Ruby, PHP: the `Caused by` chain, the root cause, and the first frame of **your** code — inferred from the trace if you do not say. |
| `log_lint` | Whether the log is *well written*, not what happened: secrets printed, one line flooding the file, timestamps with no time zone (which make two machines impossible to correlate), the clock going backwards, no request id. Secrets come back masked. |
| `log_convert` | JSON / logfmt / syslog 5424 / CSV / OpenTelemetry / ECS — saying **up front what the conversion loses**. |
| `log_rotation` | Puts rotated logs in **time order**. Rotation numbering runs backwards against time (`app.log.3` is older than `app.log.1`) and alphabetically `app.log.10` sorts before `app.log.9`. Use it first, or you read them backwards. |
| `log_profile_check`<br>`log_profile_suggest` | A reusable profile describing how your team's logs look. `check` returns every error with its exact field, so a model can correct itself in one pass. |

## Two things it will not do

- **It will not invent the server's time zone.** That is not in the log, and guessing it shifts the
  entire timeline without anyone noticing. `log_profile_suggest` says so instead of filling it in.
- **It will not tell you how long anything took** if the log has no timestamps. It says it cannot.

## Privacy, and an honest note

Transport is **stdio**: your MCP host launches this as a subprocess and talks over stdin/stdout.
There is no endpoint, no account and no telemetry. `npx` downloads the package from npm to your
machine the first time; after that nothing goes out.

Two things worth knowing rather than discovering:

- **These tools read whatever the process that launched them can read.** That is the point — it is
  how a 200 MB log becomes answerable — so they are exactly as privileged as your MCP host.
- **What a tool returns enters your model's context.** A log file with hostile text inside it is an
  indirect prompt-injection channel, the same way a web page is. Nothing here sanitizes that.

Every tool declares MCP `annotations`: all are `readOnlyHint: true`, and all are `openWorldHint:
true` because the answer comes from the disk rather than from the arguments.

## More

Part of [Jarroba Tools](https://jarroba.com/tools/) — the same engine as the web tools, so the answer
is identical. Want everything (90 tools, databases, diagrams, test auditing, SPARQL)?
[`@jarroba/mcp`](https://www.npmjs.com/package/@jarroba/mcp).

MIT — see [LICENSE](LICENSE). Source: [github.com/Invarato/jarroba-mcp](https://github.com/Invarato/jarroba-mcp/tree/main/mcp).
