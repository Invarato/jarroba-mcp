# MCP server with the SDK v2, serving both protocol eras

Companion code for the Jarroba article on migrating `@jarroba/mcp` to the MCP SDK v2. The same two tools
—`cidr_contains` and `hash_text`— in TypeScript and in Python, and `check-eras.mjs`, which connects to a server
with a client of **each** protocol era (the 2025 `initialize` handshake and the stateless 2026-07-28 revision) and
checks that both see the same tools and get the same answers.

| File | What |
|---|---|
| `typescript/server.mjs` | Server with `@modelcontextprotocol/server` 2.x + zod 4, started with `serveStdio` |
| `typescript/check-eras.mjs` | Two-era check, for this server or **any** other stdio MCP server |
| `python/server.py` | The same server with the Python SDK `mcp` 2.x (`MCPServer`) |

The CI of this repository runs the check on every push, against the TypeScript example, the Python example and
`@jarroba/mcp` itself.

## Run it

```bash
cd typescript
npm ci
npm test                                                   # the TypeScript server, both eras

cd ../python
python3 -m venv .venv
.venv/bin/pip install --require-hashes -r requirements.txt
cd ../typescript
node check-eras.mjs ../python/.venv/bin/python ../python/server.py   # the same check, against Python
```

Expected output, for either server:

```
✓ 2025 era: negotiated 2025-11-25
✓ 2025 era: SHA-256("abc") is the RFC 6234 value
✓ 2025 era: 10.20.30.40 is inside 10.0.0.0/8
✓ 2025 era: a /33 is an error result, not a crash
✓ 2026 era: stateless 2026-07-28 negotiated
✓ 2026 era: same tools and same answers as 2025
```

`check-eras.mjs` takes any command that starts a stdio server, so it also works on your own server as long as it
has a `hash_text` and a `cidr_contains` tool; otherwise, change the three calls in `session()`.

## Use it from a client

```json
{ "mcpServers": { "example": { "command": "node", "args": ["/absolute/path/to/typescript/server.mjs"] } } }
```

Python dependencies are pinned with hashes (`requirements.txt`, generated from `requirements.in` with
`pip-compile --generate-hashes`). Tested with Node 24 and Python 3.12 (CI) and 3.13, `@modelcontextprotocol/server` 2.3.1,
zod 4.6.7 and `mcp` 2.3.0. MIT licence, like the rest of this repository.
