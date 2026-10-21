# Contributing

This repository is a **read-only mirror**: it is regenerated from the private repository of Jarroba Tools at
every release, so pull requests cannot be merged here. Contributions are still welcome, as issues:

- **Bugs:** open an issue with the *Bug* template — package and version, the tool, the input and what you
  expected. A minimal `tools/call` request is the best report.
- **Ideas:** open an issue with the *Proposal* template. The tools that fit best replace something a model
  guesses with something computed.
- **Security vulnerabilities:** never in a public issue — see [SECURITY.md](SECURITY.md).

## How changes are made and tested

- Every change goes with tests. A new tool or behaviour adds its cases to `mcp/test/client.test.mts` (the tool
  through a real MCP client) and, if it affects packaging, to `mcp/test/paquete.test.mjs` (the packed and
  installed package). A bug fix adds the case that would have caught it.
- CI runs the whole suite on Linux, Windows and macOS with every supported Node version, plus a conformance
  check with the official MCP Inspector. A release is built and published only from this repository's CI.
- Everything a model reads is in English: tool descriptions, parameters, results and errors.

## Building and testing locally

```bash
npm install            # engines' dependencies (root)
cd mcp && npm install
npm run typecheck && npm run build && npm test && npm run test:paquete
```
