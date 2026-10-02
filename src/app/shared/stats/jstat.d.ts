declare module "jstat" {
    interface JStatDist {
        pdf(x: number, ...params: number[]): number;
        cdf(x: number, ...params: number[]): number;
        inv(p: number, ...params: number[]): number;
        mean(...params: number[]): number;
        variance(...params: number[]): number;
        sample(...params: number[]): number;
    }
    interface JStatStatic {
        normal: JStatDist;
        lognormal: JStatDist;
        uniform: JStatDist;
        exponential: JStatDist;
        studentt: JStatDist;
        chisquare: JStatDist;
        centralF: JStatDist;
        beta: JStatDist;
        gamma: JStatDist;
        binomial: JStatDist;
        poisson: JStatDist;
        geometric: JStatDist;
        negbin: JStatDist;
        hypgeom: JStatDist;
        tukey: {
            cdf(q: number, nmeans: number, df: number): number;
            inv(p: number, nmeans: number, df: number): number;
        };
        ttest(...a: unknown[]): number;
        anovafscore(...a: number[][]): number;
        anovaftest(...a: number[][]): number;
        corrcoeff(x: number[], y: number[]): number;
        spearmancoeff(x: number[], y: number[]): number;
        erf(x: number): number;
        gammaln(x: number): number;
        normalci(...a: unknown[]): number[];
        tci(...a: unknown[]): number[];
        models: {
            ols(endog: number[], exog: number[][]): unknown;
        };
        [key: string]: unknown;
    }
    export const jStat: JStatStatic;
    export default jStat;
}
