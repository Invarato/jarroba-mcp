#!/usr/bin/env node
// Minimal MCP server over stdio with the TypeScript SDK v2 (@modelcontextprotocol/server + zod 4).
// Two deterministic tools a model tends to get wrong, written the way we write the 137 of @jarroba/mcp:
// English descriptions, honest annotations, errors as `isError` results, and both protocol eras served.
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const server = new McpServer(
  { name: 'sdk2-two-eras-example', version: '1.0.0' },
  // What a client keeps loaded when it defers tool definitions (Claude Code's Tool Search): say WHEN to search here.
  { instructions: 'Exact IPv4 and hashing computations. Use these tools instead of estimating the result yourself.' },
);

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const err = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
// Pure, no disk, no network: the client may run these without asking.
const PURE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const ipToInt = (ip) => {
  const p = ip.trim().split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
  return p.reduce((n, x) => n * 256 + Number(x), 0);
};

server.registerTool('cidr_contains', {
  title: 'Is an IPv4 address inside a CIDR network?',
  description: 'Is this IPv4 address inside that CIDR network? Returns true/false plus the network range.',
  inputSchema: z.object({
    cidr: z.string().max(18).describe('e.g. "10.0.0.0/8"'),
    ip: z.string().max(15).describe('e.g. "10.20.30.40"'),
  }),
  annotations: PURE,
}, async ({ cidr, ip }) => {
  const [base, bits] = cidr.split('/');
  const b = ipToInt(base ?? ''), n = Number(bits), x = ipToInt(ip);
  if (b === null || x === null || !/^\d{1,2}$/.test(bits ?? '') || n > 32) return err(`Invalid CIDR or IP: "${cidr}", "${ip}"`);
  const size = 2 ** (32 - n);
  const first = Math.floor(b / size) * size;
  const toIp = (v) => [24, 16, 8, 0].map((s) => Math.floor(v / 2 ** s) % 256).join('.');
  return ok({ contains: x >= first && x < first + size, network: toIp(first), last: toIp(first + size - 1) });
});

server.registerTool('hash_text', {
  title: 'SHA-256 of a text',
  description: 'SHA-256 (hex) of a UTF-8 string.',
  inputSchema: z.object({ text: z.string().max(1_000_000) }),
  annotations: PURE,
}, async ({ text }) => ok({ sha256: createHash('sha256').update(text, 'utf8').digest('hex') }));

// Exit when the client goes away, instead of lingering as an orphan (it happened to us: 100 % CPU forever).
process.stdin.on('end', () => process.exit(0));

// serveStdio, not `server.connect(new StdioServerTransport())`: only this entry negotiates the 2026-07-28
// (stateless) era as well as the 2025 `initialize` handshake. With the old wiring, a 2026 client fails.
serveStdio(() => server);
