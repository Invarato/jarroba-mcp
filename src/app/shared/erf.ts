export function erfc(z: number): number {
    if (!Number.isFinite(z))
        return z === Infinity ? 0 : 2;
    const t = 1 / (1 + 0.5 * Math.abs(z));
    const ans = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
            t * (-0.82215223 + t * 0.17087277)))))))));
    return z >= 0 ? ans : 2 - ans;
}
export function erf(z: number): number {
    return 1 - erfc(z);
}
export function colaNormal(z: number): number {
    return Math.min(1, Math.max(0, 0.5 * erfc(z / Math.SQRT2)));
}
