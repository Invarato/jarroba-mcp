# @jarroba/mcp-calc

**An MCP server for the maths a language model gets wrong — and, above all, for the ones it gets
wrong *silently*.**

```bash
claude mcp add jarroba-calc -- npx -y @jarroba/mcp-calc
```

```jsonc
// Claude Desktop, Cursor, Cline, VS Code…
{ "mcpServers": { "jarroba-calc": { "command": "npx", "args": ["-y", "@jarroba/mcp-calc"] } } }
```

5 tools · **~1.7k tokens** of context · stdio, runs on your machine · nothing is uploaded, no API key.

## Why this exists

A model that gets `17 * 23` wrong is not the problem: that one is easy to catch. The problem is the
answer that looks right.

- **`5 km + 300 m`.** Not a hard sum — but is the answer 305, 5.3, or 5300? A dimensional slip
  produces a number, not an error, and the number travels into the next formula.
- **`x^3 - 1 = 0`.** «x = 1» is *true*, and it is also only a third of the answer. A tool that stops
  there and says nothing teaches the caller that there was nothing else.
- **`9.8 m/s^2 * t^2 / 2`.** Here `m`, `s` and `t` are all names of units *and* perfectly ordinary
  variable names. Read them wrong and you get a plausible quantity in the wrong dimension.

So every tool here reports **how sure it is**, not just what it found: exact or approximate, over
which interval it searched, how many complex roots it is not showing, and which names it read as
units. The one thing none of them will do is fill a gap with something plausible.

## The tools

| | |
|---|---|
| `calc_eval` | Arithmetic **with units** and dimensional checking: `100 km/h to m/s`, `5 km + 300 m`, `70 kg to lbs`, `det([[1,2],[3,4]])`. Adding metres to kilos is an **error**, not a silent number. Flags results that are not finite (NaN, ±∞), and says which names it read as units |
| `calc_solve` | One equation (`x^2 - 5x + 6 = 0`, `sin(x) = 0.5`) or a linear system, one equation per line. Says whether the answer is **exact or approximate**, over which interval it searched, the degree of the polynomial and how many complex roots are not shown. Never invents a root it did not find |
| `calc_sheet` | A **multi-line** calculation sheet with the result of every line. Variables carry downwards, units travel with the value, `#` starts a comment, `ans` is the previous result, and an error stays on its own line instead of killing the sheet. Declare currencies with `# @moneda USD = 1.08 EUR` — **you** supply the rate, so the sheet still computes the same thing next year. Optional Markdown table out |
| `calc_derive` | Exact symbolic derivatives that **keep the units**: `d/dx (3 m * x)` is `3 m`, not `3`. Higher orders, and can evaluate the result at a point. Refuses to answer «0» when the variable is not in the expression, because a correct zero for the wrong question is the worst answer there is |
| `calc_steps` | The **worked steps**, verified: a linear or quadratic equation, a derivative (naming the rule), or Gaussian elimination row by row. When it cannot explain a case it returns `covered: false` instead of writing a plausible derivation — which is the point, if a person is going to read it |

## What it will not do

- **No symbolic simplification.** It was the obvious sixth tool and it was dropped after measuring:
  the engine leaves `(x+1)^2 - (x-1)^2` untouched (it is `4x`) and does not know
  `sin²+cos²=1`. A tool that hands back your own input under the label *"simplified"* is worse than no
  tool, because the caller cannot tell «already simplest» from «I could not do it».
- **No integrals, no limits, no inequalities.** Not supported, and said so here rather than discovered
  at the wrong moment.
- **Steps beyond degree 2** for equations. `calc_solve` still answers exactly; what is missing is the
  explanation, and `calc_steps` says which cases it covers in every response.

## Where it comes from

The engine is the same code that runs the calculator at
[jarroba.com/tools](https://jarroba.com/tools/) — pure TypeScript, ~200 unit tests, no server. This
package is the whole catalogue filtered down to the calculation domain; if you want the other 95
tools (logs, tests, SQL, SPARQL, diagrams…), install
[`@jarroba/mcp`](https://www.npmjs.com/package/@jarroba/mcp) instead. You can also widen this one
without switching packages: `JARROBA_MCP_DOMAINS=calc,core`.

MIT. Nothing here talks to the network. Source: [github.com/Invarato/jarroba-mcp](https://github.com/Invarato/jarroba-mcp/tree/main/mcp).
