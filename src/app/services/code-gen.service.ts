import { Injectable } from "@angular/core";
import { SchemaModel, TableModel, ColumnModel } from "./schema-introspect.service";
export type CodeTarget = "java" | "typescript" | "python" | "csharp" | "go";
export interface CodeFile {
    path: string;
    content: string;
}
export interface CodeOptions {
    namespace?: string;
    origen?: string;
}
interface Mapeo {
    java: string;
    typescript: string;
    python: string;
    csharp: string;
    go: string;
}
const TIPOS: {
    re: RegExp;
    t: Mapeo;
}[] = [
    { re: /^(bigserial|bigint|int8)$/, t: { java: "Long", typescript: "number", python: "int", csharp: "long", go: "int64" } },
    { re: /^(serial|integer|int4|int)$/, t: { java: "Integer", typescript: "number", python: "int", csharp: "int", go: "int32" } },
    { re: /^(smallserial|smallint|int2)$/, t: { java: "Short", typescript: "number", python: "int", csharp: "short", go: "int16" } },
    { re: /^(numeric|decimal|money)$/, t: { java: "BigDecimal", typescript: "string", python: "Decimal", csharp: "decimal", go: "string" } },
    { re: /^(real|float4)$/, t: { java: "Float", typescript: "number", python: "float", csharp: "float", go: "float32" } },
    { re: /^(double precision|float8)$/, t: { java: "Double", typescript: "number", python: "float", csharp: "double", go: "float64" } },
    { re: /^bool(ean)?$/, t: { java: "Boolean", typescript: "boolean", python: "bool", csharp: "bool", go: "bool" } },
    { re: /^uuid$/, t: { java: "UUID", typescript: "string", python: "UUID", csharp: "Guid", go: "string" } },
    { re: /^date$/, t: { java: "LocalDate", typescript: "string", python: "date", csharp: "DateOnly", go: "time.Time" } },
    { re: /^timestamp with time zone|timestamptz$/, t: { java: "OffsetDateTime", typescript: "string", python: "datetime", csharp: "DateTimeOffset", go: "time.Time" } },
    { re: /^timestamp( without time zone)?$/, t: { java: "LocalDateTime", typescript: "string", python: "datetime", csharp: "DateTime", go: "time.Time" } },
    { re: /^time/, t: { java: "LocalTime", typescript: "string", python: "time", csharp: "TimeOnly", go: "string" } },
    { re: /^(json|jsonb)$/, t: { java: "String", typescript: "unknown", python: "dict", csharp: "string", go: "json.RawMessage" } },
    { re: /^bytea$/, t: { java: "byte[]", typescript: "Uint8Array", python: "bytes", csharp: "byte[]", go: "[]byte" } },
];
const POR_DEFECTO: Mapeo = { java: "String", typescript: "string", python: "str", csharp: "string", go: "string" };
const IMPORTS_JAVA: Record<string, string> = {
    BigDecimal: "java.math.BigDecimal",
    UUID: "java.util.UUID",
    LocalDate: "java.time.LocalDate",
    LocalDateTime: "java.time.LocalDateTime",
    OffsetDateTime: "java.time.OffsetDateTime",
    LocalTime: "java.time.LocalTime",
};
const IMPORTS_PY: Record<string, string> = {
    Decimal: "from decimal import Decimal",
    UUID: "from uuid import UUID",
    date: "from datetime import date",
    datetime: "from datetime import datetime",
    time: "from datetime import time",
};
@Injectable({ providedIn: "root" })
export class CodeGenService {
    generate(schema: SchemaModel, target: CodeTarget, opts: CodeOptions = {}): CodeFile[] {
        const tablas = schema.tables.filter(t => !t.isView);
        const origen = opts.origen || "DB Studio";
        switch (target) {
            case "java": return tablas.map(t => this.java(t, opts.namespace || "com.example.model", origen));
            case "csharp": return tablas.map(t => this.csharp(t, opts.namespace || "Example.Model", origen));
            case "python": return [this.python(tablas, origen)];
            case "go": return [this.go(tablas, origen)];
            default: return [this.typescript(tablas, origen)];
        }
    }
    ext(target: CodeTarget): string {
        return { java: "java", typescript: "ts", python: "py", csharp: "cs", go: "go" }[target];
    }
    private java(t: TableModel, paquete: string, origen: string): CodeFile {
        const clase = this.pascal(t.name);
        const usados = new Set<string>();
        const cuerpo: string[] = [];
        const metodos: string[] = [];
        for (const c of t.columns) {
            const tipo = this.tipo(c, "java");
            usados.add(tipo);
            const campo = this.camel(c.name);
            const anot: string[] = [];
            if (c.isPk) {
                anot.push("    @Id");
                if (this.esAuto(c))
                    anot.push("    @GeneratedValue(strategy = GenerationType.IDENTITY)");
            }
            const col: string[] = [`name = "${c.name}"`];
            if (c.notNull && !c.isPk)
                col.push("nullable = false");
            if (c.isUnique && !c.isPk)
                col.push("unique = true");
            const len = /^(varchar|character varying)\((\d+)\)/.exec(c.type);
            if (len)
                col.push(`length = ${len[2]}`);
            anot.push(`    @Column(${col.join(", ")})`);
            if (c.comment)
                cuerpo.push(`    /** ${c.comment} */`);
            cuerpo.push(...anot, `    private ${tipo} ${campo};`, "");
            const Get = this.pascal(c.name);
            metodos.push(`    public ${tipo} get${Get}() { return ${campo}; }`, `    public void set${Get}(${tipo} ${campo}) { this.${campo} = ${campo}; }`, "");
        }
        for (const fk of t.foreignKeys) {
            const destino = this.pascal(fk.refTable);
            cuerpo.push("    @ManyToOne(fetch = FetchType.LAZY)", `    @JoinColumn(name = "${fk.columns[0]}", referencedColumnName = "${fk.refColumns[0]}", insertable = false, updatable = false)`, `    private ${destino} ${this.camel(fk.refTable)};`, "");
            metodos.push(`    public ${destino} get${destino}() { return ${this.camel(fk.refTable)}; }`, `    public void set${destino}(${destino} v) { this.${this.camel(fk.refTable)} = v; }`, "");
        }
        const imports = [...new Set([...usados].map(u => IMPORTS_JAVA[u]).filter(Boolean))].sort();
        const cab = [
            `package ${paquete};`,
            "",
            "import jakarta.persistence.*;",
            ...imports.map(i => `import ${i};`),
            "",
            "/**",
            ` * ${t.comment ?? `Table ${t.name}.`}`,
            ` * Generated by Jarroba Tools · ${origen}.`,
            " */",
            "@Entity",
            t.schema === "public" ? `@Table(name = "${t.name}")` : `@Table(name = "${t.name}", schema = "${t.schema}")`,
            `public class ${clase} {`,
            "",
        ];
        return { path: `${clase}.java`, content: [...cab, ...cuerpo, ...metodos, "}", ""].join("\n") };
    }
    private typescript(tablas: TableModel[], origen: string): CodeFile {
        const out: string[] = [`// Generated by Jarroba Tools · ${origen}`, ""];
        for (const t of tablas) {
            if (t.comment)
                out.push(`/** ${t.comment} */`);
            out.push(`export interface ${this.pascal(t.name)} {`);
            for (const c of t.columns) {
                if (c.comment)
                    out.push(`  /** ${c.comment} */`);
                const opt = !c.notNull || this.esAuto(c) || !!c.default;
                out.push(`  ${this.camel(c.name)}${opt ? "?" : ""}: ${this.tipo(c, "typescript")}${!c.notNull ? " | null" : ""};`);
            }
            out.push("}", "");
        }
        return { path: "model.ts", content: out.join("\n") };
    }
    private python(tablas: TableModel[], origen: string): CodeFile {
        const usados = new Set<string>();
        const cuerpo: string[] = [];
        for (const t of tablas) {
            cuerpo.push(`class ${this.pascal(t.name)}(Base):`);
            if (t.comment)
                cuerpo.push(`    """${t.comment}"""`);
            cuerpo.push(`    __tablename__ = "${t.name}"`);
            if (t.schema !== "public")
                cuerpo.push(`    __table_args__ = {"schema": "${t.schema}"}`);
            for (const c of t.columns) {
                const tipo = this.tipo(c, "python");
                usados.add(tipo);
                const partes: string[] = [];
                if (c.isPk)
                    partes.push("primary_key=True");
                if (c.isUnique && !c.isPk)
                    partes.push("unique=True");
                if (!c.notNull)
                    partes.push("nullable=True");
                const fk = t.foreignKeys.find(f => f.columns[0] === c.name);
                if (fk)
                    partes.unshift(`ForeignKey("${fk.refTable}.${fk.refColumns[0]}")`);
                if (c.comment)
                    partes.push(`comment=${JSON.stringify(c.comment.replace(/\s+/g, " "))}`);
                const anot = c.notNull ? tipo : `Optional[${tipo}]`;
                cuerpo.push(`    ${c.name}: Mapped[${anot}] = mapped_column(${partes.join(", ")})`);
            }
            cuerpo.push("");
        }
        const imports = [
            `# Generated by Jarroba Tools · ${origen}`,
            "",
            "from typing import Optional",
            ...[...new Set([...usados].map(u => IMPORTS_PY[u]).filter(Boolean))].sort(),
            "from sqlalchemy import ForeignKey",
            "from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column",
            "",
            "",
            "class Base(DeclarativeBase):",
            "    pass",
            "",
            "",
        ];
        return { path: "model.py", content: [...imports, ...cuerpo].join("\n") };
    }
    private csharp(t: TableModel, ns: string, origen: string): CodeFile {
        const clase = this.pascal(t.name);
        const out: string[] = [
            `// Generated by Jarroba Tools · ${origen}`,
            "using System;",
            "using System.ComponentModel.DataAnnotations;",
            "using System.ComponentModel.DataAnnotations.Schema;",
            "",
            `namespace ${ns};`,
            "",
        ];
        if (t.comment)
            out.push("/// <summary>", `/// ${t.comment}`, "/// </summary>");
        out.push(t.schema === "public" ? `[Table("${t.name}")]` : `[Table("${t.name}", Schema = "${t.schema}")]`);
        out.push(`public class ${clase}`, "{");
        for (const c of t.columns) {
            const tipo = this.tipo(c, "csharp");
            const nulable = !c.notNull && !/\[\]$/.test(tipo) ? `${tipo}?` : tipo;
            if (c.comment)
                out.push(`    /// <summary>${c.comment}</summary>`);
            if (c.isPk)
                out.push("    [Key]");
            if (c.isPk && this.esAuto(c))
                out.push("    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]");
            if (c.notNull && !c.isPk)
                out.push("    [Required]");
            const len = /^(varchar|character varying)\((\d+)\)/.exec(c.type);
            if (len)
                out.push(`    [MaxLength(${len[2]})]`);
            out.push(`    [Column("${c.name}")]`, `    public ${nulable} ${this.pascal(c.name)} { get; set; }`, "");
        }
        for (const fk of t.foreignKeys) {
            out.push(`    [ForeignKey(nameof(${this.pascal(fk.columns[0])}))]`, `    public ${this.pascal(fk.refTable)}? ${this.pascal(fk.refTable)} { get; set; }`, "");
        }
        out.push("}", "");
        return { path: `${clase}.cs`, content: out.join("\n") };
    }
    private go(tablas: TableModel[], origen: string): CodeFile {
        const usaTiempo = tablas.some(t => t.columns.some(c => this.tipo(c, "go") === "time.Time"));
        const usaJson = tablas.some(t => t.columns.some(c => this.tipo(c, "go") === "json.RawMessage"));
        const out: string[] = [`// Generated by Jarroba Tools · ${origen}`, "", "package model", ""];
        const imports = [usaJson ? "\t\"encoding/json\"" : "", usaTiempo ? "\t\"time\"" : ""].filter(Boolean);
        if (imports.length)
            out.push("import (", ...imports, ")", "");
        for (const t of tablas) {
            if (t.comment)
                out.push(`// ${this.pascal(t.name)} — ${t.comment}`);
            out.push(`type ${this.pascal(t.name)} struct {`);
            for (const c of t.columns) {
                const tipo = this.tipo(c, "go");
                const final = c.notNull || /^\[\]/.test(tipo) ? tipo : `*${tipo}`;
                if (c.comment)
                    out.push(`\t// ${this.pascal(c.name)} — ${c.comment.replace(/\s+/g, " ")}`);
                out.push(`\t${this.pascal(c.name)}\t${final}\t\`db:"${c.name}" json:"${c.name}"\``);
            }
            out.push("}", "");
        }
        return { path: "model.go", content: out.join("\n") };
    }
    private tipo(c: ColumnModel, target: CodeTarget): string {
        const base = (c.type ?? "").replace(/\[\]$/, "").replace(/\(.*$/, "").trim().toLowerCase();
        const m = TIPOS.find(x => x.re.test(base) || x.re.test(c.type.toLowerCase()));
        const t = (m?.t ?? POR_DEFECTO)[target];
        if (/\[\]$/.test(c.type)) {
            return { java: `java.util.List<${t}>`, typescript: `${t}[]`, python: `list[${t}]`, csharp: `${t}[]`, go: `[]${t}` }[target];
        }
        return t;
    }
    private esAuto(c: ColumnModel): boolean {
        return c.identity === "a" || c.identity === "d" || /nextval\(/i.test(c.default ?? "");
    }
    private pascal(s: string): string {
        return (s ?? "").split(/[^a-zA-Z0-9]+/).filter(Boolean)
            .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("") || "X";
    }
    private camel(s: string): string {
        const p = this.pascal(s);
        return p.charAt(0).toLowerCase() + p.slice(1);
    }
}
