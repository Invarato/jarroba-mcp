import { Injectable, inject } from "@angular/core";
import { PgEngineService } from "./pg-engine.service";
import { CATALOG_QUERIES, assembleSchema } from "./schema-catalog";
import { SchemaModel } from "./schema-catalog";
@Injectable({ providedIn: "root" })
export class SchemaIntrospectService {
    private engine = inject(PgEngineService);
    async read(): Promise<SchemaModel> {
        const r = await Promise.all(CATALOG_QUERIES.map(q => this.engine.query(q)));
        return assembleSchema({
            cols: r[0].rows,
            pks: r[1].rows,
            fks: r[2].rows,
            idx: r[3].rows,
            roles: r[4].rows,
            nss: r[5].rows,
            chk: r[6].rows,
            trg: r[7].rows,
            enm: r[8].rows,
            part: r[9].rows,
            seq: r[10].rows,
        });
    }
}
export * from "./schema-catalog";
