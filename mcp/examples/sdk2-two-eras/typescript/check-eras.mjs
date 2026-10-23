#!/usr/bin/env node
// Connects to an MCP server over stdio with a client of EACH protocol era and checks both see the same thing.
//   node check-eras.mjs                          → the TypeScript server next to this file
//   node check-eras.mjs python ../python/server.py   → any other stdio server (command + args)
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const [command, ...args] = process.argv.length > 2
  ? process.argv.slice(2)
  : ['node', fileURLToPath(new URL('./server.mjs', import.meta.url))];

let failures = 0;
const check = (what, cond, got) => {
  console.log(`${cond ? '✓' : '✗'} ${what}${cond ? '' : `  got=${JSON.stringify(got)}`}`);
  if (!cond) failures++;
};

async function session(label, options) {
  const client = new Client({ name: `eras-${label}`, version: '1.0.0' }, options);
  await client.connect(new StdioClientTransport({ command, args }));
  const tools = (await client.listTools()).tools;
  const hash = await client.callTool({ name: 'hash_text', arguments: { text: 'abc' } });
  const inside = await client.callTool({ name: 'cidr_contains', arguments: { cidr: '10.0.0.0/8', ip: '10.20.30.40' } });
  const bad = await client.callTool({ name: 'cidr_contains', arguments: { cidr: '10.0.0.0/33', ip: '10.0.0.1' } });
  const r = {
    era: client.getProtocolEra?.() ?? 'legacy', version: client.getNegotiatedProtocolVersion(),
    tools: tools.map((t) => t.name).sort(),
    sha256: JSON.parse(hash.content[0].text).sha256,
    contains: JSON.parse(inside.content[0].text).contains,
    badIsError: !!bad.isError,
  };
  await client.close();
  return r;
}

const legacy = await session('2025', {});   // default mode: the 2025 `initialize` handshake
const modern = await session('2026', { versionNegotiation: { mode: { pin: '2026-07-28' } } }).catch((e) => ({ error: e.message }));

check(`2025 era: negotiated ${legacy.version}`, legacy.version === '2025-11-25', legacy);
check('2025 era: SHA-256("abc") is the RFC 6234 value', legacy.sha256 === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', legacy.sha256);
check('2025 era: 10.20.30.40 is inside 10.0.0.0/8', legacy.contains === true, legacy.contains);
check('2025 era: a /33 is an error result, not a crash', legacy.badIsError, legacy);
check('2026 era: stateless 2026-07-28 negotiated', modern.era === 'modern' && modern.version === '2026-07-28', modern);
check('2026 era: same tools and same answers as 2025', !modern.error
  && JSON.stringify({ ...modern, era: 0, version: 0 }) === JSON.stringify({ ...legacy, era: 0, version: 0 }), { legacy, modern });

console.log(failures ? `\n${failures} failure(s)` : '\nBoth eras OK');
process.exit(failures ? 1 : 0);
