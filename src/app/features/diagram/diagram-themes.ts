export interface DiagramTheme {
    id: string;
    name: string;
    bg: string;
    grid: string;
    nodeFill: string;
    nodeStroke: string;
    nodeText: string;
    edgeColor: string;
    accents?: string[];
    typeScale?: {
        title: number;
        subtitle: number;
        body: number;
        caption: number;
    };
}
export const THEMES: DiagramTheme[] = [
    { id: "blue", name: "Azul", bg: "#ffffff", grid: "#e8eef7", nodeFill: "#e3f2fd", nodeStroke: "#1565c0", nodeText: "#0d2b45", edgeColor: "#607d8b" },
    { id: "minimal", name: "Minimal", bg: "#ffffff", grid: "#eef1f4", nodeFill: "#f8fafc", nodeStroke: "#64748b", nodeText: "#1e293b", edgeColor: "#94a3b8", typeScale: { title: 28, subtitle: 18, body: 14, caption: 11 } },
    { id: "indigo", name: "Corporativo", bg: "#f8fafc", grid: "#e5e9f2", nodeFill: "#eef2ff", nodeStroke: "#4f46e5", nodeText: "#1e1b4b", edgeColor: "#6366f1" },
    { id: "mint", name: "Menta", bg: "#f6fbf7", grid: "#e3f0e6", nodeFill: "#dcfce7", nodeStroke: "#16a34a", nodeText: "#14532d", edgeColor: "#4ade80" },
    { id: "sunset", name: "Atardecer", bg: "#fffaf5", grid: "#f2e7dc", nodeFill: "#ffedd5", nodeStroke: "#ea580c", nodeText: "#7c2d12", edgeColor: "#fb923c" },
    { id: "dark", name: "Oscuro", bg: "#0f172a", grid: "#1e293b", nodeFill: "#1e293b", nodeStroke: "#38bdf8", nodeText: "#e2e8f0", edgeColor: "#64748b" },
    { id: "vibrant", name: "Vibrante", bg: "#ffffff", grid: "#eef1f4", nodeFill: "#3b82f6", nodeStroke: "#3b82f6", nodeText: "#ffffff", edgeColor: "#94a3b8", accents: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"], typeScale: { title: 40, subtitle: 22, body: 16, caption: 12 } },
];
export const DEFAULT_THEME = THEMES[0];
function hexToHsl(hex: string): [
    number,
    number,
    number
] {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    const r = m ? parseInt(m[1], 16) / 255 : 0.3, g = m ? parseInt(m[2], 16) / 255 : 0.3, b = m ? parseInt(m[3], 16) / 255 : 0.8;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
        h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
        if (h < 0)
            h += 360;
    }
    return [h, s * 100, l * 100];
}
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round((h % 360 + 360) % 360)}, ${Math.round(Math.max(0, Math.min(100, s)))}%, ${Math.round(Math.max(0, Math.min(100, l)))}%)`;
export function generateTheme(primary: string, dark: boolean, vivid: boolean): DiagramTheme {
    const [h, s] = hexToHsl(primary);
    return themeFromHsl(h, s, dark, vivid, false, "Personalizado");
}
function themeFromHsl(h: number, s: number, dark: boolean, vivid: boolean, pastel: boolean, name: string): DiagramTheme {
    const sat = pastel ? Math.min(s, 42) : s;
    const base: DiagramTheme = dark
        ? { id: "custom", name, bg: hsl(h, Math.min(sat, 24), 9), grid: hsl(h, Math.min(sat, 24), 17), nodeFill: hsl(h, 22, 18), nodeStroke: hsl(h, Math.max(sat, 68), 62), nodeText: "#e2e8f0", edgeColor: hsl(h, 16, 46) }
        : { id: "custom", name, bg: pastel ? hsl(h, 30, 98) : "#ffffff", grid: hsl(h, 30, 94), nodeFill: hsl(h, Math.min(sat, pastel ? 45 : 60), pastel ? 95 : 93), nodeStroke: hsl(h, Math.max(sat, 45), pastel ? 55 : 45), nodeText: hsl(h, 42, 22), edgeColor: hsl(h, 22, 56) };
    if (vivid) {
        base.accents = [0, 40, 85, 130, 175, 215, 260, 305].map(d => hsl(h + d, dark ? 65 : 62, dark ? 60 : 54));
        base.nodeText = "#ffffff";
    }
    return base;
}
export interface ThemeGroup {
    label: string;
    themes: DiagramTheme[];
}
const named = (h: number, s: number, dark: boolean, vivid: boolean, pastel: boolean, name: string): DiagramTheme => ({ ...themeFromHsl(h, s, dark, vivid, pastel, name), id: `h${Math.round(h)}${dark ? "d" : ""}${vivid ? "v" : ""}${pastel ? "p" : ""}` });
export const HARMONIC_GROUPS: ThemeGroup[] = [
    { label: "Fr\u00EDos", themes: [named(210, 70, false, false, false, "Oc\u00E9ano"), named(230, 65, false, false, false, "\u00CDndigo"), named(190, 60, false, false, false, "Cian"), named(255, 55, false, false, false, "Violeta")] },
    { label: "C\u00E1lidos", themes: [named(18, 75, false, false, false, "\u00C1mbar"), named(0, 68, false, false, false, "Carm\u00EDn"), named(35, 78, false, false, false, "Miel"), named(330, 60, false, false, false, "Fucsia")] },
    { label: "Naturaleza", themes: [named(145, 60, false, false, false, "Bosque"), named(165, 58, false, false, false, "Jade"), named(95, 55, false, false, false, "Musgo"), named(120, 50, false, false, false, "Menta")] },
    { label: "Pastel", themes: [named(210, 60, false, false, true, "Cielo"), named(340, 60, false, false, true, "Rosa"), named(150, 55, false, false, true, "Agua"), named(45, 60, false, false, true, "Crema")] },
    { label: "Oscuros", themes: [named(215, 65, true, false, false, "Noche"), named(275, 60, true, false, false, "Cosmos"), named(160, 55, true, false, false, "Abismo"), named(20, 60, true, false, false, "Brasa")] },
    { label: "Infograf\u00EDa", themes: [named(210, 65, false, true, false, "Vivo azul"), named(20, 68, false, true, false, "Vivo c\u00E1lido"), named(150, 62, false, true, false, "Vivo verde"), named(275, 62, true, true, false, "Vivo noche")] },
];
