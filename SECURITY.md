# Security policy

## Reporting a vulnerability

Please report it **privately**, through GitHub:
[**Report a vulnerability**](https://github.com/Invarato/jarroba-mcp/security/advisories/new)
(the *Security* tab of this repository). Do not open a public issue for it.

Include, if you can: the package and its version (the server reports it in `serverInfo`), the tool
involved, the input that triggers it, and what happens versus what you expected. A minimal `tools/call`
request is ideal.

We aim to acknowledge reports within a week and to publish a fixed version as soon as it is ready. Fixes go
into the next release of all four packages; please give us a reasonable time before disclosing.

## Supported versions

Only the **latest** published version of `@jarroba/mcp`, `@jarroba/mcp-logs`, `@jarroba/mcp-tests` and
`@jarroba/mcp-calc` receives fixes. The four always share the same version number.

## What the servers do, for threat modelling

- They are **stdio** MCP servers: they run on the user's machine, started by the MCP client. They open **no
  network listener** and make **no requests to the internet**. The one tool that talks HTTP is
  `diagram_render`, and only to the local development server of the Jarroba Tools web app, at the URL it is
  given (it does nothing outside that repository).
- Almost every tool is a pure function of its arguments: it reads nothing from disk and writes nothing.
- The exceptions are explicit in each tool's annotations (`readOnlyHint`, `destructiveHint`,
  `openWorldHint`): the log tools, the project tools, the test-audit tools and `spreadsheet_audit` **read
  files and folders by a path the caller gives**, and `diagram_render` **writes a PNG** to the path it is given. They act with the
  permissions of the user who runs the client.
- Untrusted input is expected: everything a tool receives comes from a model, which may have read hostile
  content. Inputs have size limits and the expensive engines (regular expressions, parsers) run under time
  budgets; a hang, a crash of the server or an unbounded allocation triggered by an input is in scope.
- Out of scope: what a client or a model decides to do with a tool's output, and vulnerabilities in
  dependencies that are not reachable from a tool (report those upstream).
