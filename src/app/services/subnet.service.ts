export interface SubnetResult {
    cidr: string;
    prefix: number;
    hostAddress: string;
    network: string;
    broadcast: string;
    firstHost: string;
    lastHost: string;
    mask: string;
    wildcardMask: string;
    totalHosts: number;
    usableHosts: number;
    ipClass: string;
    category: string;
    isPrivate: boolean;
    hostBits: number;
    ipBinary: string;
    maskBinary: string;
    networkBinary: string;
    ipHex: string;
    reverseDns: string;
}
interface SpecialRange {
    cidr: string;
    name: string;
    priv: boolean;
}
const SPECIAL_RANGES: SpecialRange[] = [
    { cidr: "0.0.0.0/8", name: "Red actual (RFC1122)", priv: false },
    { cidr: "10.0.0.0/8", name: "Privada (RFC1918)", priv: true },
    { cidr: "100.64.0.0/10", name: "CGNAT (RFC6598)", priv: true },
    { cidr: "127.0.0.0/8", name: "Loopback", priv: false },
    { cidr: "169.254.0.0/16", name: "Link-local / APIPA", priv: false },
    { cidr: "172.16.0.0/12", name: "Privada (RFC1918)", priv: true },
    { cidr: "192.0.0.0/24", name: "Asignaciones IETF", priv: false },
    { cidr: "192.0.2.0/24", name: "Documentaci\u00F3n (TEST-NET-1)", priv: false },
    { cidr: "192.88.99.0/24", name: "6to4 anycast (obsoleto)", priv: false },
    { cidr: "192.168.0.0/16", name: "Privada (RFC1918)", priv: true },
    { cidr: "198.18.0.0/15", name: "Benchmarking (RFC2544)", priv: false },
    { cidr: "198.51.100.0/24", name: "Documentaci\u00F3n (TEST-NET-2)", priv: false },
    { cidr: "203.0.113.0/24", name: "Documentaci\u00F3n (TEST-NET-3)", priv: false },
    { cidr: "224.0.0.0/4", name: "Multicast (clase D)", priv: false },
    { cidr: "240.0.0.0/4", name: "Reservada (clase E)", priv: false },
    { cidr: "255.255.255.255/32", name: "Broadcast limitado", priv: false },
];
export function ipToInt(ip: string): number | null {
    const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m)
        return null;
    const o = [+m[1], +m[2], +m[3], +m[4]];
    if (o.some(x => x > 255))
        return null;
    return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}
export function intToIp(n: number): string {
    return [24, 16, 8, 0].map(s => (n >>> s) & 255).join(".");
}
export function maskToPrefix(mask: number): number | null {
    const inv = (~mask >>> 0);
    if (((inv + 1) & inv) !== 0)
        return null;
    let bits = 0, m = mask >>> 0;
    while (m & 2147483648) {
        bits++;
        m = (m << 1) >>> 0;
    }
    return bits;
}
export function prefixToMask(prefix: number): number {
    return prefix === 0 ? 0 : (4294967295 << (32 - prefix)) >>> 0;
}
export function prefixForHosts(hosts: number): number | null {
    if (hosts < 1)
        return null;
    for (let p = 30; p >= 0; p--) {
        if (Math.pow(2, 32 - p) - 2 >= hosts)
            return p;
    }
    return null;
}
export function ipToBinary(n: number): string {
    return [24, 16, 8, 0].map(s => ((n >>> s) & 255).toString(2).padStart(8, "0")).join(".");
}
export function parseInput(input: string): {
    ipInt: number;
    prefix: number;
} | null {
    const s = input.trim().replace(/\s+/g, " ");
    const parts = s.split(/[ /]/).filter(Boolean);
    if (parts.length === 0 || parts.length > 2)
        return null;
    const ipInt = ipToInt(parts[0]);
    if (ipInt === null)
        return null;
    if (parts.length === 1) {
        return { ipInt, prefix: classfulPrefix(ipInt) };
    }
    const p = parts[1];
    if (/^\d{1,2}$/.test(p)) {
        const prefix = +p;
        return prefix <= 32 ? { ipInt, prefix } : null;
    }
    const maskInt = ipToInt(p);
    if (maskInt === null)
        return null;
    const prefix = maskToPrefix(maskInt);
    return prefix === null ? null : { ipInt, prefix };
}
function classfulPrefix(ipInt: number): number {
    const first = (ipInt >>> 24) & 255;
    if (first < 128)
        return 8;
    if (first < 192)
        return 16;
    return 24;
}
function ipClassOf(ipInt: number): string {
    const first = (ipInt >>> 24) & 255;
    if (first < 128)
        return "A";
    if (first < 192)
        return "B";
    if (first < 224)
        return "C";
    if (first < 240)
        return "D (multicast)";
    return "E (reservada)";
}
function classify(ipInt: number): {
    category: string;
    isPrivate: boolean;
} {
    for (const r of SPECIAL_RANGES) {
        const [ip, pfx] = r.cidr.split("/");
        const base = ipToInt(ip)!;
        const mask = prefixToMask(+pfx);
        if (((ipInt & mask) >>> 0) === ((base & mask) >>> 0)) {
            return { category: r.name, isPrivate: r.priv };
        }
    }
    return { category: "P\u00FAblica", isPrivate: false };
}
export interface VlsmReq {
    name: string;
    hosts: number;
}
export interface VlsmAlloc {
    name: string;
    hostsReq: number;
    cidr: string;
    prefix: number;
    network: string;
    mask: string;
    firstHost: string;
    lastHost: string;
    broadcast: string;
    usableHosts: number;
    totalHosts: number;
}
export interface VlsmResult {
    base: string;
    allocations: VlsmAlloc[];
    totalAddresses: number;
    usedAddresses: number;
    freeAddresses: number;
    error?: string;
}
export function vlsm(baseCidr: string, reqs: VlsmReq[]): VlsmResult | null {
    const parsed = parseInput(baseCidr);
    if (!parsed)
        return null;
    const basePrefix = parsed.prefix;
    const baseMask = prefixToMask(basePrefix);
    const baseNet = (parsed.ipInt & baseMask) >>> 0;
    const totalAddresses = Math.pow(2, 32 - basePrefix);
    const baseEnd = baseNet + totalAddresses;
    const valid = reqs.filter(r => r.hosts >= 1);
    const sorted = [...valid].sort((a, b) => b.hosts - a.hosts);
    const allocations: VlsmAlloc[] = [];
    let cursor = baseNet;
    let error: string | undefined;
    for (const req of sorted) {
        const prefix = prefixForHosts(req.hosts)!;
        const size = Math.pow(2, 32 - prefix);
        const start = Math.ceil(cursor / size) * size;
        if (start + size > baseEnd) {
            error = "no-fit";
            break;
        }
        const network = start >>> 0;
        const mask = prefixToMask(prefix);
        const bcast = (network | (~mask >>> 0)) >>> 0;
        allocations.push({
            name: req.name || "",
            hostsReq: req.hosts,
            cidr: `${intToIp(network)}/${prefix}`,
            prefix,
            network: intToIp(network),
            mask: intToIp(mask),
            firstHost: intToIp(network + 1),
            lastHost: intToIp(bcast - 1),
            broadcast: intToIp(bcast),
            usableHosts: size - 2,
            totalHosts: size,
        });
        cursor = start + size;
    }
    const usedAddresses = allocations.reduce((a, x) => a + x.totalHosts, 0);
    return {
        base: `${intToIp(baseNet)}/${basePrefix}`,
        allocations,
        totalAddresses,
        usedAddresses,
        freeAddresses: totalAddresses - usedAddresses,
        error,
    };
}
export interface IpRange {
    start: number;
    end: number;
    startIp: string;
    endIp: string;
    count: number;
}
export function cidrToRange(cidr: string): IpRange | null {
    const parsed = parseInput(cidr);
    if (!parsed)
        return null;
    const mask = prefixToMask(parsed.prefix);
    const net = (parsed.ipInt & mask) >>> 0;
    const size = Math.pow(2, 32 - parsed.prefix);
    const end = net + size - 1;
    return { start: net, end, startIp: intToIp(net), endIp: intToIp(end), count: size };
}
function alignmentOf(s: number): number {
    if (s === 0)
        return 4294967296;
    let p = 1;
    while (s % (p * 2) === 0)
        p *= 2;
    return p;
}
export function rangeToCidrs(start: number, end: number): string[] {
    if (start > end)
        return [];
    const out: string[] = [];
    let s = start;
    while (s <= end) {
        let size = alignmentOf(s);
        const remaining = end - s + 1;
        while (size > remaining)
            size /= 2;
        out.push(`${intToIp(s)}/${32 - Math.log2(size)}`);
        s += size;
    }
    return out;
}
export interface AggregateResult {
    cidrs: string[];
    invalid: string[];
    mergedRanges: number;
}
export function aggregate(inputs: string[]): AggregateResult {
    const ranges: {
        start: number;
        end: number;
    }[] = [];
    const invalid: string[] = [];
    for (const raw of inputs) {
        const t = raw.trim();
        if (!t)
            continue;
        const r = cidrToRange(t);
        if (!r) {
            invalid.push(t);
            continue;
        }
        ranges.push({ start: r.start, end: r.end });
    }
    ranges.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: {
        start: number;
        end: number;
    }[] = [];
    for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (last && r.start <= last.end + 1) {
            last.end = Math.max(last.end, r.end);
        }
        else {
            merged.push({ ...r });
        }
    }
    const cidrs: string[] = [];
    for (const m of merged)
        cidrs.push(...rangeToCidrs(m.start, m.end));
    return { cidrs, invalid, mergedRanges: merged.length };
}
export interface SimpleSubnet {
    cidr: string;
    network: string;
    broadcast: string;
    firstHost: string;
    lastHost: string;
    usableHosts: number;
}
export interface SplitResult {
    total: number;
    truncated: boolean;
    subnets: SimpleSubnet[];
}
const SPLIT_CAP = 4096;
export function splitNetwork(cidr: string, newPrefix: number): SplitResult | null {
    const parsed = parseInput(cidr);
    if (!parsed || newPrefix < parsed.prefix || newPrefix > 32)
        return null;
    const baseMask = prefixToMask(parsed.prefix);
    const net = (parsed.ipInt & baseMask) >>> 0;
    const total = Math.pow(2, newPrefix - parsed.prefix);
    const size = Math.pow(2, 32 - newPrefix);
    const n = Math.min(total, SPLIT_CAP);
    const subnets: SimpleSubnet[] = [];
    for (let i = 0; i < n; i++) {
        const s = net + i * size;
        const b = s + size - 1;
        subnets.push({
            cidr: `${intToIp(s)}/${newPrefix}`,
            network: intToIp(s),
            broadcast: intToIp(b),
            firstHost: intToIp(newPrefix >= 31 ? s : s + 1),
            lastHost: intToIp(newPrefix >= 31 ? b : b - 1),
            usableHosts: newPrefix >= 31 ? size : Math.max(0, size - 2),
        });
    }
    return { total, truncated: total > SPLIT_CAP, subnets };
}
export function contains(cidr: string, ip: string): boolean | null {
    const parsed = parseInput(cidr);
    const ipInt = ipToInt(ip);
    if (!parsed || ipInt === null)
        return null;
    const mask = prefixToMask(parsed.prefix);
    return ((ipInt & mask) >>> 0) === ((parsed.ipInt & mask) >>> 0);
}
export type Relationship = "equal" | "a-contains-b" | "b-contains-a" | "overlap" | "disjoint";
export function relationship(a: string, b: string): Relationship | null {
    const ra = cidrToRange(a), rb = cidrToRange(b);
    if (!ra || !rb)
        return null;
    if (ra.start === rb.start && ra.end === rb.end)
        return "equal";
    if (ra.start <= rb.start && ra.end >= rb.end)
        return "a-contains-b";
    if (rb.start <= ra.start && rb.end >= ra.end)
        return "b-contains-a";
    if (ra.start <= rb.end && rb.start <= ra.end)
        return "overlap";
    return "disjoint";
}
const V6_MAX = (1n << 128n) - 1n;
export function parseIpv6(str: string): bigint | null {
    let s = str.trim().toLowerCase();
    if (s === "")
        return null;
    const v4 = s.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (v4) {
        const n = ipToInt(v4[1]);
        if (n === null)
            return null;
        s = s.slice(0, v4.index) + ":" + ((n >>> 16) & 65535).toString(16) + ":" + (n & 65535).toString(16);
    }
    const dc = s.split("::");
    if (dc.length > 2)
        return null;
    const parse = (part: string) => (part === "" ? [] : part.split(":"));
    let groups: string[];
    if (dc.length === 2) {
        const head = parse(dc[0]), tail = parse(dc[1]);
        const missing = 8 - head.length - tail.length;
        if (missing < 1)
            return null;
        groups = [...head, ...Array(missing).fill("0"), ...tail];
    }
    else {
        groups = parse(s);
    }
    if (groups.length !== 8)
        return null;
    let n = 0n;
    for (const g of groups) {
        if (!/^[0-9a-f]{1,4}$/.test(g))
            return null;
        n = (n << 16n) | BigInt(parseInt(g, 16));
    }
    return n;
}
function v6groups(n: bigint): string[] {
    const g: string[] = [];
    for (let i = 0; i < 8; i++)
        g.push(Number((n >> BigInt((7 - i) * 16)) & 0xffffn).toString(16));
    return g;
}
export function expandIpv6(n: bigint): string {
    return v6groups(n).map(g => g.padStart(4, "0")).join(":");
}
export function compressIpv6(n: bigint): string {
    const g = v6groups(n);
    let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
    for (let i = 0; i < 8; i++) {
        if (g[i] === "0") {
            if (curStart < 0)
                curStart = i;
            curLen++;
            if (curLen > bestLen) {
                bestLen = curLen;
                bestStart = curStart;
            }
        }
        else {
            curStart = -1;
            curLen = 0;
        }
    }
    if (bestLen >= 2) {
        const before = g.slice(0, bestStart).join(":");
        const after = g.slice(bestStart + bestLen).join(":");
        return `${before}::${after}`;
    }
    return g.join(":");
}
function ipv6Type(n: bigint): string {
    if (n === 0n)
        return "No especificada (::)";
    if (n === 1n)
        return "Loopback (::1)";
    if ((n >> 120n) === 0xffn)
        return "Multicast (ff00::/8)";
    if ((n >> 118n) === 0x3fan)
        return "Link-local (fe80::/10)";
    if ((n >> 121n) === 0x7en)
        return "Unique local / ULA (fc00::/7)";
    if ((n >> 125n) === 0x1n)
        return "Global unicast (2000::/3)";
    return "Reservada / otra";
}
export interface Ipv6Result {
    compressed: string;
    expanded: string;
    prefix: number;
    network: string;
    firstAddress: string;
    lastAddress: string;
    addressCount: string;
    addressPow: number;
    subnets64: string;
    type: string;
}
export function ipv6Info(cidr: string): Ipv6Result | null {
    const m = cidr.trim().match(/^([^/]+?)(?:\/(\d{1,3}))?$/);
    if (!m)
        return null;
    const addr = parseIpv6(m[1]);
    if (addr === null)
        return null;
    const prefix = m[2] === undefined ? 64 : +m[2];
    if (prefix > 128)
        return null;
    const hostBits = BigInt(128 - prefix);
    const mask = prefix === 0 ? 0n : (V6_MAX ^ ((1n << hostBits) - 1n));
    const network = addr & mask;
    const last = network | ((1n << hostBits) - 1n);
    return {
        compressed: compressIpv6(addr),
        expanded: expandIpv6(addr),
        prefix,
        network: `${compressIpv6(network)}/${prefix}`,
        firstAddress: compressIpv6(network),
        lastAddress: compressIpv6(last),
        addressCount: (1n << hostBits).toString(),
        addressPow: 128 - prefix,
        subnets64: prefix <= 64 ? (1n << BigInt(64 - prefix)).toString() : "\u2014",
        type: ipv6Type(network),
    };
}
export function eui64(mac: string): string | null {
    const hex = mac.trim().toLowerCase().replace(/[.:-]/g, "");
    if (!/^[0-9a-f]{12}$/.test(hex))
        return null;
    const b = hex.match(/.{2}/g)!.map(h => parseInt(h, 16));
    b[0] ^= 2;
    const iid = [b[0], b[1], b[2], 255, 254, b[3], b[4], b[5]];
    const groups = [0, 2, 4, 6].map(i => ((iid[i] << 8) | iid[i + 1]).toString(16));
    return `::${groups.join(":")}`;
}
export interface TreeNode {
    net: number;
    prefix: number;
    children?: [
        TreeNode,
        TreeNode
    ];
}
export interface TreeLeaf {
    cidr: string;
    net: number;
    prefix: number;
    hosts: number;
    widthPct: number;
    depth: number;
    canSplit: boolean;
    canMerge: boolean;
    parentNet: number;
    parentPrefix: number;
}
export function buildTree(baseCidr: string): TreeNode | null {
    const parsed = parseInput(baseCidr);
    if (!parsed)
        return null;
    return { net: (parsed.ipInt & prefixToMask(parsed.prefix)) >>> 0, prefix: parsed.prefix };
}
function transformTree(node: TreeNode, tn: number, tp: number, op: "split" | "merge"): TreeNode {
    if (node.net === tn && node.prefix === tp) {
        if (op === "split" && node.prefix < 32 && !node.children) {
            const half = Math.pow(2, 32 - node.prefix - 1);
            return { net: node.net, prefix: node.prefix, children: [{ net: node.net, prefix: node.prefix + 1 }, { net: node.net + half, prefix: node.prefix + 1 }] };
        }
        if (op === "merge")
            return { net: node.net, prefix: node.prefix };
        return node;
    }
    if (node.children) {
        return { net: node.net, prefix: node.prefix, children: [transformTree(node.children[0], tn, tp, op), transformTree(node.children[1], tn, tp, op)] };
    }
    return node;
}
export function splitTree(root: TreeNode, net: number, prefix: number): TreeNode {
    return transformTree(root, net, prefix, "split");
}
export function mergeTree(root: TreeNode, net: number, prefix: number): TreeNode {
    return transformTree(root, net, prefix, "merge");
}
export function treeLeaves(root: TreeNode): TreeLeaf[] {
    const baseSize = Math.pow(2, 32 - root.prefix);
    const out: TreeLeaf[] = [];
    const walk = (node: TreeNode, parent: TreeNode | null) => {
        if (!node.children) {
            const size = Math.pow(2, 32 - node.prefix);
            out.push({
                cidr: `${intToIp(node.net)}/${node.prefix}`,
                net: node.net,
                prefix: node.prefix,
                hosts: node.prefix >= 31 ? size : Math.max(0, size - 2),
                widthPct: (size / baseSize) * 100,
                depth: node.prefix - root.prefix,
                canSplit: node.prefix < 32,
                canMerge: !!parent && !parent.children![0].children && !parent.children![1].children
                    && node === parent.children![0],
                parentNet: parent?.net ?? 0,
                parentPrefix: parent?.prefix ?? 0,
            });
        }
        else {
            walk(node.children[0], node);
            walk(node.children[1], node);
        }
    };
    walk(root, null);
    return out;
}
export class SubnetService {
    calculate(input: string): SubnetResult | null {
        const parsed = parseInput(input);
        if (!parsed)
            return null;
        return this.describe(parsed.ipInt, parsed.prefix);
    }
    vlsm(baseCidr: string, reqs: VlsmReq[]): VlsmResult | null {
        return vlsm(baseCidr, reqs);
    }
    split(cidr: string, newPrefix: number): SplitResult | null { return splitNetwork(cidr, newPrefix); }
    aggregate(inputs: string[]): AggregateResult { return aggregate(inputs); }
    contains(cidr: string, ip: string): boolean | null { return contains(cidr, ip); }
    relationship(a: string, b: string): Relationship | null { return relationship(a, b); }
    cidrToRange(cidr: string): IpRange | null { return cidrToRange(cidr); }
    rangeToCidrs(startIp: string, endIp: string): string[] | null {
        const s = ipToInt(startIp), e = ipToInt(endIp);
        if (s === null || e === null || s > e)
            return null;
        return rangeToCidrs(s, e);
    }
    ipv6(cidr: string): Ipv6Result | null { return ipv6Info(cidr); }
    eui64(mac: string): string | null { return eui64(mac); }
    private describe(ipInt: number, prefix: number): SubnetResult {
        const mask = prefixToMask(prefix);
        const network = (ipInt & mask) >>> 0;
        const bcast = (network | (~mask >>> 0)) >>> 0;
        const total = Math.pow(2, 32 - prefix);
        const usable = prefix >= 31 ? total : Math.max(0, total - 2);
        const { category, isPrivate } = classify(ipInt);
        const netOcts = [24, 16, 8].map(s => (network >>> s) & 255);
        return {
            cidr: `${intToIp(network)}/${prefix}`,
            prefix,
            hostAddress: intToIp(ipInt),
            network: intToIp(network),
            broadcast: intToIp(bcast),
            firstHost: intToIp(prefix >= 31 ? network : network + 1),
            lastHost: intToIp(prefix >= 31 ? bcast : bcast - 1),
            mask: intToIp(mask),
            wildcardMask: intToIp(~mask >>> 0),
            totalHosts: total,
            usableHosts: usable,
            ipClass: ipClassOf(ipInt),
            category,
            isPrivate,
            hostBits: 32 - prefix,
            ipBinary: ipToBinary(ipInt),
            maskBinary: ipToBinary(mask),
            networkBinary: ipToBinary(network),
            ipHex: "0x" + (ipInt >>> 0).toString(16).toUpperCase().padStart(8, "0"),
            reverseDns: `${netOcts[2]}.${netOcts[1]}.${netOcts[0]}.in-addr.arpa`,
        };
    }
}
