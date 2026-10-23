# Jarroba Tools — MCP servers

[![ci](https://github.com/Invarato/jarroba-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Invarato/jarroba-mcp/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Invarato/jarroba-mcp/badge)](https://scorecard.dev/viewer/?uri=github.com/Invarato/jarroba-mcp)
[![npm](https://img.shields.io/npm/v/@jarroba/mcp)](https://www.npmjs.com/package/@jarroba/mcp)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15769/badge)](https://www.bestpractices.dev/projects/15769)

Source of the [`@jarroba/mcp`](https://www.npmjs.com/package/@jarroba/mcp) family of MCP servers:
deterministic tools for AI agents that run on your machine and upload nothing. The packages and their
documentation are in [`mcp/`](mcp/README.md). Minimal examples of an MCP server with the SDK v2, in TypeScript and
Python, are in [`mcp/examples/`](mcp/examples/sdk2-two-eras/).

The tools reuse the engines of [jarroba.com/tools](https://jarroba.com/tools/): they live under
`src/app/`, with the same layout as in the web app, so that the code here is the code that runs there.

**This repository is a read-only mirror**, generated from the private repository of Jarroba Tools at each
release. Issues are welcome; pull requests cannot be merged here.

## Build and test

```bash
npm install            # engines' dependencies (root)
cd mcp && npm install
npm run build && npm test && npm run test:paquete
```

Security: see [SECURITY.md](SECURITY.md) — report vulnerabilities privately, not in a public issue.

Changes per version: [CHANGELOG.md](CHANGELOG.md). How to report bugs and propose tools: [CONTRIBUTING.md](CONTRIBUTING.md).

License: MIT (see [LICENSE](LICENSE)). Third-party notices ship in each package's `dist/`.
