import * as jsYaml from "js-yaml";
import { ArchNode, ArchEdge, ArchState } from "./archsim-model";
import { CicdNodeKind, defaultCicdSpec } from "./archsim-cicd";
export type PipelineFormat = "github" | "azure" | "gitlab" | "jenkins";
export type PipelineError = {
    code: "empty";
} | {
    code: "yaml";
    detail: string;
} | {
    code: "unknown-format";
} | {
    code: "jenkins-scripted";
} | {
    code: "no-jobs";
};
export type PipelineNote = {
    code: "reusable-workflow";
    name: string;
} | {
    code: "template";
    name: string;
} | {
    code: "include";
} | {
    code: "extends";
    name: string;
} | {
    code: "durations-estimated";
} | {
    code: "cycle";
} | {
    code: "placeholders";
};
export interface ImportedStep {
    name: string;
    minutes: number;
}
export interface ImportedJob {
    id: string;
    name: string;
    needs: string[];
    steps: ImportedStep[];
    shards: number;
    cache: boolean;
    deployEnv?: "dev" | "staging" | "prod";
    manual?: boolean;
}
export interface ImportedPipeline {
    format: PipelineFormat;
    name?: string;
    trigger: "push" | "pr" | "schedule";
    runner: "small" | "large" | "self";
    jobs: ImportedJob[];
    notes: PipelineNote[];
}
export interface PipelineResult {
    pipeline?: ImportedPipeline;
    state?: ArchState;
    error?: PipelineError;
}
const STEP_KINDS: [
    RegExp,
    number
][] = [
    [/^\s*echo\b/i, 0.05],
    [/checkout|git clone/i, 0.2],
    [/setup[-_ ]?(node|dotnet|java|python|go|ruby)|use(node|dotnet|python)|install.*(sdk|toolchain)|\bnvm\b/i, 0.5],
    [/\b(npm (ci|install)|yarn( install)?|pnpm i|pip install|poetry install|bundle install|dotnet restore|nuget restore|mvn .*dependency|go mod download|composer install|restore)\b/i, 1.5],
    [/docker (build|buildx)|docker\/build-push|buildah|kaniko/i, 4],
    [/\b(test|pytest|jest|vitest|mocha|junit|surefire|rspec|go test|ctest|playwright|cypress)\b/i, 5],
    [/\b(lint|eslint|ruff|flake8|stylelint|checkstyle|sonar|format|prettier)\b/i, 1],
    [/\b(build|compile|mvn .*package|gradle.*(build|assemble)|dotnet build|tsc|webpack|vite build|ng build|make)\b/i, 3],
    [/deploy|kubectl|helm|terraform apply|tofu apply|az webapp|aws deploy|gcloud .*deploy|serverless/i, 3],
    [/upload|publish|artifact|coverall|codecov|release|push/i, 0.5],
    [/cache/i, 0.3],
];
export function estimateStep(text: string): number {
    for (const [re, min] of STEP_KINDS)
        if (re.test(text))
            return min;
    return 1;
}
const isCacheStep = (text: string) => /actions\/cache|Cache@\d|\bcache:\s*['"]?(npm|yarn|pnpm|pip|maven|gradle)/i.test(text);
const envOf = (name: string): "dev" | "staging" | "prod" => (/prod|live|release/i.test(name) ? "prod" : /stag|pre|uat|qa|test/i.test(name) ? "staging" : "dev");
const DEPLOY_NAME = /deploy|release|publish to|despleg/i;
export const PLACEHOLDER = "__placeholder__";
function stripPlaceholders(t: string): string {
    return t.split("\n").filter(l => !/^\s*\{\{[#/^!]|^\s*\{\{else\}\}/.test(l)).join("\n").replace(/(?<![$])\{\{[^}]*\}\}/g, PLACEHOLDER);
}
export function detectFormat(text: string): PipelineFormat | null | {
    scripted: true;
} | {
    yaml: string;
} {
    const t = text.trim();
    if (/^\s*pipeline\s*\{/m.test(t))
        return "jenkins";
    if (/\bnode\s*(\([^)]*\))?\s*\{|\bstage\s*\(|^\s*def\s+\w+\s*=|\bparallel\s*\(/m.test(t) && !/^\s*[\w-]+:\s/m.test(t))
        return { scripted: true };
    let d: unknown;
    try {
        d = jsYaml.load(t);
    }
    catch (e) {
        return { yaml: (e as Error).message.split("\n")[0] };
    }
    if (!d || typeof d !== "object" || Array.isArray(d))
        return null;
    const o = d as Record<string, unknown>;
    const jobs = o["jobs"];
    if (jobs && typeof jobs === "object" && !Array.isArray(jobs) && Object.values(jobs).some(j => j && typeof j === "object" && ("runs-on" in j || "steps" in j || "uses" in j)))
        return "github";
    if (Array.isArray(o["stages"]) && o["stages"].some(s => s && typeof s === "object" && ("stage" in s || "jobs" in s || "template" in s)))
        return "azure";
    if (Array.isArray(jobs) || (Array.isArray(o["steps"]) && ("pool" in o || "trigger" in o || "pr" in o || o["steps"].some(s => s && typeof s === "object" && ("task" in s || "script" in s || "checkout" in s)))))
        return "azure";
    if (Object.values(o).some(v => v && typeof v === "object" && !Array.isArray(v) && ("script" in v || "trigger" in v && "stage" in v)))
        return "gitlab";
    return null;
}
export function importPipeline(text: string): PipelineResult {
    if (!text || !text.trim())
        return { error: { code: "empty" } };
    const placeholders = /(?<![$])\{\{/.test(text);
    if (placeholders)
        text = stripPlaceholders(text);
    const f = detectFormat(text);
    if (f && typeof f === "object")
        return { error: "scripted" in f ? { code: "jenkins-scripted" } : { code: "yaml", detail: f.yaml } };
    if (!f)
        return { error: { code: "unknown-format" } };
    let p: ImportedPipeline;
    try {
        p = f === "jenkins" ? fromJenkins(text) : f === "github" ? fromGithub(jsYaml.load(text) as Record<string, unknown>)
            : f === "azure" ? fromAzure(jsYaml.load(text) as Record<string, unknown>) : fromGitlab(jsYaml.load(text) as Record<string, unknown>);
    }
    catch {
        return { error: { code: "unknown-format" } };
    }
    if (!p.jobs.length)
        return { error: { code: "no-jobs" } };
    if (placeholders && p.format !== "jenkins")
        p.notes.push({ code: "placeholders" });
    p.notes.push({ code: "durations-estimated" });
    return { pipeline: p, state: toState(p) };
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const matrixSize = (m: unknown): number => {
    const o = obj(m);
    let n = 1;
    for (const [k, v] of Object.entries(o))
        if (k !== "include" && k !== "exclude" && Array.isArray(v))
            n *= Math.max(1, v.length);
    if (Array.isArray(o["include"]) && n === 1)
        n = Math.max(1, o["include"].length);
    return n;
};
export const tidyName = (s: string): string => s.replace(/\$\{\{\s*([\w.-]+)\s*\}\}/g, (_, p: string) => `‹${p.split(".").pop()}›`);
const stepOf = (name: string, cmd = ""): ImportedStep => ({ name: tidyName(name || cmd.split("\n")[0].slice(0, 60) || "\u00B7"), minutes: estimateStep(name + " " + cmd) });
function fromGithub(d: Record<string, unknown>): ImportedPipeline {
    const on = d["on"] ?? d["true"];
    const evs = typeof on === "string" ? [on] : Array.isArray(on) ? on.map(str) : Object.keys(obj(on));
    const trigger = evs.some(e => e.startsWith("pull_request")) ? "pr" : evs.includes("push") ? "push" : evs.includes("schedule") ? "schedule" : "push";
    const notes: PipelineNote[] = [];
    let runner: ImportedPipeline["runner"] = "small";
    const jobs: ImportedJob[] = [];
    for (const [id, raw] of Object.entries(obj(d["jobs"]))) {
        const j = obj(raw);
        const runsOn = str(j["runs-on"]);
        if (/self-hosted/i.test(runsOn))
            runner = "self";
        else if (/large|xlarge|\d+-?core/i.test(runsOn) && runner !== "self")
            runner = "large";
        if (j["uses"])
            notes.push({ code: "reusable-workflow", name: id });
        const steps = arr(j["steps"]).map(s => { const o = obj(s); return stepOf(str(o["name"]), str(o["uses"]) + " " + str(o["run"])); });
        if (j["uses"] && !steps.length)
            steps.push(stepOf(str(j["uses"])));
        const env = j["environment"] ? str(typeof j["environment"] === "object" ? obj(j["environment"])["name"] : j["environment"]) : "";
        jobs.push({
            id,
            name: str(j["name"]) || id,
            needs: arr(j["needs"]).map(str),
            steps,
            shards: matrixSize(obj(j["strategy"])["matrix"]),
            cache: arr(j["steps"]).some(s => isCacheStep(JSON.stringify(s))),
            deployEnv: env ? envOf(env) : DEPLOY_NAME.test(id + " " + str(j["name"])) ? envOf(id + " " + str(j["name"])) : undefined,
        });
    }
    return { format: "github", name: str(d["name"]) || undefined, trigger, runner, jobs, notes };
}
function fromAzure(d: Record<string, unknown>): ImportedPipeline {
    const notes: PipelineNote[] = [];
    const trigger: ImportedPipeline["trigger"] = d["pr"] && d["pr"] !== "none" ? "pr" : d["schedules"] && !d["trigger"] ? "schedule" : "push";
    let runner: ImportedPipeline["runner"] = "small";
    const poolKind = (p: unknown) => { const o = obj(p); if (str(p).includes(PLACEHOLDER))
        return; if (typeof p === "string" || o["name"])
        runner = "self"; };
    poolKind(d["pool"]);
    const azSteps = (steps: unknown): ImportedStep[] => arr(steps).map(s => {
        const o = obj(s);
        if (o["template"])
            notes.push({ code: "template", name: str(o["template"]) });
        const cmd = str(o["task"] ?? o["script"] ?? o["bash"] ?? o["pwsh"] ?? o["powershell"] ?? (o["checkout"] != null ? "checkout" : o["template"] ?? ""));
        return stepOf(str(o["displayName"]), cmd + " " + str(obj(o["inputs"])["command"]) + " " + str(obj(o["inputs"])["arguments"]));
    });
    const jobs: ImportedJob[] = [];
    const toJob = (j: Record<string, unknown>, stageName: string, idx: number): ImportedJob => {
        if (j["template"])
            notes.push({ code: "template", name: str(j["template"]) });
        poolKind(j["pool"]);
        const isDeploy = j["deployment"] != null;
        const id = (stageName ? stageName + "." : "") + str(j["job"] ?? j["deployment"] ?? j["template"] ?? `job${idx + 1}`);
        const strategy = obj(j["strategy"]);
        const strat = Object.values(strategy).map(obj).find(x => x["deploy"]);
        const steps = azSteps(isDeploy ? obj(strat?.["deploy"])["steps"] : j["steps"]);
        if (isDeploy && !steps.length)
            steps.push(stepOf("deploy"));
        const env = str(typeof j["environment"] === "object" ? obj(j["environment"])["name"] : j["environment"]);
        return {
            id,
            name: str(j["displayName"]) || id,
            needs: arr(j["dependsOn"]).map(x => (stageName ? stageName + "." : "") + str(x)),
            steps,
            shards: Math.max(1, Number(strategy["parallel"]) || matrixSize(strategy["matrix"]) || Object.keys(obj(strategy["matrix"])).length || 1),
            cache: arr(j["steps"]).some(s => isCacheStep(JSON.stringify(s))),
            deployEnv: isDeploy || env ? envOf(env || id) : undefined,
        };
    };
    if (Array.isArray(d["stages"])) {
        let prevExits: string[] = [];
        const exitsByStage = new Map<string, string[]>();
        d["stages"].forEach((rawS, si) => {
            const s = obj(rawS);
            if (s["template"]) {
                notes.push({ code: "template", name: str(s["template"]) });
                return;
            }
            const sName = str(s["stage"] ?? `stage${si + 1}`);
            const sJobs = arr(s["jobs"]).map((j, i) => toJob(obj(j), sName, i));
            const deps = "dependsOn" in s ? arr(s["dependsOn"]).flatMap(x => exitsByStage.get(str(x)) ?? []) : prevExits;
            for (const j of sJobs)
                if (!j.needs.length)
                    j.needs = [...deps];
            const needed = new Set(sJobs.flatMap(j => j.needs));
            const exits = sJobs.filter(j => !needed.has(j.id)).map(j => j.id);
            exitsByStage.set(sName, exits);
            prevExits = exits;
            jobs.push(...sJobs);
        });
    }
    else if (Array.isArray(d["jobs"])) {
        d["jobs"].forEach((j, i) => jobs.push(toJob(obj(j), "", i)));
    }
    else if (Array.isArray(d["steps"])) {
        jobs.push({ id: "job", name: "Job", needs: [], steps: azSteps(d["steps"]), shards: 1, cache: d["steps"].some(s => isCacheStep(JSON.stringify(s))) });
    }
    return { format: "azure", name: str(d["name"]) || undefined, trigger, runner, jobs, notes };
}
const GITLAB_RESERVED = new Set(["image", "services", "stages", "types", "variables", "include", "default", "workflow", "cache", "before_script", "after_script", "pages:deploy"]);
function fromGitlab(d: Record<string, unknown>): ImportedPipeline {
    const notes: PipelineNote[] = [];
    if (d["include"])
        notes.push({ code: "include" });
    const stages = Array.isArray(d["stages"]) ? d["stages"].map(str) : ["build", "test", "deploy"];
    const order = [".pre", ...stages.filter(s => s !== ".pre" && s !== ".post"), ".post"];
    const defs = Object.entries(d).filter(([k, v]) => !GITLAB_RESERVED.has(k) && !k.startsWith(".") && v && typeof v === "object" && !Array.isArray(v));
    const raw = defs.map(([id, v]) => ({ id, j: obj(v) }));
    const byStage = (s: string) => raw.filter(r => str(r.j["stage"] || "test") === s).map(r => r.id);
    const workflowRules = JSON.stringify(d["workflow"] ?? "") + JSON.stringify(raw.map(r => r.j["rules"] ?? r.j["only"] ?? ""));
    const trigger: ImportedPipeline["trigger"] = /merge_request/.test(workflowRules) ? "pr" : /schedule/.test(workflowRules) && !/push/.test(workflowRules) ? "schedule" : "push";
    let runner: ImportedPipeline["runner"] = "small";
    const jobs: ImportedJob[] = raw.map(({ id, j }) => {
        if (j["extends"])
            notes.push({ code: "extends", name: id });
        if (arr(j["tags"]).length)
            runner = "self";
        const stage = str(j["stage"] || "test");
        let needs: string[];
        if ("needs" in j)
            needs = arr(j["needs"]).map(n => (typeof n === "object" ? str(obj(n)["job"]) : str(n)));
        else {
            const i = order.indexOf(stage);
            needs = [];
            for (let k = i - 1; k >= 0 && !needs.length; k--)
                needs = byStage(order[k]);
        }
        const scr = [...arr(d["before_script"]), ...arr(j["before_script"]), ...arr(j["script"])].map(str);
        const par = j["parallel"];
        const env = j["environment"] ? str(typeof j["environment"] === "object" ? obj(j["environment"])["name"] : j["environment"]) : "";
        const manual = str(j["when"]) === "manual" || arr(j["rules"]).some(r => str(obj(r)["when"]) === "manual");
        return {
            id,
            name: id,
            needs,
            steps: scr.length ? scr.map(c => stepOf("", c)) : [stepOf(id)],
            shards: typeof par === "number" ? Math.max(1, par) : par ? matrixSize(arr(obj(par)["matrix"])[0]) : 1,
            cache: !!(j["cache"] ?? d["cache"]),
            deployEnv: env ? envOf(env) : stage === "deploy" ? envOf(id) : undefined,
            manual,
        };
    });
    return { format: "gitlab", trigger, runner, jobs, notes };
}
interface Blk {
    name: string;
    arg: string;
    body: string;
    children: Blk[];
}
function blocks(src: string): Blk[] {
    const out: Blk[] = [];
    let i = 0;
    const skipStr = (q: string) => { const triple = src.startsWith(q.repeat(3), i); const end = triple ? q.repeat(3) : q; i += end.length; while (i < src.length && !src.startsWith(end, i)) {
        if (src[i] === "\\")
            i++;
        i++;
    } i += end.length; };
    while (i < src.length) {
        const c = src[i];
        if (c === "/" && src[i + 1] === "/") {
            while (i < src.length && src[i] !== "\n")
                i++;
            continue;
        }
        if (c === "/" && src[i + 1] === "*") {
            const e = src.indexOf("*/", i + 2);
            i = e < 0 ? src.length : e + 2;
            continue;
        }
        if (c === "'" || c === "\"") {
            skipStr(c);
            continue;
        }
        const m = /^([A-Za-z_]\w*)\s*(\(([^)]*)\))?\s*\{/.exec(src.slice(i, i + 300));
        if (m && (i === 0 || /[\s;{}]/.test(src[i - 1]))) {
            const start = i + m[0].length;
            let depth = 1;
            i = start;
            while (i < src.length && depth > 0) {
                const ch = src[i];
                if (ch === "'" || ch === "\"") {
                    skipStr(ch);
                    continue;
                }
                if (ch === "/" && src[i + 1] === "/") {
                    while (i < src.length && src[i] !== "\n")
                        i++;
                    continue;
                }
                if (ch === "{")
                    depth++;
                else if (ch === "}")
                    depth--;
                i++;
            }
            const body = src.slice(start, i - 1);
            out.push({ name: m[1], arg: (m[3] ?? "").trim().replace(/^['"]|['"]$/g, ""), body, children: blocks(body) });
            continue;
        }
        i++;
    }
    return out;
}
function fromJenkins(text: string): ImportedPipeline {
    const pipe = blocks(text).find(b => b.name === "pipeline");
    const root = pipe?.children ?? [];
    const triggers = root.find(b => b.name === "triggers")?.body ?? "";
    const trigger: ImportedPipeline["trigger"] = /cron|pollSCM/.test(triggers) && !/githubPush|gitlab/.test(triggers) ? "schedule" : /pullRequest|changeRequest/.test(text) ? "pr" : "push";
    const jobs: ImportedJob[] = [];
    let seq = 0;
    const walkStages = (list: Blk[], prev: string[]): string[] => {
        let last = prev;
        for (const st of list.filter(b => b.name === "stage"))
            last = walkStage(st, last);
        return last;
    };
    const walkStage = (st: Blk, prev: string[]): string[] => {
        const par = st.children.find(b => b.name === "parallel");
        if (par)
            return par.children.filter(b => b.name === "stage").flatMap(b => walkStage(b, prev));
        const nested = st.children.find(b => b.name === "stages");
        if (nested)
            return walkStages(nested.children, prev);
        const matrix = st.children.find(b => b.name === "matrix");
        const stepsB = st.children.find(b => b.name === "steps") ?? matrix?.children.find(b => b.name === "stages")?.children.find(b => b.name === "stage")?.children.find(b => b.name === "steps");
        const lines = (stepsB?.body ?? "").split("\n").map(l => l.trim())
            .filter(l => /^[a-z]\w*(\.\w+)*\s*(\(|['"]|\s+['"\w-])/.test(l) && !/^(if|else|for|while|def|return|try|catch|finally|switch|case|script|String|int|boolean|currentBuild|env)\b/.test(l));
        const steps = lines.length ? lines.map(l => stepOf("", l)) : [stepOf(st.arg)];
        let shards = 1;
        if (matrix) {
            const axes = matrix.children.find(b => b.name === "axes")?.children.filter(b => b.name === "axis") ?? [];
            for (const a of axes) {
                const vals = /values\s+(.+)/.exec(a.body)?.[1] ?? "";
                shards *= Math.max(1, vals.split(",").length);
            }
        }
        const id = `stage${++seq}`;
        jobs.push({
            id,
            name: st.arg || id,
            needs: prev,
            steps,
            shards,
            cache: /cache\s*\(|stash|unstash/.test(stepsB?.body ?? ""),
            deployEnv: DEPLOY_NAME.test(st.arg) ? envOf(st.arg) : undefined,
            manual: st.children.some(b => b.name === "input") || /\binput\s*(\(|message)/.test(stepsB?.body ?? ""),
        });
        return [id];
    };
    walkStages(root.find(b => b.name === "stages")?.children ?? [], []);
    return { format: "jenkins", trigger, runner: "self", jobs, notes: [] };
}
const COL_W = 210, ROW_H = 120;
export function toState(p: ImportedPipeline): ArchState {
    const nodes: ArchNode[] = [];
    const edges: ArchEdge[] = [];
    let seq = 0;
    const node = (kind: CicdNodeKind, label: string, col: number, row: number, spec: Record<string, unknown> = {}): ArchNode => {
        const n: ArchNode = { id: `${kind}_${++seq}`, kind, x: 60 + col * COL_W, y: 80 + row * ROW_H, label, ai: { ...defaultCicdSpec(kind), ...spec } };
        nodes.push(n);
        return n;
    };
    const link = (a: ArchNode, b: ArchNode) => edges.push({ id: `e_${++seq}`, fromId: a.id, toId: b.id, fromTerm: "out", toTerm: "in" });
    const byId = new Map(p.jobs.map(j => [j.id, j]));
    const depth = new Map<string, number>();
    let cycle = false;
    const dOf = (id: string, seen = new Set<string>()): number => {
        if (depth.has(id))
            return depth.get(id)!;
        if (seen.has(id)) {
            cycle = true;
            return 0;
        }
        seen.add(id);
        const j = byId.get(id);
        const deps = (j?.needs ?? []).filter(n => byId.has(n));
        const v = deps.length ? Math.max(...deps.map(n => dOf(n, seen))) + 1 : 0;
        depth.set(id, v);
        return v;
    };
    for (const j of p.jobs)
        dOf(j.id);
    if (cycle)
        p.notes.push({ code: "cycle" });
    const trig = node("ci_trigger", tidyName(p.name || "Trigger"), 0, 0, { event: p.trigger });
    const rows = new Map<number, number>();
    const gap = p.jobs.some(j => j.manual) ? 2 : 1;
    const colOf = (j: ImportedJob) => 1 + gap * (depth.get(j.id) ?? 0);
    const stageCol = (j: ImportedJob) => colOf(j) + gap - 1;
    const made = new Map<string, ArchNode>(), rowOf = new Map<string, number>();
    for (const j of p.jobs) {
        const col = colOf(j), row = rows.get(col) ?? 0;
        rows.set(col, row + 1);
        rowOf.set(j.id, row);
        const total = Math.round(j.steps.reduce((a, s) => a + s.minutes, 0) * 10) / 10;
        const stepsTxt = j.steps.map(s => `${s.name} · ~${s.minutes} min`).join("\n");
        const label = tidyName(j.name);
        const n = j.deployEnv
            ? node("ci_deploy", label, stageCol(j), row, { env: j.deployEnv, duration: total, steps: stepsTxt, estimated: true })
            : node("ci_stage", label, stageCol(j), row, { duration: total, shards: j.shards, cacheable: j.cache, steps: stepsTxt, estimated: true });
        made.set(j.id, n);
    }
    for (const j of p.jobs) {
        const n = made.get(j.id)!;
        let entry: ArchNode = n;
        if (j.manual) {
            entry = node("ci_gate", "\u270B " + tidyName(j.name), colOf(j), rowOf.get(j.id)!, { auto: false, wait: 30 });
            link(entry, n);
        }
        if (j.cache) {
            const c = node("ci_cache", "Cache", stageCol(j), rowOf.get(j.id)! - 0.55, {});
            link(c, n);
        }
        const deps = j.needs.filter(x => made.has(x) && !(cycle && (depth.get(x) ?? 0) >= (depth.get(j.id) ?? 0)));
        if (!deps.length)
            link(trig, entry);
        for (const d of deps)
            link(made.get(d)!, entry);
    }
    const maxRow = Math.max(1, ...rows.values());
    node("ci_runners", "Runners", 1, maxRow + 1, { runner_type: p.runner, cost_min: p.runner === "large" ? 0.042 : p.runner === "self" ? 0 : 0.008 });
    return { nodes, edges };
}
