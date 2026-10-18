import { Injectable } from "@angular/core";
import { SchemaModel, TableModel, ColumnModel, FkModel, FkAction } from "./schema-introspect.service";
export interface DocLabels {
    lang: string;
    title: string;
    tables: string;
    views: string;
    view: string;
    column: string;
    type: string;
    nullable: string;
    key: string;
    default: string;
    comment: string;
    yes: string;
    no: string;
    indexes: string;
    unique: string;
    partial: string;
    expression: string;
    constraints: string;
    relations: string;
    triggers: string;
    perRow: string;
    perStatement: string;
    partitionedBy: string;
    partitionOf: string;
    enums: string;
}
export const DOC_LABELS_EN: DocLabels = {
    lang: "en",
    title: "Database schema",
    tables: "table(s)",
    views: "view(s)",
    view: "view",
    column: "Column",
    type: "Type",
    nullable: "Nullable",
    key: "Key",
    default: "Default",
    comment: "Comment",
    yes: "yes",
    no: "NO",
    indexes: "Indexes",
    unique: "unique",
    partial: "partial",
    expression: "expression",
    constraints: "Constraints",
    relations: "Relations",
    triggers: "Triggers",
    perRow: "for each row",
    perStatement: "for each statement",
    partitionedBy: "Table partitioned by",
    partitionOf: "Partition of",
    enums: "Enumerated types",
};
export type Cardinality = "one-to-one" | "one-to-many";
@Injectable({ providedIn: "root" })
export class SchemaDocService {
    markdown(schema: SchemaModel, L: DocLabels = DOC_LABELS_EN): string {
        const tables = schema.tables.filter(t => !t.isView);
        const views = schema.tables.filter(t => t.isView);
        const out: string[] = [`# ${L.title}`, ""];
        out.push(`${tables.length} ${L.tables}${views.length ? ` · ${views.length} ${L.views}` : ""}.`, "");
        if (tables.length > 1) {
            out.push(...schema.tables.map(t => `- [${this.qname(t)}](#${this.anchor(this.qname(t))})`), "");
        }
        for (const t of schema.tables) {
            out.push(`## ${this.qname(t)}${t.isView ? ` *(${L.view})*` : ""}`, "");
            if (t.comment)
                out.push(`> ${t.comment}`, "");
            out.push(`| ${L.column} | ${L.type} | ${L.nullable} | ${L.key} | ${L.default} | ${L.comment} |`);
            out.push("|---|---|---|---|---|---|");
            for (const c of t.columns) {
                out.push(`| \`${c.name}\` | ${this.md(c.type)} | ${c.notNull || c.isPk ? L.no : L.yes} | ` +
                    `${this.keyOf(c)} | ${this.md(this.defaultOf(c))} | ${this.md(c.comment ?? "")} |`);
            }
            out.push("");
            const idx = (t.indexes ?? []).filter(i => !i.primary);
            if (idx.length) {
                out.push(`**${L.indexes}**`, "");
                for (const i of idx) {
                    const marks = [i.unique ? L.unique : "", i.partial ? L.partial : "", i.method && i.method !== "btree" ? i.method : ""]
                        .filter(Boolean).join(", ");
                    out.push(`- \`${i.name}\` (${i.columns.join(", ") || L.expression})${marks ? ` — ${marks}` : ""}`);
                }
                out.push("");
            }
            if (t.checks?.length) {
                out.push(`**${L.constraints}**`, "");
                for (const c of t.checks)
                    out.push(`- \`${c.name}\` — ${this.md(c.def)}`);
                out.push("");
            }
            if (t.foreignKeys.length) {
                out.push(`**${L.relations}**`, "");
                for (const fk of t.foreignKeys) {
                    out.push(`- ${fk.columns.map(c => `\`${c}\``).join(", ")} → \`${fk.refSchema}.${fk.refTable}\`` +
                        ` (${fk.refColumns.join(", ")})${this.actions(fk)}`);
                }
                out.push("");
            }
            if (t.triggers?.length) {
                out.push(`**${L.triggers}**`, "");
                for (const g of t.triggers) {
                    out.push(`- \`${g.name}\` — ${g.timing} ${g.events.join(", ")} ${g.perRow ? L.perRow : L.perStatement} → \`${g.fn}()\``);
                }
                out.push("");
            }
            if (t.partitionKey)
                out.push(`*${L.partitionedBy} ${t.partitionKey}.*`, "");
            if (t.partitionOf)
                out.push(`*${L.partitionOf} \`${t.partitionOf}\`.*`, "");
        }
        if (schema.enums?.length) {
            out.push(`## ${L.enums}`, "");
            for (const e of schema.enums) {
                out.push(`- \`${e.schema === "public" ? e.name : `${e.schema}.${e.name}`}\`: ${e.values.map(v => `\`${v}\``).join(", ")}`);
            }
            out.push("");
        }
        return out.join("\n");
    }
    html(schema: SchemaModel, L: DocLabels = DOC_LABELS_EN): string {
        const body: string[] = [`<h1>${this.esc(L.title)}</h1>`];
        for (const t of schema.tables) {
            body.push(`<h2 id="${this.esc(this.anchor(this.qname(t)))}">${this.esc(this.qname(t))}` +
                `${t.isView ? ` <em>(${this.esc(L.view)})</em>` : ""}</h2>`);
            if (t.comment)
                body.push(`<p class="cmt">${this.esc(t.comment)}</p>`);
            body.push("<table><thead><tr>" + [L.column, L.type, L.nullable, L.key, L.default, L.comment]
                .map(h => `<th>${this.esc(h)}</th>`).join("") + "</tr></thead><tbody>");
            for (const c of t.columns) {
                body.push(`<tr><td><code>${this.esc(c.name)}</code></td><td>${this.esc(c.type)}</td>` +
                    `<td>${this.esc(c.notNull || c.isPk ? L.no : L.yes)}</td><td>${this.esc(this.keyOf(c))}</td>` +
                    `<td>${this.esc(this.defaultOf(c))}</td><td>${this.esc(c.comment ?? "")}</td></tr>`);
            }
            body.push("</tbody></table>");
            const idx = (t.indexes ?? []).filter(i => !i.primary);
            if (idx.length) {
                body.push(`<h3>${this.esc(L.indexes)}</h3><ul>`);
                for (const i of idx) {
                    const marks = [i.unique ? L.unique : "", i.partial ? L.partial : ""].filter(Boolean).join(", ");
                    body.push(`<li><code>${this.esc(i.name)}</code> (${this.esc(i.columns.join(", ") || L.expression)})${marks ? ` — ${this.esc(marks)}` : ""}</li>`);
                }
                body.push("</ul>");
            }
            if (t.checks?.length) {
                body.push(`<h3>${this.esc(L.constraints)}</h3><ul>`);
                for (const c of t.checks)
                    body.push(`<li><code>${this.esc(c.name)}</code> — ${this.esc(c.def)}</li>`);
                body.push("</ul>");
            }
            if (t.foreignKeys.length) {
                body.push(`<h3>${this.esc(L.relations)}</h3><ul>`);
                for (const fk of t.foreignKeys) {
                    body.push(`<li>${this.esc(fk.columns.join(", "))} → <code>${this.esc(`${fk.refSchema}.${fk.refTable}`)}</code>` +
                        `(${this.esc(fk.refColumns.join(", "))})${this.esc(this.actions(fk))}</li>`);
                }
                body.push("</ul>");
            }
        }
        return `<!doctype html>
<html lang="${this.esc(L.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${this.esc(L.title)}</title>
<style>
 body{font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0 auto;padding:24px;max-width:1000px;color:#263238}
 h1{border-bottom:2px solid #3949ab;padding-bottom:6px}
 h2{margin-top:32px;color:#283593}
 h3{margin:14px 0 4px;font-size:14px;color:#546e7a;text-transform:uppercase;letter-spacing:.04em}
 table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px}
 th,td{border:1px solid #cfd8dc;padding:5px 8px;text-align:left;vertical-align:top}
 th{background:#eceff1}
 code{font-family:ui-monospace,Roboto Mono,monospace;background:#f5f5f5;padding:1px 4px;border-radius:3px}
 .cmt{color:#546e7a;font-style:italic;margin:2px 0 8px}
 ul{margin:4px 0 12px 20px;padding:0}
</style></head><body>
${body.join("\n")}
</body></html>`;
    }
    dbml(schema: SchemaModel): string {
        const out: string[] = ["// Generated by Jarroba Tools \u00B7 DB Studio", ""];
        for (const t of schema.tables) {
            if (t.isView)
                continue;
            out.push(`Table ${this.dbmlName(t)} {`);
            for (const c of t.columns) {
                const attrs: string[] = [];
                if (c.isPk && t.primaryKey.length === 1)
                    attrs.push("pk");
                if (this.isAuto(c))
                    attrs.push("increment");
                if (c.isUnique && !c.isPk)
                    attrs.push("unique");
                if (c.notNull && !c.isPk && !this.isAuto(c))
                    attrs.push("not null");
                if (c.default && !this.isAuto(c))
                    attrs.push(`default: \`${this.clean(c.default)}\``);
                if (c.comment)
                    attrs.push(`note: '${this.q(c.comment)}'`);
                out.push(`  ${c.name} ${this.dbmlType(c.type)}${attrs.length ? ` [${attrs.join(", ")}]` : ""}`);
            }
            const lines: string[] = [];
            if (t.primaryKey.length > 1)
                lines.push(`    (${t.primaryKey.join(", ")}) [pk]`);
            for (const i of (t.indexes ?? []).filter(i => !i.primary && i.columns.length)) {
                lines.push(`    (${i.columns.join(", ")}) [name: '${this.q(i.name)}'${i.unique ? ", unique" : ""}]`);
            }
            if (lines.length)
                out.push("", "  indexes {", ...lines, "  }");
            if (t.comment)
                out.push("", `  Note: '${this.q(t.comment)}'`);
            out.push("}", "");
        }
        for (const e of schema.enums ?? []) {
            out.push(`Enum ${e.name} {`, ...e.values.map(v => `  "${v}"`), "}", "");
        }
        for (const t of schema.tables) {
            for (const fk of t.foreignKeys) {
                const card = this.cardinality(t, fk) === "one-to-one" ? "-" : ">";
                const del = fk.onDelete && fk.onDelete !== "a" ? ` [delete: ${this.actionWord(fk.onDelete)}]` : "";
                out.push(`Ref: ${t.name}.${fk.columns[0]} ${card} ${fk.refTable}.${fk.refColumns[0]}${del}`);
            }
        }
        return out.join("\n");
    }
    mermaid(schema: SchemaModel): string {
        const out: string[] = ["erDiagram"];
        for (const t of schema.tables) {
            out.push(`  ${this.mmName(t)} {`);
            for (const c of t.columns) {
                const keys = [c.isPk ? "PK" : "", c.isFk ? "FK" : "", c.isUnique && !c.isPk ? "UK" : ""].filter(Boolean);
                const key = keys.length ? " " + keys.join(", ") : "";
                out.push(`    ${this.mmType(c.type)} ${this.mmIdent(c.name)}${key}`);
            }
            out.push("  }");
        }
        for (const t of schema.tables) {
            for (const fk of t.foreignKeys) {
                const optional = t.columns.some(c => fk.columns.includes(c.name) && !c.notNull);
                const right = this.cardinality(t, fk) === "one-to-one" ? (optional ? "o|" : "||") : (optional ? "o{" : "|{");
                out.push(`  ${this.mmName2(fk.refSchema, fk.refTable)} ||--${right} ${this.mmName(t)} : "${fk.columns.join(", ")}"`);
            }
        }
        return out.join("\n");
    }
    cardinality(child: TableModel, fk: FkModel): Cardinality {
        const cols = [...fk.columns].sort().join(",");
        const uniqueSets = [
            child.primaryKey,
            ...(child.indexes ?? []).filter(i => i.unique && !i.partial).map(i => i.columns),
        ];
        return uniqueSets.some(s => s.length === fk.columns.length && [...s].sort().join(",") === cols)
            ? "one-to-one" : "one-to-many";
    }
    private qname(t: TableModel): string { return t.schema === "public" ? t.name : `${t.schema}.${t.name}`; }
    private anchor(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
    private keyOf(c: ColumnModel): string {
        const k = [c.isPk ? "PK" : "", c.isFk ? "FK" : "", c.isUnique && !c.isPk ? "UQ" : ""].filter(Boolean);
        return k.join(" ");
    }
    private defaultOf(c: ColumnModel): string {
        if (this.isAuto(c))
            return "auto";
        return c.default ? this.clean(c.default) : "";
    }
    private isAuto(c: ColumnModel): boolean {
        return c.identity === "a" || c.identity === "d" || /nextval\(/i.test(c.default ?? "");
    }
    private clean(s: string): string { return s.replace(/::[\w ]+(\[\])?/g, ""); }
    private actions(fk: FkModel): string {
        const parts = [
            fk.onDelete && fk.onDelete !== "a" ? `ON DELETE ${this.actionWord(fk.onDelete).toUpperCase()}` : "",
            fk.onUpdate && fk.onUpdate !== "a" ? `ON UPDATE ${this.actionWord(fk.onUpdate).toUpperCase()}` : "",
        ].filter(Boolean);
        return parts.length ? ` — ${parts.join(", ")}` : "";
    }
    private actionWord(a: FkAction): string {
        return { a: "no action", r: "restrict", c: "cascade", n: "set null", d: "set default" }[a] ?? "no action";
    }
    private md(s: string): string { return (s ?? "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " "); }
    private esc(s: string): string {
        return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    private q(s: string): string { return (s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, " "); }
    private dbmlName(t: TableModel): string {
        return t.schema === "public" ? t.name : `"${t.schema}"."${t.name}"`;
    }
    private dbmlType(type: string): string { return /[ (,]/.test(type) ? `"${type}"` : type; }
    private mmName(t: TableModel): string { return this.mmName2(t.schema, t.name); }
    private mmName2(schema: string, name: string): string {
        return this.mmIdent(schema === "public" ? name : `${schema}_${name}`);
    }
    private mmIdent(s: string): string { return s.replace(/[^A-Za-z0-9_]/g, "_"); }
    private mmType(type: string): string { return type.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+$/, ""); }
}
