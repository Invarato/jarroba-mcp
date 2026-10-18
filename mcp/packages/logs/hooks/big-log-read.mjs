#!/usr/bin/env node
import { statSync } from "node:fs";
let raw = "";
for await (const chunk of process.stdin)
    raw += chunk;
let input;
try {
    input = JSON.parse(raw);
}
catch {
    process.exit(0);
}
const path = input?.tool_input?.file_path;
if (input?.tool_name !== "Read" || typeof path !== "string")
    process.exit(0);
const looksLikeLog = /\.(log|jsonl|ndjson)(\.\d+)?(\.gz)?$/i.test(path) || /(^|[\\/])logs?[\\/]/i.test(path);
if (!looksLikeLog)
    process.exit(0);
const limit = Number(process.env.JT_BIG_LOG_BYTES ?? 2 * 1024 * 1024);
let size;
try {
    size = statSync(path).size;
}
catch {
    process.exit(0);
}
if (size < limit)
    process.exit(0);
const mb = (size / 1024 / 1024).toFixed(1);
process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${path} is a ${mb} MB log: reading it would fill your context with repeated lines. ` +
            `Use the jarroba-logs MCP tools with this path instead: log_analyze { "path": "${path}" } for the ` +
            `overview (events, errors with their root cause, patterns), then log_reduce { "path": "${path}" } ` +
            `for the relevant lines within a budget, or log_around / log_distinguish to dig in. ` +
            `If you really need the raw text, Read it with offset/limit.`,
    },
}));
