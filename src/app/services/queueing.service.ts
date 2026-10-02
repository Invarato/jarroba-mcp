import { Injectable } from "@angular/core";
export const MAX_SERVERS = 1000;
export const MAX_CAPACITY = 100000;
export interface QueueResult {
    servers: number;
    offeredLoad: number;
    utilization: number;
    pWait: number;
    pBlock: number;
    lq: number;
    l: number;
    wq: number;
    w: number;
    throughput: number;
}
export interface ServiceTarget {
    maxWq?: number;
    maxBlock?: number;
    maxWait?: number;
    maxUtilization?: number;
}
function finite(x: unknown): x is number {
    return typeof x === "number" && Number.isFinite(x);
}
function intIn(x: unknown, min: number, max: number): number {
    if (!finite(x))
        return min;
    const n = Math.trunc(x);
    if (n < min)
        return min;
    if (n > max)
        return max;
    return n;
}
export function erlangB(offeredLoad: number, servers: number): number | null {
    if (!finite(offeredLoad) || offeredLoad < 0)
        return null;
    if (!finite(servers) || servers < 0)
        return null;
    const c = intIn(servers, 0, MAX_SERVERS);
    let b = 1;
    for (let n = 1; n <= c; n++) {
        const num = offeredLoad * b;
        b = num / (n + num);
    }
    return b;
}
export function erlangC(offeredLoad: number, servers: number): number | null {
    if (!finite(offeredLoad) || offeredLoad < 0)
        return null;
    if (!finite(servers) || servers < 1)
        return null;
    const c = intIn(servers, 1, MAX_SERVERS);
    if (offeredLoad >= c)
        return null;
    const b = erlangB(offeredLoad, c);
    if (b === null)
        return null;
    const rho = offeredLoad / c;
    const den = 1 - rho * (1 - b);
    if (!(den > 0))
        return null;
    const cProb = b / den;
    return Math.min(1, Math.max(0, cProb));
}
export function mmc(lambda: number, mu: number, servers: number): QueueResult | null {
    if (!finite(lambda) || lambda <= 0)
        return null;
    if (!finite(mu) || mu <= 0)
        return null;
    if (!finite(servers) || servers < 1)
        return null;
    const c = intIn(servers, 1, MAX_SERVERS);
    const a = lambda / mu;
    if (a >= c)
        return null;
    const pWait = erlangC(a, c);
    if (pWait === null)
        return null;
    const rho = a / c;
    const lq = (pWait * rho) / (1 - rho);
    const wq = lq / lambda;
    const w = wq + 1 / mu;
    const l = lambda * w;
    return {
        servers: c,
        offeredLoad: a,
        utilization: rho,
        pWait,
        pBlock: 0,
        lq,
        l,
        wq,
        w,
        throughput: lambda,
    };
}
export function mmck(lambda: number, mu: number, servers: number, capacity: number): QueueResult | null {
    if (!finite(lambda) || lambda <= 0)
        return null;
    if (!finite(mu) || mu <= 0)
        return null;
    if (!finite(servers) || servers < 1)
        return null;
    if (!finite(capacity))
        return null;
    const c = intIn(servers, 1, MAX_SERVERS);
    const k = intIn(capacity, 1, MAX_CAPACITY);
    if (k < c)
        return null;
    const a = lambda / mu;
    const terms: number[] = new Array(k + 1);
    terms[0] = 1;
    let sum = 1;
    for (let n = 1; n <= k; n++) {
        terms[n] = n <= c ? (terms[n - 1] * a) / n : (terms[n - 1] * a) / c;
        sum += terms[n];
    }
    if (!(sum > 0) || !Number.isFinite(sum))
        return null;
    const p0 = 1 / sum;
    const pBlock = Math.min(1, Math.max(0, terms[k] * p0));
    let lq = 0;
    let l = 0;
    for (let n = 0; n <= k; n++) {
        const pn = terms[n] * p0;
        l += n * pn;
        if (n > c)
            lq += (n - c) * pn;
    }
    const throughput = lambda * (1 - pBlock);
    if (!(throughput > 0))
        return null;
    let pWait = 0;
    for (let n = c; n <= k - 1; n++)
        pWait += terms[n] * p0;
    pWait = pBlock < 1 ? Math.min(1, pWait / (1 - pBlock)) : 0;
    const wq = lq / throughput;
    const w = l / throughput;
    const utilization = Math.min(1, throughput / (c * mu));
    return {
        servers: c,
        offeredLoad: a,
        utilization,
        pWait,
        pBlock,
        lq,
        l,
        wq,
        w,
        throughput,
    };
}
export function mmcLoss(lambda: number, mu: number, servers: number): QueueResult | null {
    if (!finite(servers))
        return null;
    return mmck(lambda, mu, servers, intIn(servers, 1, MAX_SERVERS));
}
function meetsTarget(r: QueueResult, t: ServiceTarget): boolean {
    if (finite(t.maxWq) && !(r.wq <= t.maxWq))
        return false;
    if (finite(t.maxBlock) && !(r.pBlock <= t.maxBlock))
        return false;
    if (finite(t.maxWait) && !(r.pWait <= t.maxWait))
        return false;
    if (finite(t.maxUtilization) && !(r.utilization <= t.maxUtilization))
        return false;
    return true;
}
export interface SizingResult {
    servers: number;
    result: QueueResult;
}
export function serversNeeded(lambda: number, mu: number, target: ServiceTarget, opts: {
    waitingRoom?: number;
} = {}): SizingResult | null {
    if (!finite(lambda) || lambda <= 0)
        return null;
    if (!finite(mu) || mu <= 0)
        return null;
    if (!target || typeof target !== "object")
        return null;
    const wr = finite(opts?.waitingRoom) ? intIn(opts.waitingRoom, 0, MAX_CAPACITY) : null;
    for (let c = 1; c <= MAX_SERVERS; c++) {
        const r = wr === null ? mmc(lambda, mu, c) : mmck(lambda, mu, c, c + wr);
        if (r === null)
            continue;
        if (meetsTarget(r, target))
            return { servers: c, result: r };
    }
    return null;
}
export interface SimulationResult {
    arrivals: number;
    served: number;
    blocked: number;
    pBlock: number;
    pWait: number;
    wq: number;
    w: number;
    utilization: number;
    elapsed: number;
}
function rng(seed: number): () => number {
    let s = (intIn(seed, 0, 2 ** 31) + 1831565813) >>> 0;
    return () => {
        s = (s + 1831565813) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function expRandom(next: () => number, rate: number): number {
    const u = 1 - next();
    return -Math.log(u) / rate;
}
export function simulateQueue(lambda: number, mu: number, servers: number, opts: {
    customers?: number;
    capacity?: number;
    seed?: number;
} = {}): SimulationResult | null {
    if (!finite(lambda) || lambda <= 0)
        return null;
    if (!finite(mu) || mu <= 0)
        return null;
    if (!finite(servers) || servers < 1)
        return null;
    const c = intIn(servers, 1, MAX_SERVERS);
    const n = intIn(opts?.customers ?? 10000, 1, 500000);
    const cap = finite(opts?.capacity) ? intIn(opts.capacity, c, MAX_CAPACITY) : Infinity;
    const next = rng(finite(opts?.seed) ? opts.seed : 1);
    let pending: number[] = [];
    let clock = 0;
    let served = 0;
    let blocked = 0;
    let waited = 0;
    let sumWq = 0;
    let sumW = 0;
    let busyTime = 0;
    for (let i = 0; i < n; i++) {
        clock += expRandom(next, lambda);
        let out = 0;
        while (out < pending.length && pending[out] <= clock)
            out++;
        if (out > 0)
            pending = pending.slice(out);
        const m = pending.length;
        if (m >= cap || m >= MAX_CAPACITY) {
            blocked++;
            continue;
        }
        const start = m < c ? clock : pending[m - c];
        const wq = start - clock;
        const service = expRandom(next, mu);
        const depart = start + service;
        let lo = 0;
        let hi = pending.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (pending[mid] < depart)
                lo = mid + 1;
            else
                hi = mid;
        }
        pending.splice(lo, 0, depart);
        served++;
        if (wq > 0)
            waited++;
        sumWq += wq;
        sumW += wq + service;
        busyTime += service;
    }
    const arrivals = served + blocked;
    const elapsed = clock;
    if (!(elapsed > 0) || arrivals === 0)
        return null;
    return {
        arrivals,
        served,
        blocked,
        pBlock: blocked / arrivals,
        pWait: served > 0 ? waited / served : 0,
        wq: served > 0 ? sumWq / served : 0,
        w: served > 0 ? sumW / served : 0,
        utilization: busyTime / (c * elapsed),
        elapsed,
    };
}
export function littleError(r: QueueResult | null): number | null {
    if (!r)
        return null;
    const { l, lq, utilization, servers } = r;
    if (!finite(l) || !finite(lq) || !finite(utilization) || !finite(servers))
        return null;
    const predicted = lq + utilization * servers;
    if (!(l > 0))
        return Math.abs(predicted) < 1e-12 ? 0 : null;
    return Math.abs(predicted - l) / l;
}
@Injectable({ providedIn: "root" })
export class QueueingService {
    erlangB = erlangB;
    erlangC = erlangC;
    mmc = mmc;
    mmck = mmck;
    mmcLoss = mmcLoss;
    serversNeeded = serversNeeded;
    simulate = simulateQueue;
    littleError = littleError;
}
