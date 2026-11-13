import { importPipeline, type PipelineError, type PipelineNote, type ImportedPipeline } from "../../src/app/features/archsim/archsim-pipeline-import";
import { importTerraform, type TerraformError, type TerraformNote } from "../../src/app/features/archsim/archsim-terraform-import";
import { stepCicdSim } from "../../src/app/features/archsim/archsim-cicd-sim";
import type { ArchState } from "../../src/app/features/archsim/archsim-model";
const r2 = (x: number) => Number.isFinite(x) ? Math.round(x * 100) / 100 : x;
const FORMATO: Record<ImportedPipeline["format"], string> = { github: "GitHub Actions", azure: "Azure Pipelines", gitlab: "GitLab CI", jenkins: "Jenkinsfile (declarative)" };
const ERROR_PIPE: {
    [K in PipelineError["code"]]: (e: Extract<PipelineError, {
        code: K;
    }>) => string;
} = {
    empty: () => "Nothing to import.",
    yaml: (e) => `The YAML is not valid: ${e.detail}`,
    "unknown-format": () => "It does not look like a GitHub Actions, Azure Pipelines or GitLab CI pipeline, nor a declarative Jenkinsfile.",
    "jenkins-scripted": () => "It is a scripted Jenkinsfile (free Groovy, no pipeline { } block): it is a program and cannot be read without running it. Only declarative Jenkinsfiles are imported.",
    "no-jobs": () => "The pipeline has no job or stage.",
};
const NOTA_PIPE: {
    [K in PipelineNote["code"]]: (n: Extract<PipelineNote, {
        code: K;
    }>) => {
        code: string;
        detail: string;
    };
} = {
    "durations-estimated": () => ({ code: "durations-estimated", detail: "Step durations are ESTIMATED from what each step does (the file does not carry them), and runs per day are the trigger default unless you pass runsPerDay. Treat lead time and cost as an order of magnitude." }),
    "reusable-workflow": (n) => ({ code: "reusable-workflow", detail: `Job "${n.name}" calls another workflow (uses:): it counts as one stage, but its steps live in that other file.` }),
    template: (n) => ({ code: "template", detail: `It uses the template "${n.name}", which lives in another file: whatever is inside is not seen here.` }),
    include: () => ({ code: "include", detail: "It includes other files (include:): jobs coming from there are not seen here." }),
    extends: (n) => ({ code: "extends", detail: `Job "${n.name}" extends a template (extends:): if it lives in another file, what it inherits is not seen.` }),
    placeholders: () => ({ code: "placeholders", detail: "It is a wizard template with {{ \u2026 }} placeholders: it was read without them." }),
    cycle: () => ({ code: "cycle", detail: "There are dependency cycles (the file is invalid): they were cut to build the graph." }),
};
export interface EntradaPipeline {
    pipeline: string;
    runsPerDay?: number;
    runners?: number;
}
export function desdePipeline(e: EntradaPipeline) {
    const r = importPipeline(e.pipeline);
    if (r.error || !r.state || !r.pipeline)
        return { error: r.error ? (ERROR_PIPE[r.error.code] as (x: PipelineError) => string)(r.error) : "Could not import." };
    const p = r.pipeline, { nodes, edges } = r.state;
    for (const n of nodes) {
        if (n.kind === "ci_trigger" && e.runsPerDay !== undefined)
            n.ai = { ...n.ai, per_day: e.runsPerDay };
        if (n.kind === "ci_runners" && e.runners !== undefined)
            n.ai = { ...n.ai, size: e.runners };
    }
    const llegada = nodes.filter((n) => n.kind === "ci_trigger").reduce((s, n) => s + (Number(n.ai?.["per_day"]) || 0), 0) / 24;
    const s = stepCicdSim(nodes, edges, {}, 1, llegada);
    return {
        format: FORMATO[p.format],
        ...(p.name ? { name: p.name } : {}),
        trigger: p.trigger,
        runner: p.runner,
        jobs: p.jobs.map((j) => ({
            id: j.id,
            name: j.name,
            needs: j.needs,
            estimatedMinutes: r2(j.steps.reduce((a, x) => a + x.minutes, 0)),
            steps: j.steps.map((x) => ({ name: x.name, estimatedMinutes: x.minutes })),
            ...(j.shards > 1 ? { shards: j.shards } : {}),
            ...(j.cache ? { cache: true } : {}),
            ...(j.deployEnv ? { deploysTo: j.deployEnv } : {}),
            ...(j.manual ? { manualApproval: true } : {}),
        })),
        simulation: {
            runsPerDay: r2(llegada * 24),
            leadTimeP50Min: r2(s.leadP50),
            leadTimeP95Min: r2(s.leadP95),
            executionMin: r2(s.execMin),
            waitingForRunnerMin: r2(s.queueMin),
            runnerUtilization: r2(s.runnerUtil),
            pipelinesWaiting: r2(s.queueLen),
            deploysPerDay: r2(s.deploysPerDay),
            costPerMonthUsd: r2(s.costPerMonth),
            doraLevel: s.dora,
            changeFailureRate: r2(s.changeFailRate),
            recoveryMin: r2(s.recoveryMin),
        },
        notes: p.notes.map((n) => (NOTA_PIPE[n.code] as (x: PipelineNote) => {
            code: string;
            detail: string;
        })(n)),
    };
}
const ERROR_TF: {
    [K in TerraformError["code"]]: (e: Extract<TerraformError, {
        code: K;
    }>) => string;
} = {
    empty: () => "Nothing to import.",
    "no-resources": () => "There is no resource block. If the project spans several .tf files, pass them all, one after another.",
    "nothing-drawable": (e) => `There are ${e.resources} resources, but none carries requests (networking, permissions, DNS…): there is nothing to simulate.`,
};
const NOTA_TF: {
    [K in TerraformNote["code"]]: (n: Extract<TerraformNote, {
        code: K;
    }>) => {
        code: string;
        detail: string;
    };
} = {
    "edges-deduced": () => ({ code: "edges-deduced", detail: "Connections are DEDUCED: Terraform says which resource depends on which, not where requests travel. They are oriented by layers (edge \u2192 entry \u2192 compute \u2192 cache and queues \u2192 data), and triggers go from the source to the consumer. Review them." }),
    "client-added": () => ({ code: "client-added", detail: "A client (\"Users\") was added in front of the entry points with the default load: Terraform does not say how much traffic arrives." }),
    unknown: (n) => ({ code: "unknown", detail: `Not recognised (not drawn): ${n.names.join(", ")}` }),
    plumbing: (n) => ({ code: "plumbing", detail: `${n.count} networking, permission, DNS or certificate resources are not drawn: they carry no requests.` }),
    modules: (n) => ({ code: "modules", detail: `Modules are not expanded (what they create is not seen): ${n.names.join(", ")}` }),
    replicas: (n) => ({ code: "replicas", detail: `"${n.name}" has ${n.count} read replica(s): they count as replicas of that database, not as another one.` }),
    "code-buckets": (n) => ({ code: "code-buckets", detail: `${n.count} bucket(s) that only hold function code are not drawn.` }),
    "via-permissions": (n) => ({ code: "via-permissions", detail: `${n.count} connection(s) to a store were deduced from IAM permissions (the only hint of who uses it).` }),
    "via-shared-name": (n) => ({ code: "via-shared-name", detail: `${n.count} connection(s) to a store were deduced from the function using the variable that holds its name.` }),
};
function aDocumento(st: ArchState) {
    const CAMPOS = ["capacity", "latency", "jitter", "queue", "redelivery", "idempotent", "partitions", "fanout", "hitRatio", "burst", "replicas", "readRatio", "coldStartMs", "retries", "breaker", "failRate"] as const;
    return {
        archsim: 1,
        mode: "runtime",
        nodes: st.nodes.map((n) => {
            const o: Record<string, unknown> = { id: n.id, kind: n.kind, ...(n.label ? { label: n.label } : {}) };
            for (const c of CAMPOS)
                if (n[c] !== undefined)
                    o[c] = n[c];
            return o;
        }),
        edges: st.edges.map((e) => [e.fromId, e.toId]),
    };
}
export function desdeTerraform(texto: string) {
    const r = importTerraform(texto);
    if (r.error || !r.state || !r.stats)
        return { error: r.error ? (ERROR_TF[r.error.code] as (x: TerraformError) => string)(r.error) : "Could not import." };
    return {
        state: r.state,
        result: {
            stats: { resources: r.stats.resources, components: r.stats.components, edges: r.stats.edges, providers: r.stats.providers },
            components: r.state.nodes.map((n) => ({ id: n.id, kind: n.kind, ...(n.label ? { label: n.label } : {}), ...(n.tech ? { tech: n.tech } : {}), ...(n.provider ? { provider: n.provider } : {}) })),
            archsim: aDocumento(r.state),
            notes: r.notes.map((n) => (NOTA_TF[n.code] as (x: TerraformNote) => {
                code: string;
                detail: string;
            })(n)),
        },
    };
}
