let mathjs$: Promise<typeof import("mathjs")> | null = null;
export function getMath(): Promise<typeof import("mathjs")> { return (mathjs$ ??= import("mathjs")); }
const MATH_CONSTS = new Set(["pi", "PI", "Infinity", "NaN", "true", "false"]);
export function freeVars(math: typeof import("mathjs"), expr: string): string[] {
    const vars = new Set<string>();
    try {
        math.parse(expr).traverse((node, _path, parent) => {
            const n = node as {
                isSymbolNode?: boolean;
                name?: string;
            };
            const isFnName = parent && (parent as {
                isFunctionNode?: boolean;
                fn?: unknown;
            }).isFunctionNode
                && (parent as {
                    fn?: unknown;
                }).fn === node;
            if (n.isSymbolNode && n.name && !MATH_CONSTS.has(n.name) && typeof (math as any)[n.name] !== "function" && !isFnName)
                vars.add(n.name);
        });
    }
    catch { }
    return [...vars];
}
