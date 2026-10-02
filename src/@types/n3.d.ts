declare module "n3" {
    export interface N3Term {
        termType: "NamedNode" | "BlankNode" | "Literal" | "Variable" | "DefaultGraph";
        value: string;
        language?: string;
        datatype?: {
            value: string;
        };
    }
    export interface N3Quad {
        subject: N3Term;
        predicate: N3Term;
        object: N3Term;
        graph: N3Term;
    }
    export class Parser {
        constructor(options?: {
            format?: string;
            baseIRI?: string;
            blankNodePrefix?: string;
        });
        parse(input: string): N3Quad[];
    }
    export class Writer {
        constructor(options?: any);
        addQuad(quad: any): void;
        end(cb: (err: any, result: string) => void): void;
    }
}
