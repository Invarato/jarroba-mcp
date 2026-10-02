import { Injectable } from "@angular/core";
export type Fuentes = "borde" | "rejilla";
export interface MallaParams {
    n: number;
    rSeg: number;
    iCelda: number;
    vdd: number;
    fuentes: Fuentes;
    pasoRejilla: number;
}
export interface MallaResultado {
    n: number;
    caida: Float64Array;
    caidaMax: number;
    peor: {
        fila: number;
        col: number;
    };
    caidaMedia: number;
    porcentajeMax: number;
    corrienteTotal: number;
    nFuentes: number;
    iteraciones: number;
    convergio: boolean;
    residuo: number;
}
export const N_MAX = 120;
const TOL = 1e-10;
const iterMax = (n: number) => Math.min(4000, 20 * n + 50);
@Injectable({ providedIn: "root" })
export class PowerGridService {
    private esFuente(f: number, c: number, p: MallaParams): boolean {
        if (p.fuentes === "borde")
            return f === 0 || c === 0 || f === p.n - 1 || c === p.n - 1;
        const paso = Math.max(1, Math.floor(p.pasoRejilla));
        return f % paso === 0 && c % paso === 0;
    }
    resolver(p: MallaParams): MallaResultado | null {
        if (!this.valido(p))
            return null;
        const n = Math.floor(p.n), N = n * n;
        const g = 1 / p.rSeg;
        const fijo = new Uint8Array(N);
        let nFuentes = 0;
        for (let f = 0; f < n; f++) {
            for (let c = 0; c < n; c++) {
                if (this.esFuente(f, c, p)) {
                    fijo[f * n + c] = 1;
                    nFuentes++;
                }
            }
        }
        if (nFuentes === 0 || nFuentes === N) {
            if (nFuentes === 0)
                return null;
            return this.resultado(n, new Float64Array(N), p, nFuentes, 0, true, 0);
        }
        const grado = new Float64Array(N);
        for (let f = 0; f < n; f++) {
            for (let c = 0; c < n; c++) {
                grado[f * n + c] = (f > 0 ? 1 : 0) + (f < n - 1 ? 1 : 0) + (c > 0 ? 1 : 0) + (c < n - 1 ? 1 : 0);
            }
        }
        const matvec = (p_: Float64Array, q: Float64Array) => {
            for (let f = 0; f < n; f++) {
                for (let c = 0; c < n; c++) {
                    const i = f * n + c;
                    if (fijo[i]) {
                        q[i] = 0;
                        continue;
                    }
                    let s = grado[i] * p_[i];
                    if (f > 0)
                        s -= p_[i - n];
                    if (f < n - 1)
                        s -= p_[i + n];
                    if (c > 0)
                        s -= p_[i - 1];
                    if (c < n - 1)
                        s -= p_[i + 1];
                    q[i] = g * s;
                }
            }
        };
        const d = new Float64Array(N);
        const r = new Float64Array(N);
        const z = new Float64Array(N);
        const dir = new Float64Array(N);
        const q = new Float64Array(N);
        let normaB = 0;
        for (let i = 0; i < N; i++) {
            r[i] = fijo[i] ? 0 : p.iCelda;
            normaB += r[i] * r[i];
        }
        normaB = Math.sqrt(normaB);
        if (normaB === 0)
            return this.resultado(n, d, p, nFuentes, 0, true, 0);
        const precond = (src: Float64Array, dst: Float64Array) => {
            for (let i = 0; i < N; i++)
                dst[i] = fijo[i] ? 0 : src[i] / (grado[i] * g);
        };
        precond(r, z);
        dir.set(z);
        let rz = 0;
        for (let i = 0; i < N; i++)
            rz += r[i] * z[i];
        const tope = iterMax(n);
        let it = 0, residuo = 1;
        for (; it < tope; it++) {
            matvec(dir, q);
            let dq = 0;
            for (let i = 0; i < N; i++)
                dq += dir[i] * q[i];
            if (dq <= 0)
                break;
            const alfa = rz / dq;
            let normaR = 0;
            for (let i = 0; i < N; i++) {
                d[i] += alfa * dir[i];
                r[i] -= alfa * q[i];
                normaR += r[i] * r[i];
            }
            residuo = Math.sqrt(normaR) / normaB;
            if (residuo < TOL) {
                it++;
                break;
            }
            precond(r, z);
            let rzNuevo = 0;
            for (let i = 0; i < N; i++)
                rzNuevo += r[i] * z[i];
            const beta = rzNuevo / rz;
            rz = rzNuevo;
            for (let i = 0; i < N; i++)
                dir[i] = z[i] + beta * dir[i];
        }
        return this.resultado(n, d, p, nFuentes, it, residuo < TOL, residuo);
    }
    private resultado(n: number, d: Float64Array, p: MallaParams, nFuentes: number, it: number, convergio: boolean, residuo: number): MallaResultado {
        let max = 0, suma = 0, peorI = 0;
        for (let i = 0; i < d.length; i++) {
            const v = d[i] < 0 ? 0 : d[i];
            d[i] = v;
            suma += v;
            if (v > max) {
                max = v;
                peorI = i;
            }
        }
        const libres = d.length - nFuentes;
        return {
            n,
            caida: d,
            caidaMax: max,
            peor: { fila: Math.floor(peorI / n), col: peorI % n },
            caidaMedia: d.length ? suma / d.length : 0,
            porcentajeMax: p.vdd > 0 ? (max / p.vdd) * 100 : 0,
            corrienteTotal: libres * p.iCelda,
            nFuentes,
            iteraciones: it,
            convergio,
            residuo,
        };
    }
    private valido(p: MallaParams): boolean {
        const nums = [p.n, p.rSeg, p.iCelda, p.vdd, p.pasoRejilla];
        if (!nums.every(Number.isFinite))
            return false;
        return p.n >= 2 && p.n <= N_MAX && p.rSeg > 0 && p.iCelda >= 0 && p.vdd > 0 && p.pasoRejilla >= 1;
    }
}
