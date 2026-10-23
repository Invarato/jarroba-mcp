"""Minimal MCP server over stdio with the Python SDK v2 (mcp 2.x): the same two tools as the TypeScript example.

    python server.py            # started by an MCP client, not by hand
"""
import hashlib
import ipaddress
import json
from typing import Annotated

from pydantic import Field

from mcp.server.mcpserver import MCPServer
from mcp.types import CallToolResult, TextContent, ToolAnnotations

server = MCPServer(
    "sdk2-two-eras-example",
    instructions="Exact IPv4 and hashing computations. Use these tools instead of estimating the result yourself.",
)

# Pure, no disk, no network: the client may run these without asking.
PURE = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)


def ok(data: dict) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=json.dumps(data))])


def err(message: str) -> CallToolResult:
    return CallToolResult(content=[TextContent(type="text", text=message)], isError=True)


@server.tool(title="Is an IPv4 address inside a CIDR network?", annotations=PURE)
def cidr_contains(
    cidr: Annotated[str, Field(max_length=18, description='e.g. "10.0.0.0/8"')],
    ip: Annotated[str, Field(max_length=15, description='e.g. "10.20.30.40"')],
) -> CallToolResult:
    """Is this IPv4 address inside that CIDR network? Returns true/false plus the network range."""
    try:
        net = ipaddress.IPv4Network(cidr, strict=False)
        addr = ipaddress.IPv4Address(ip)
    except ValueError:
        return err(f'Invalid CIDR or IP: "{cidr}", "{ip}"')
    return ok({"contains": addr in net, "network": str(net.network_address), "last": str(net.broadcast_address)})


@server.tool(title="SHA-256 of a text", annotations=PURE)
def hash_text(text: Annotated[str, Field(max_length=1_000_000)]) -> CallToolResult:
    """SHA-256 (hex) of a UTF-8 string."""
    return ok({"sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()})


if __name__ == "__main__":
    server.run("stdio")
