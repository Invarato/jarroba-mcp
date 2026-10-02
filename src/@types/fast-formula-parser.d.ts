declare module "fast-formula-parser" {
    type ExcelPrimitivo = number | string | boolean | null;
    interface CeldaRef {
        sheet: string;
        row: number;
        col: number;
    }
    interface RangoRef {
        sheet: string;
        from: {
            row: number;
            col: number;
        };
        to: {
            row: number;
            col: number;
        };
    }
    interface Posicion {
        row: number;
        col: number;
        sheet: string;
    }
    interface OpcionesParser {
        onCell?: (ref: CeldaRef) => ExcelPrimitivo | FormulaError;
        onRange?: (ref: RangoRef) => (ExcelPrimitivo | FormulaError)[][];
        onVariable?: (name: string, sheetName?: string) => CeldaRef | RangoRef;
        functions?: Record<string, (...args: unknown[]) => unknown>;
    }
    interface TipoDato {
        NUMBER: unknown;
        STRING: unknown;
        BOOLEAN: unknown;
        ARRAY: unknown;
        RANGE_REF: unknown;
        CELL_REF: unknown;
    }
    interface AyudasFormula {
        accept(value: unknown, type?: unknown, defaultValue?: unknown, flatten?: boolean): unknown;
        flattenParams(params: unknown[], type: unknown, ignoreErrors: boolean, cb: (item: unknown, info?: unknown) => void): void;
    }
    export class FormulaError {
        error: string;
        details?: unknown;
        constructor(error: string, details?: unknown);
        toString(): string;
        static readonly DIV0: FormulaError;
        static readonly NA: FormulaError;
        static readonly NAME: FormulaError;
        static readonly NULL: FormulaError;
        static readonly NUM: FormulaError;
        static readonly REF: FormulaError;
        static readonly VALUE: FormulaError;
        static readonly ERROR: FormulaError;
        static readonly SPILL: FormulaError;
        static readonly CALC: FormulaError;
    }
    export default class FormulaParser {
        constructor(options?: OpcionesParser);
        parse(formula: string, position: Posicion, asArray?: boolean): ExcelPrimitivo | FormulaError | unknown[][];
        parseAsync(formula: string, position: Posicion, asArray?: boolean): Promise<ExcelPrimitivo | FormulaError | unknown[][]>;
        static readonly FormulaHelpers: AyudasFormula;
        static readonly Types: TipoDato;
        static readonly FormulaError: typeof FormulaError;
        static readonly MAX_ROW: number;
        static readonly MAX_COLUMN: number;
    }
}
