export type ShapeKind = "rect" | "round" | "ellipse" | "diamond" | "parallelogram" | "cylinder" | "hexagon" | "note" | "text" | "container" | "triangle" | "star" | "cloud" | "document" | "card" | "callout" | "actor" | "cross" | "process" | "icon" | "image" | "chart" | "line" | "ink";
export const ICON_NAMES = [
    "person",
    "person_add",
    "group",
    "groups",
    "diversity_3",
    "support_agent",
    "face",
    "sentiment_satisfied",
    "handshake",
    "psychology",
    "school",
    "work",
    "badge",
    "engineering",
    "manage_accounts",
    "admin_panel_settings",
    "computer",
    "laptop",
    "desktop_windows",
    "smartphone",
    "tablet",
    "watch",
    "tv",
    "keyboard",
    "mouse",
    "headphones",
    "speaker",
    "print",
    "scanner",
    "camera_alt",
    "photo_camera",
    "videocam",
    "mic",
    "sensors",
    "dns",
    "storage",
    "memory",
    "developer_board",
    "router",
    "lan",
    "hub",
    "device_hub",
    "cast",
    "usb",
    "cloud",
    "cloud_queue",
    "cloud_upload",
    "cloud_download",
    "cloud_sync",
    "cloud_done",
    "wifi",
    "signal_cellular_alt",
    "database",
    "table_chart",
    "schema",
    "account_tree",
    "share",
    "sync",
    "backup",
    "data_object",
    "lock",
    "lock_open",
    "key",
    "shield",
    "security",
    "vpn_key",
    "verified_user",
    "fingerprint",
    "password",
    "gpp_good",
    "gpp_bad",
    "visibility",
    "visibility_off",
    "https",
    "no_encryption",
    "policy",
    "vpn_lock",
    "code",
    "terminal",
    "bug_report",
    "api",
    "settings",
    "build",
    "construction",
    "handyman",
    "integration_instructions",
    "webhook",
    "deployed_code",
    "commit",
    "merge",
    "fork_right",
    "developer_mode",
    "html",
    "css",
    "javascript",
    "mail",
    "outgoing_mail",
    "mark_email_read",
    "call",
    "chat",
    "chat_bubble",
    "forum",
    "sms",
    "notifications",
    "campaign",
    "contact_mail",
    "contacts",
    "rss_feed",
    "podcasts",
    "question_answer",
    "send",
    "attach_email",
    "search",
    "star",
    "star_border",
    "favorite",
    "favorite_border",
    "flag",
    "bookmark",
    "thumb_up",
    "thumb_down",
    "check",
    "check_circle",
    "cancel",
    "close",
    "add",
    "remove",
    "edit",
    "delete",
    "done_all",
    "pending",
    "warning",
    "error",
    "info",
    "help",
    "report",
    "priority_high",
    "new_releases",
    "verified",
    "task_alt",
    "schedule",
    "event",
    "calendar_month",
    "timer",
    "history",
    "update",
    "alarm",
    "hourglass_empty",
    "location_on",
    "place",
    "map",
    "public",
    "my_location",
    "explore",
    "near_me",
    "travel_explore",
    "flag_circle",
    "payment",
    "credit_card",
    "shopping_cart",
    "shopping_bag",
    "store",
    "storefront",
    "account_balance",
    "account_balance_wallet",
    "savings",
    "paid",
    "receipt_long",
    "sell",
    "local_offer",
    "redeem",
    "euro",
    "attach_money",
    "analytics",
    "trending_up",
    "trending_down",
    "dashboard",
    "bar_chart",
    "pie_chart",
    "show_chart",
    "insights",
    "query_stats",
    "leaderboard",
    "monitoring",
    "stacked_line_chart",
    "data_usage",
    "speed",
    "timeline",
    "grade",
    "description",
    "article",
    "folder",
    "folder_open",
    "save",
    "download",
    "upload_file",
    "attach_file",
    "link",
    "content_copy",
    "content_paste",
    "note",
    "sticky_note_2",
    "inventory_2",
    "assignment",
    "fact_check",
    "summarize",
    "image",
    "photo",
    "palette",
    "brush",
    "draw",
    "format_paint",
    "color_lens",
    "auto_awesome",
    "movie",
    "music_note",
    "play_circle",
    "pause_circle",
    "stop_circle",
    "volume_up",
    "graphic_eq",
    "gesture",
    "style",
    "wallpaper",
    "arrow_forward",
    "arrow_back",
    "arrow_upward",
    "arrow_downward",
    "north_east",
    "south_east",
    "sync_alt",
    "swap_horiz",
    "open_in_new",
    "launch",
    "menu",
    "more_horiz",
    "expand_more",
    "unfold_more",
    "compare_arrows",
    "home",
    "apartment",
    "bolt",
    "power",
    "battery_full",
    "solar_power",
    "lightbulb",
    "settings_remote",
    "thermostat",
    "water_drop",
    "ac_unit",
    "wb_sunny",
    "nightlight",
    "eco",
    "recycling",
    "electrical_services",
    "local_shipping",
    "flight",
    "directions_car",
    "train",
    "directions_bus",
    "two_wheeler",
    "rocket_launch",
    "local_gas_station",
    "anchor",
    "sailing",
    "pedal_bike",
    "delivery_dining",
    "inventory",
    "warehouse",
    "health_and_safety",
    "medical_services",
    "science",
    "biotech",
    "vaccines",
    "monitor_heart",
    "medication",
    "emergency",
    "healing",
    "coronavirus",
    "tips_and_updates",
    "emoji_objects",
    "rocket",
    "extension",
    "widgets",
    "category",
    "label",
    "layers",
    "grid_view",
    "view_module",
    "tune",
    "toggle_on",
    "diamond",
    "workspace_premium",
    "stars",
];
export const ICON_CATEGORIES: {
    id: string;
    icons: string[];
}[] = [
    { id: "ciencia", icons: ["science", "biotech", "genetics", "microbiology", "vaccines", "coronavirus", "medical_services", "medication", "ecg_heart", "monitor_heart", "bloodtype", "experiment", "thermostat", "scale", "calculate", "functions", "psychology", "neurology", "eco", "water_drop", "bubble_chart", "scatter_plot", "timeline", "air", "public", "bolt", "battery_charging_full", "memory"] },
    { id: "tecnico", icons: ["dns", "router", "lan", "hub", "database", "storage", "developer_board", "cloud", "cloud_upload", "cloud_download", "security", "lock", "key", "terminal", "code", "api", "webhook", "cable", "device_hub", "computer", "wifi", "cell_tower", "sync", "cached", "layers", "account_tree", "schema", "table_chart", "folder", "settings", "bug_report", "smartphone"] },
    { id: "juegos", icons: ["casino", "sports_esports", "videogame_asset", "extension", "emoji_events", "military_tech", "toys", "smart_toy", "flag", "timer", "favorite", "star", "bolt", "local_fire_department", "shield", "stadia_controller", "joystick", "target"] },
    { id: "negocio", icons: ["work", "business", "badge", "groups", "person", "savings", "payments", "credit_card", "receipt_long", "account_balance", "trending_up", "trending_down", "analytics", "insights", "monitoring", "campaign", "handshake", "gavel", "storefront", "shopping_cart", "inventory_2", "local_shipping", "factory", "apartment", "mail", "call", "event", "schedule", "task_alt", "checklist"] },
    { id: "flechas", icons: ["arrow_forward", "arrow_back", "arrow_upward", "arrow_downward", "north_east", "south_east", "south_west", "north_west", "sync_alt", "swap_horiz", "swap_vert", "subdirectory_arrow_right", "call_split", "call_merge", "alt_route", "trending_flat", "double_arrow", "chevron_right", "expand_more", "refresh", "undo", "redo", "add", "remove", "close", "check", "priority_high", "help", "info", "warning", "error", "done_all", "loop", "autorenew"] },
];
export interface ShapeDef {
    kind: ShapeKind;
    label: string;
    icon: string;
    w: number;
    h: number;
}
export const SHAPE_SIZES: Record<ShapeKind, {
    w: number;
    h: number;
}> = {
    rect: { w: 120, h: 60 },
    round: { w: 120, h: 60 },
    ellipse: { w: 120, h: 70 },
    diamond: { w: 120, h: 80 },
    parallelogram: { w: 130, h: 60 },
    cylinder: { w: 100, h: 80 },
    hexagon: { w: 130, h: 70 },
    note: { w: 120, h: 80 },
    text: { w: 120, h: 40 },
    container: { w: 260, h: 200 },
    triangle: { w: 110, h: 90 },
    star: { w: 100, h: 100 },
    cloud: { w: 140, h: 90 },
    document: { w: 130, h: 80 },
    card: { w: 130, h: 70 },
    callout: { w: 140, h: 80 },
    actor: { w: 70, h: 110 },
    cross: { w: 90, h: 90 },
    process: { w: 140, h: 60 },
    icon: { w: 90, h: 90 },
    image: { w: 160, h: 120 },
    chart: { w: 260, h: 180 },
    line: { w: 160, h: 8 },
    ink: { w: 160, h: 60 },
};
export type SkinId = "flat" | "soft" | "glass" | "neon" | "shadow" | "ornate" | "sketch";
export type BorderStyle = "solid" | "dashed" | "dashfine" | "dashlong" | "dotted" | "dashdot" | "dashdotdot" | "double" | "frame" | "none";
export const BORDER_STYLES: BorderStyle[] = ["solid", "dashed", "dashfine", "dashlong", "dotted", "dashdot", "dashdotdot", "double", "frame", "none"];
export const LINE_DASHES: Record<string, number[]> = {
    solid: [],
    dashed: [9, 6],
    dashfine: [4, 4],
    dashlong: [16, 6],
    dotted: [1.5, 5],
    dashdot: [10, 4, 1.5, 4],
    dashdotdot: [10, 4, 1.5, 4, 1.5, 4],
};
export function parseDashPattern(s?: string): number[] | null {
    if (!s)
        return null;
    const n = s.trim().split(/[\s,]+/).map(Number).filter(x => x > 0 && isFinite(x));
    return n.length ? n : null;
}
export function dashArrayFor(style: string | undefined, customPattern?: string): number[] {
    return parseDashPattern(customPattern) ?? LINE_DASHES[style ?? "solid"] ?? [];
}
export const BORDER_WIDTHS = [1, 2, 3, 4, 6];
export interface PathPt {
    x: number;
    y: number;
    r?: number;
    bulge?: number;
    curve?: number;
}
export interface ArrowShapeDef {
    key: string;
    label: string;
    icon: string;
    w: number;
    h: number;
    path: PathPt[];
}
const pp = (pts: [
    number,
    number
][]): PathPt[] => pts.map(([x, y]) => ({ x, y }));
export const ARROW_SHAPES: ArrowShapeDef[] = [
    { key: "arrow_r", label: "Flecha bloque", icon: "east", w: 150, h: 80, path: pp([[-75, -18], [25, -18], [25, -40], [75, 0], [25, 40], [25, 18], [-75, 18]]) },
    { key: "arrow_2", label: "Flecha doble", icon: "sync_alt", w: 170, h: 80, path: pp([[-85, 0], [-40, -40], [-40, -18], [40, -18], [40, -40], [85, 0], [40, 40], [40, 18], [-40, 18], [-40, 40]]) },
    { key: "arrow_fork", label: "Flecha b\u00EDfida", icon: "double_arrow", w: 190, h: 110, path: pp([[-95, -55], [-52, -18], [30, -18], [30, -48], [95, 0], [30, 48], [30, 18], [-52, 18], [-95, 55], [-62, 0]]) },
    { key: "chevron", label: "Chevr\u00F3n", icon: "chevron_right", w: 130, h: 80, path: pp([[-65, -40], [25, -40], [65, 0], [25, 40], [-65, 40], [-25, 0]]) },
    { key: "arrow_bend", label: "Flecha en L", icon: "turn_right", w: 120, h: 120, path: pp([[-45, 60], [-45, -45], [20, -45], [20, -60], [60, -30], [20, 0], [20, -15], [-15, -15], [-15, 60]]) },
    { key: "banner", label: "Banderola", icon: "flag", w: 180, h: 64, path: pp([[-90, -32], [90, -32], [90, 32], [-90, 32], [-62, 0]]) },
];
export interface ShapeParams {
    slant?: number;
    depth?: number;
    radii?: number[];
    apex?: number;
    points?: number;
    inner?: number;
    tailX?: number;
    tailH?: number;
    fold?: number;
    wave?: number;
    cut?: number;
    bar?: number;
    arm?: number;
    arrow?: {
        key: string;
        head?: number;
        shaft?: number;
    };
}
export const SHAPE_PARAM_KEYS = ["slant", "depth", "radii", "apex", "points", "inner", "tailX", "tailH", "fold", "wave", "cut", "bar", "arm"] as const;
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function hexagonPts(w: number, h: number, cut?: number): number[] {
    const hw = w / 2, hh = h / 2, s = clampN(cut ?? Math.min(24, w * 0.2), 0, hw * 0.95);
    return [-hw + s, -hh, hw - s, -hh, hw, 0, hw - s, hh, -hw + s, hh, -hw, 0];
}
export function cardCut(w: number, h: number, cut?: number): number { return clampN(cut ?? Math.min(18, w * 0.3, h * 0.6), 0, Math.min(w, h) * 0.9); }
export function cardPts(w: number, h: number, cut?: number): number[] {
    const hw = w / 2, hh = h / 2, c = cardCut(w, h, cut);
    return [-hw + c, -hh, hw, -hh, hw, hh, -hw, hh, -hw, -hh + c];
}
export function processBar(w: number, bar?: number): number { return clampN(bar ?? Math.min(14, w * 0.12), 2, w * 0.45); }
export function crossArm(w: number, h: number, arm?: number): number { return Math.min(w, h) / 2 * clampN(arm ?? 0.42, 0.1, 1); }
export function crossPts(w: number, h: number, arm?: number): number[] {
    const hw = w / 2, hh = h / 2, a = crossArm(w, h, arm);
    return [-a, -hh, a, -hh, a, -a, hw, -a, hw, a, a, a, a, hh, -a, hh, -a, a, -hw, a, -hw, -a, -a, -a];
}
export function containerTitle(n: {
    text?: string;
    titleSide?: string;
}, w: number, h: number) {
    const along = ((n.titleSide ?? "top") === "top" ? w : h) - 16;
    return { text: n.text || "Carril", fontSize: 13, fontStyle: "bold", fontFamily: "Roboto, sans-serif", fill: "#fff", listening: false, wrap: "word" as const, align: "left" as const, verticalAlign: "middle" as const, width: along };
}
export type MedidorTitulo = (t: ReturnType<typeof containerTitle>) => number;
let medirTitulo: MedidorTitulo = (t) => {
    const charW = t.fontSize * 0.58, lineH = t.fontSize * 1;
    let lines = 1, x = 0;
    for (const word of t.text.split(/\s+/)) {
        const ww = word.length * charW, sp = x ? charW * 0.5 : 0;
        if (x && x + sp + ww > t.width) {
            lines++;
            x = ww;
        }
        else
            x += sp + ww;
    }
    return lines * lineH;
};
export function setMedidorTitulo(m: MedidorTitulo): void { medirTitulo = m; }
export function containerBar(n: {
    text?: string;
    titleSide?: string;
    titleH?: number;
}, w: number, h: number): number {
    const measured = n.titleH == null ? Math.ceil(medirTitulo(containerTitle(n, w, h))) + 6 : n.titleH;
    return Math.max(26, Math.min(measured, ((n.titleSide ?? "top") === "top" ? h : w) - 8));
}
export function trianglePts(w: number, h: number, apex?: number): number[] {
    const hw = w / 2, hh = h / 2, ax = clampN(apex ?? 0, -0.5, 0.5) * w;
    return [ax, -hh, hw, hh, -hw, hh];
}
export function starPts(w: number, h: number, points?: number, inner?: number): number[] {
    const n = Math.round(clampN(points ?? 5, 3, 12)), outer = Math.min(w, h) / 2, ir = outer * clampN(inner ?? 0.42, 0.1, 0.95), out: number[] = [];
    for (let i = 0; i < 2 * n; i++) {
        const r = i % 2 ? ir : outer, a = -Math.PI / 2 + i * Math.PI / n;
        out.push(r * Math.cos(a), r * Math.sin(a));
    }
    return out;
}
export function calloutGeom(w: number, h: number, tailX?: number, tailH?: number): {
    pts: number[];
    tipX: number;
    bodyY: number;
    tail: number;
} {
    const hw = w / 2, hh = h / 2, tail = clampN(tailH ?? Math.min(16, h * 0.3), 4, h * 0.6), bodyY = hh - tail;
    const tipX = clampN(tailX != null ? tailX * w : -hw + tail, -hw + 2, hw - 2);
    const bw = Math.min(tail * 0.8, w * 0.3), bL = clampN(tipX + tail * 0.2, -hw + 2, hw - 2 - bw), bR = bL + bw;
    return { pts: [-hw, -hh, hw, -hh, hw, bodyY, bR, bodyY, tipX, hh, bL, bodyY, -hw, bodyY], tipX, bodyY, tail };
}
export function noteFold(w: number, h: number, fold?: number): number { return clampN(fold ?? 18, 4, Math.min(w, h) * 0.6); }
export function notePts(w: number, h: number, fold?: number): number[] { const hw = w / 2, hh = h / 2, f = noteFold(w, h, fold); return [-hw, -hh, hw - f, -hh, hw, -hh + f, hw, hh, -hw, hh]; }
export function documentWave(h: number, wave?: number): number { return clampN(wave ?? 0.16, 0, 0.3) * h; }
export function documentPath(w: number, h: number, wave?: number, cx = 0, cy = 0): string {
    const hw = w / 2, hh = h / 2, wv = documentWave(h, wave), f = (v: number) => +v.toFixed(2);
    return `M ${f(cx - hw)} ${f(cy - hh)} L ${f(cx + hw)} ${f(cy - hh)} L ${f(cx + hw)} ${f(cy + hh - wv)} Q ${f(cx + hw / 2)} ${f(cy + hh + wv)} ${f(cx)} ${f(cy + hh - wv)} Q ${f(cx - hw / 2)} ${f(cy + hh - wv * 3)} ${f(cx - hw)} ${f(cy + hh - wv)} Z`;
}
export const ARROW_DEFAULTS: Record<string, {
    head: number;
    shaft?: number;
}> = {
    arrow_r: { head: 50 / 150, shaft: 36 / 80 },
    arrow_2: { head: 45 / 170, shaft: 36 / 80 },
    arrow_fork: { head: 65 / 190, shaft: 36 / 110 },
    chevron: { head: 40 / 130 },
    banner: { head: 28 / 180 },
};
export function arrowPath(key: string, w: number, h: number, head?: number, shaft?: number): PathPt[] | null {
    const d = ARROW_DEFAULTS[key];
    if (!d)
        return null;
    const hw = w / 2, hh = h / 2;
    const L = clampN(head ?? d.head, 0.05, key === "arrow_2" ? 0.45 : 0.9) * w, t = clampN(shaft ?? d.shaft ?? 0.45, 0.06, 0.95) * h / 2;
    const P = (a: [
        number,
        number
    ][]) => a.map(([x, y]) => ({ x, y }));
    switch (key) {
        case "arrow_r": return P([[-hw, -t], [hw - L, -t], [hw - L, -hh], [hw, 0], [hw - L, hh], [hw - L, t], [-hw, t]]);
        case "arrow_2": return P([[-hw, 0], [-hw + L, -hh], [-hw + L, -t], [hw - L, -t], [hw - L, -hh], [hw, 0], [hw - L, hh], [hw - L, t], [-hw + L, t], [-hw + L, hh]]);
        case "arrow_fork": {
            const hy = hh * 48 / 55, j = w * 43 / 190, nt = w * 33 / 190, tt = Math.min(t, hy * 0.95);
            return P([[-hw, -hh], [-hw + j, -tt], [hw - L, -tt], [hw - L, -hy], [hw, 0], [hw - L, hy], [hw - L, tt], [-hw + j, tt], [-hw, hh], [-hw + nt, 0]]);
        }
        case "chevron": return P([[-hw, -hh], [hw - L, -hh], [hw, 0], [hw - L, hh], [-hw, hh], [-hw + L, 0]]);
        case "banner": return P([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [-hw + L, 0]]);
    }
    return null;
}
function curveEdge(a: PathPt, b: PathPt, c: number): string {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, half = len / 2;
    const nx = dy / len, ny = -dx / len;
    const ax = mx + nx * c * half, ay = my + ny * c * half;
    const k = Math.min(1, Math.abs(c));
    if (k >= 0.995)
        return ` L ${ax.toFixed(2)} ${ay.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    const c1x = a.x + (ax - a.x) * k, c1y = a.y + (ay - a.y) * k, c2x = b.x + (ax - b.x) * k, c2y = b.y + (ay - b.y) * k;
    return ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}
function bulgeCtrl(a: PathPt, b: PathPt): {
    x: number;
    y: number;
} {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const k = (a.bulge ?? 0) * 2;
    return { x: mx + (dy / d) * k, y: my - (dx / d) * k };
}
export function buildPathData(pts: PathPt[]): string {
    const n = pts.length;
    if (n < 2)
        return "";
    if (pts.some(p => p.curve != null)) {
        const out = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
        for (let i = 0; i < n; i++) {
            const cur = pts[i], next = pts[(i + 1) % n], c = cur.curve ?? 0;
            out.push(c ? curveEdge(cur, next, c) : ` L ${next.x.toFixed(2)} ${next.y.toFixed(2)}`);
        }
        out.push(" Z");
        return out.join("");
    }
    const seg: string[] = [];
    const lerp = (a: PathPt, b: PathPt, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
        const straightIn = !(prev.bulge), straightOut = !(cur.bulge);
        const r = (cur.r && straightIn && straightOut) ? Math.min(cur.r, dist(prev, cur) / 2, dist(cur, next) / 2) : 0;
        const inT = r / (dist(prev, cur) || 1), outT = r / (dist(cur, next) || 1);
        const pIn = r ? lerp(cur, prev, inT) : cur;
        const pOut = r ? lerp(cur, next, outT) : cur;
        if (i === 0)
            seg.push(`M ${pIn.x.toFixed(2)} ${pIn.y.toFixed(2)}`);
        else
            seg.push(`L ${pIn.x.toFixed(2)} ${pIn.y.toFixed(2)}`);
        if (r)
            seg.push(`Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${pOut.x.toFixed(2)} ${pOut.y.toFixed(2)}`);
        if (cur.bulge) {
            const c = bulgeCtrl(cur, next);
            seg.push(`Q ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`);
        }
    }
    seg.push("Z");
    return seg.join(" ");
}
function dist(a: PathPt, b: PathPt): number { return Math.hypot(b.x - a.x, b.y - a.y); }
export function buildCompoundPathData(rings: PathPt[][]): string {
    return rings.map(r => buildPathData(r)).join(" ");
}
export function bakeToPath(kind: ShapeKind, w: number, h: number, corners?: CornerPreset, slant?: number, radii?: number[], apex?: number): PathPt[] {
    const hw = w / 2, hh = h / 2;
    if (kind === "ellipse")
        return [{ x: 0, y: -hh, curve: CIRCLE_CURVE }, { x: hw, y: 0, curve: CIRCLE_CURVE }, { x: 0, y: hh, curve: CIRCLE_CURVE }, { x: -hw, y: 0, curve: CIRCLE_CURVE }];
    if (kind === "diamond")
        return [{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }, { x: -hw, y: 0 }];
    if (kind === "triangle") {
        const t = trianglePts(w, h, apex);
        return [{ x: t[0], y: t[1] }, { x: t[2], y: t[3] }, { x: t[4], y: t[5] }];
    }
    if (kind === "parallelogram") {
        const s = Math.min(hw * 0.9, (slant ?? 0.2) * w);
        return [{ x: -hw + s, y: -hh }, { x: hw, y: -hh }, { x: hw - s, y: hh }, { x: -hw, y: hh }];
    }
    const cr = radii || (corners && corners !== "none") ? shapeRadii(kind, w, h, corners, radii) : null;
    return [
        { x: -hw, y: -hh, ...(cr?.[0] ? { r: cr[0] } : {}) },
        { x: hw, y: -hh, ...(cr?.[1] ? { r: cr[1] } : {}) },
        { x: hw, y: hh, ...(cr?.[2] ? { r: cr[2] } : {}) },
        { x: -hw, y: hh, ...(cr?.[3] ? { r: cr[3] } : {}) },
    ];
}
export const CIRCLE_CURVE = 0.42;
const CORNER_CURVE = CIRCLE_CURVE;
export function curvify(path: PathPt[]): PathPt[] {
    const n = path.length;
    const out: PathPt[] = [];
    for (let i = 0; i < n; i++) {
        const p = path[i], prev = path[(i - 1 + n) % n], next = path[(i + 1) % n];
        if (p.r && p.r > 0.5) {
            const inLen = Math.hypot(prev.x - p.x, prev.y - p.y) || 1, outLen = Math.hypot(next.x - p.x, next.y - p.y) || 1;
            const r = Math.min(p.r, inLen / 2, outLen / 2);
            const ax = p.x + (prev.x - p.x) / inLen * r, ay = p.y + (prev.y - p.y) / inLen * r;
            const bx = p.x + (next.x - p.x) / outLen * r, by = p.y + (next.y - p.y) / outLen * r;
            out.push({ x: Math.round(ax), y: Math.round(ay), curve: CORNER_CURVE });
            out.push({ x: Math.round(bx), y: Math.round(by) });
            continue;
        }
        const b = path[(i + 1) % n], half = Math.hypot(b.x - p.x, b.y - p.y) / 2 || 1;
        const curve = p.curve != null ? p.curve : (p.bulge ? Math.max(-1, Math.min(1, p.bulge / half)) : 0);
        out.push({ x: p.x, y: p.y, ...(curve ? { curve } : {}) });
    }
    return out;
}
export function snapCurve(curve: number, half: number): number {
    const px = (v: number) => Math.abs(curve - v) * half;
    if (px(0) < 9)
        return 0;
    if (px(CIRCLE_CURVE) < 9)
        return CIRCLE_CURVE;
    if (px(-CIRCLE_CURVE) < 9)
        return -CIRCLE_CURVE;
    if (px(1) < 6)
        return 1;
    if (px(-1) < 6)
        return -1;
    return curve;
}
export function redistributeEqual(pts: PathPt[]): void {
    const m = pts.length;
    if (m < 3)
        return;
    const cx = pts.reduce((s, p) => s + p.x, 0) / m, cy = pts.reduce((s, p) => s + p.y, 0) / m;
    let area = 0;
    for (let i = 0; i < m; i++) {
        const q = pts[(i + 1) % m];
        area += (pts[i].x - cx) * (q.y - cy) - (q.x - cx) * (pts[i].y - cy);
    }
    const dir = area >= 0 ? 1 : -1;
    const a0 = Math.atan2(pts[0].y - cy, pts[0].x - cx);
    for (let i = 0; i < m; i++) {
        const r = Math.hypot(pts[i].x - cx, pts[i].y - cy);
        const ang = a0 + dir * (2 * Math.PI * i / m);
        pts[i].x = Math.round(cx + r * Math.cos(ang));
        pts[i].y = Math.round(cy + r * Math.sin(ang));
    }
}
export interface TextRun {
    t: string;
    b?: boolean;
    i?: boolean;
    c?: string;
}
export interface GlyphNode extends ShapeParams {
    kind: ShapeKind;
    width: number;
    height: number;
    text: string;
    runs?: TextRun[];
    fill?: string;
    stroke?: string;
    textColor?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    align?: "left" | "center" | "right" | "justify";
    valign?: "top" | "middle" | "bottom";
    textRotation?: number;
    icon?: string;
    skin?: SkinId;
    corners?: CornerPreset;
    borderStyle?: BorderStyle;
    borderWidth?: number;
    borderPattern?: string;
    font?: string;
    path?: PathPt[];
    paths?: PathPt[][];
    titleSide?: "top" | "left" | "right";
    titleH?: number;
}
export type CornerPreset = "none" | "all" | "top" | "bottom" | "left" | "right" | "one" | "diag" | "three";
export const CORNER_PRESETS: CornerPreset[] = ["none", "all", "top", "bottom", "left", "right", "one", "diag", "three"];
export function cornerRadii(preset: CornerPreset, w: number, h: number): number[] {
    const r = Math.min(16, w * 0.28, h * 0.45);
    const m: Record<CornerPreset, [
        number,
        number,
        number,
        number
    ]> = {
        none: [0, 0, 0, 0],
        all: [r, r, r, r],
        top: [r, r, 0, 0],
        bottom: [0, 0, r, r],
        left: [r, 0, 0, r],
        right: [0, r, r, 0],
        one: [r, 0, 0, 0],
        diag: [r, 0, r, 0],
        three: [r, r, r, 0],
    };
    return m[preset];
}
export function shapeRadii(kind: ShapeKind, w: number, h: number, corners?: CornerPreset, radii?: number[]): [
    number,
    number,
    number,
    number
] {
    const max = Math.min(w, h) / 2;
    if (radii && radii.length === 4)
        return radii.map(r => Math.max(0, Math.min(max, +r || 0))) as [
            number,
            number,
            number,
            number
        ];
    return cornerRadii(corners ?? (kind === "round" ? "all" : "none"), w, h) as [
        number,
        number,
        number,
        number
    ];
}
export function roundRectPath(x: number, y: number, w: number, h: number, r: number[]): string {
    const [a, b, c, d] = r, f = (v: number) => +v.toFixed(2);
    return `M ${f(x + a)} ${f(y)} H ${f(x + w - b)} A ${f(b)} ${f(b)} 0 0 1 ${f(x + w)} ${f(y + b)} V ${f(y + h - c)} A ${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)} H ${f(x + d)} A ${f(d)} ${f(d)} 0 0 1 ${f(x)} ${f(y + h - d)} V ${f(y + a)} A ${f(a)} ${f(a)} 0 0 1 ${f(x + a)} ${f(y)} Z`;
}
export const SKINS: {
    id: SkinId;
    label: string;
    icon: string;
}[] = [
    { id: "flat", label: "Plano", icon: "crop_square" },
    { id: "soft", label: "Suave", icon: "gradient" },
    { id: "glass", label: "Cristal", icon: "blur_on" },
    { id: "neon", label: "Ne\u00F3n", icon: "flare" },
    { id: "shadow", label: "Sombra 3D", icon: "filter_drama" },
    { id: "ornate", label: "Ornamental", icon: "auto_awesome" },
    { id: "sketch", label: "Dibujado a mano", icon: "draw" },
];
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 1831565813) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function roughPoly(pts: number[][], seed: number, jitter = 2.2): number[] {
    const rnd = mulberry32(seed), n = pts.length, out: number[] = [];
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        for (let s = 0; s < 2; s++) {
            const k = s / 2;
            out.push(a[0] + (b[0] - a[0]) * k + (rnd() * 2 - 1) * jitter, a[1] + (b[1] - a[1]) * k + (rnd() * 2 - 1) * jitter);
        }
    }
    out.push(out[0], out[1]);
    return out;
}
const pairs = (q: number[]): number[][] => { const o: number[][] = []; for (let i = 0; i < q.length; i += 2)
    o.push([q[i], q[i + 1]]); return o; };
export function shapeOutline(kind: ShapeKind, w: number, h: number, p?: ShapeParams): number[][] | null {
    const hw = w / 2, hh = h / 2;
    switch (kind) {
        case "rect":
        case "round":
        case "process":
        case "container": return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
        case "ellipse": {
            const p: number[][] = [];
            for (let i = 0; i < 22; i++) {
                const a = (i / 22) * Math.PI * 2;
                p.push([Math.cos(a) * hw, Math.sin(a) * hh]);
            }
            return p;
        }
        case "diamond": return [[0, -hh], [hw, 0], [0, hh], [-hw, 0]];
        case "triangle": {
            const t = trianglePts(w, h, p?.apex);
            return [[t[0], t[1]], [t[2], t[3]], [t[4], t[5]]];
        }
        case "parallelogram": {
            const s = Math.min(hw * 0.9, (p?.slant ?? 0.2) * w);
            return [[-hw + s, -hh], [hw, -hh], [hw - s, hh], [-hw, hh]];
        }
        case "hexagon": return pairs(hexagonPts(w, h, p?.cut));
        case "cross": return pairs(crossPts(w, h, p?.arm));
        case "note": {
            const q = notePts(w, h, p?.fold);
            const o: number[][] = [];
            for (let i = 0; i < q.length; i += 2)
                o.push([q[i], q[i + 1]]);
            return o;
        }
        case "card": return pairs(cardPts(w, h, p?.cut));
        default: return null;
    }
}
export const DEFAULT_FILL = "#e3f2fd", DEFAULT_STROKE = "#1565c0";
function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
} | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m)
        return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function shade(hex: string, amt: number): string {
    const c = hexToRgb(hex);
    if (!c)
        return hex;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const f = (v: number) => Math.round(v + (t - v) * p);
    return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}
export function rgba(hex: string, a: number): string {
    const c = hexToRgb(hex);
    return c ? `rgba(${c.r},${c.g},${c.b},${a})` : hex;
}
export function buildSkin(skin: SkinId, fill: string, stroke: string, w: number, h: number): Record<string, unknown> {
    const hh = h / 2;
    const grad = (c1: string, c2: string) => ({
        fillPriority: "linear-gradient",
        fillLinearGradientStartPoint: { x: 0, y: -hh },
        fillLinearGradientEndPoint: { x: 0, y: hh },
        fillLinearGradientColorStops: [0, c1, 1, c2],
    });
    switch (skin) {
        case "soft":
            return { fill, stroke, strokeWidth: 1.5, ...grad(shade(fill, 0.28), fill), shadowColor: "black", shadowOpacity: 0.18, shadowBlur: 10, shadowOffsetY: 4 };
        case "glass":
            return { stroke: rgba("#ffffff", 0.85), strokeWidth: 1.5, ...grad(rgba(shade(fill, 0.5), 0.75), rgba(fill, 0.34)), shadowColor: stroke, shadowOpacity: 0.3, shadowBlur: 16, shadowOffsetY: 4 };
        case "neon":
            return { fill: shade(fill, -0.55), stroke, strokeWidth: 2.5, shadowColor: stroke, shadowOpacity: 0.95, shadowBlur: 16 };
        case "shadow":
            return { fill, stroke, strokeWidth: 2, shadowColor: "black", shadowOpacity: 0.32, shadowBlur: 0, shadowOffsetX: 6, shadowOffsetY: 6 };
        case "ornate":
            return { stroke: shade(stroke, -0.15), strokeWidth: 3, ...grad(shade(fill, 0.35), shade(fill, -0.08)), shadowColor: "black", shadowOpacity: 0.2, shadowBlur: 6, shadowOffsetY: 3 };
        default:
            return { fill, stroke, strokeWidth: 2 };
    }
}
export function cylinderRy(h: number, depth?: number): number { return depth != null ? Math.max(0, Math.min(0.45, depth)) * h : Math.min(14, h * 0.18); }
export function cylinderPaths(w: number, h: number, depth?: number, cx = 0, cy = 0): {
    body: string;
    lip: string;
} {
    const hw = w / 2, hh = h / 2, ry = cylinderRy(h, depth), K = 0.5523;
    const f = (v: number) => +v.toFixed(2);
    const tY = cy - hh + ry, bY = cy + hh - ry, l = cx - hw, r = cx + hw;
    const upper = (y: number) => `C ${f(l)} ${f(y - K * ry)} ${f(cx - K * hw)} ${f(y - ry)} ${f(cx)} ${f(y - ry)} C ${f(cx + K * hw)} ${f(y - ry)} ${f(r)} ${f(y - K * ry)} ${f(r)} ${f(y)}`;
    const lowerRL = (y: number) => `C ${f(r)} ${f(y + K * ry)} ${f(cx + K * hw)} ${f(y + ry)} ${f(cx)} ${f(y + ry)} C ${f(cx - K * hw)} ${f(y + ry)} ${f(l)} ${f(y + K * ry)} ${f(l)} ${f(y)}`;
    const lowerLR = (y: number) => `C ${f(l)} ${f(y + K * ry)} ${f(cx - K * hw)} ${f(y + ry)} ${f(cx)} ${f(y + ry)} C ${f(cx + K * hw)} ${f(y + ry)} ${f(r)} ${f(y + K * ry)} ${f(r)} ${f(y)}`;
    return { body: `M ${f(l)} ${f(tY)} ${upper(tY)} L ${f(r)} ${f(bY)} ${lowerRL(bY)} Z`, lip: `M ${f(l)} ${f(tY)} ${lowerLR(tY)}` };
}
