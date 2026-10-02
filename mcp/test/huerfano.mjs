import { spawn, execFileSync } from "node:child_process";
import { openSync, closeSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export async function probarHuerfano(comando, args, { env = process.env, tool = "no_existe", arranqueMs = 2500 } = {}) {
    const dir = mkdtempSync(join(tmpdir(), "huerfano-"));
    const fifo = join(dir, "salida");
    execFileSync("mkfifo", [fifo]);
    const lectura = openSync(fifo, constants.O_RDONLY | constants.O_NONBLOCK);
    const escritura = openSync(fifo, constants.O_WRONLY);
    const hijo = spawn(comando, args, { stdio: ["pipe", escritura, escritura], env });
    closeSync(escritura);
    const msg = (o) => { try {
        hijo.stdin.write(JSON.stringify(o) + "\n");
    }
    catch { } };
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    await espera(arranqueMs);
    msg({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "h", version: "0" } } });
    await espera(800);
    msg({ jsonrpc: "2.0", method: "notifications/initialized" });
    closeSync(lectura);
    for (let i = 0; i < 3; i++) {
        msg({ jsonrpc: "2.0", id: 10 + i, method: "tools/call", params: { name: tool, arguments: {} } });
        await espera(300);
    }
    await espera(3000);
    const ticks = () => { try {
        const f = readFileSync(`/proc/${hijo.pid}/stat`, "utf8").split(") ")[1].split(" ");
        return +f[11] + +f[12];
    }
    catch {
        return null;
    } };
    const a = ticks();
    await espera(2000);
    const b = ticks();
    const vivo = hijo.exitCode === null && hijo.signalCode === null && a !== null && b !== null;
    hijo.stdin.destroy();
    hijo.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
    return { vivo, cpu: vivo ? (b - a) / 2 : 0 };
}
export const CONTROL_ROTO = [
    "-e",
    "process.on('uncaughtException', (e) => console.error('capturada', e));"
        + "process.stdin.on('data', () => process.stdout.write('{}\\n'));",
];
