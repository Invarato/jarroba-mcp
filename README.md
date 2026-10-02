# Jarroba Tools — MCP servers

Source of the [`@jarroba/mcp`](https://www.npmjs.com/package/@jarroba/mcp) family of MCP servers:
deterministic tools for AI agents that run on your machine and upload nothing. The packages and their
documentation are in [`mcp/`](mcp/README.md).

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

License: MIT (see [LICENSE](LICENSE)). Third-party notices ship in each package's `dist/`.
