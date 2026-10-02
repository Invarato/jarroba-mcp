const ALIASES: Record<string, string> = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@hourly": "0 * * * *",
};
export interface CronInfo {
    expression: string;
    humanized: string;
    nextDates: Date[];
}
export class CronService {
    normalize(expr: string): string {
        const trimmed = expr.trim().toLowerCase();
        if (ALIASES[trimmed])
            return ALIASES[trimmed];
        const parts = expr.trim().split(/\s+/);
        if (parts.length === 6)
            return parts.slice(1).join(" ");
        return expr.trim();
    }
    validate(expr: string): boolean {
        const norm = this.normalize(expr);
        const fields = norm.split(/\s+/);
        if (fields.length !== 5)
            return false;
        const limits = [
            { min: 0, max: 59 },
            { min: 0, max: 23 },
            { min: 1, max: 31 },
            { min: 1, max: 12 },
            { min: 0, max: 7 },
        ];
        return fields.every((f, i) => this.validateField(f, limits[i].min, limits[i].max));
    }
    private validateField(f: string, min: number, max: number): boolean {
        if (f === "*" || f === "?")
            return true;
        for (const part of f.split(",")) {
            if (part === "*")
                continue;
            if (/^\*\/\d+$/.test(part)) {
                const step = parseInt(part.slice(2), 10);
                if (step < 1)
                    return false;
                continue;
            }
            if (/^\d+-\d+(\/\d+)?$/.test(part)) {
                const [range, step] = part.split("/");
                const [a, b] = range.split("-").map(Number);
                if (a < min || b > max || a > b)
                    return false;
                if (step && parseInt(step, 10) < 1)
                    return false;
                continue;
            }
            if (/^\d+$/.test(part)) {
                const n = parseInt(part, 10);
                if (n < min || n > max)
                    return false;
                continue;
            }
            return false;
        }
        return true;
    }
    async humanize(expr: string, locale = "es"): Promise<string> {
        const norm = this.normalize(expr);
        try {
            const cronstrue = (await import("cronstrue/i18n")).default;
            return cronstrue.toString(norm, { locale, use24HourTimeFormat: locale === "es" });
        }
        catch {
            return norm;
        }
    }
    nextExecutions(expr: string, count: number, tz?: string): Date[] {
        const norm = this.normalize(expr);
        const fields = norm.split(/\s+/);
        if (fields.length !== 5)
            return [];
        const [minF, hourF, domF, monF, dowF] = fields;
        const parseField = (field: string, min: number, max: number): Set<number> => {
            const result = new Set<number>();
            if (field === "*" || field === "?") {
                for (let i = min; i <= max; i++)
                    result.add(i);
                return result;
            }
            for (const part of field.split(",")) {
                if (part.startsWith("*/")) {
                    const step = parseInt(part.slice(2), 10);
                    for (let i = min; i <= max; i += step)
                        result.add(i);
                }
                else if (/^\d+-\d+(\/\d+)?$/.test(part)) {
                    const [range, step] = part.split("/");
                    const [a, b] = range.split("-").map(Number);
                    const inc = step ? parseInt(step, 10) : 1;
                    for (let i = a; i <= b; i += inc)
                        result.add(i);
                }
                else {
                    result.add(parseInt(part, 10));
                }
            }
            return result;
        };
        const minutes = parseField(minF, 0, 59);
        const hours = parseField(hourF, 0, 23);
        const daysOfMon = parseField(domF, 1, 31);
        const months = parseField(monF, 1, 12);
        const rawDow = parseField(dowF, 0, 7);
        const daysOfWeek = new Set([...rawDow].map(d => d === 7 ? 0 : d));
        const results: Date[] = [];
        const now = new Date();
        now.setSeconds(0, 0);
        now.setMinutes(now.getMinutes() + 1);
        const limit = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 366);
        const cur = new Date(now);
        while (results.length < count && cur < limit) {
            if (months.has(cur.getMonth() + 1) &&
                daysOfMon.has(cur.getDate()) &&
                daysOfWeek.has(cur.getDay()) &&
                hours.has(cur.getHours()) &&
                minutes.has(cur.getMinutes())) {
                results.push(new Date(cur));
            }
            cur.setMinutes(cur.getMinutes() + 1);
        }
        return results;
    }
    countInPeriod(expr: string, periodDays: number): number {
        const results = this.nextExecutions(expr, 100000);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + periodDays);
        return results.filter(d => d <= cutoff).length;
    }
    exportKubernetes(expr: string, jobName = "my-job", image = "alpine"): string {
        return `apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${jobName}
spec:
  schedule: "${expr}"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: ${jobName}
            image: ${image}
            command: ["/bin/sh", "-c", "echo hello"]
          restartPolicy: OnFailure`;
    }
    exportSpring(expr: string): string {
        const norm = this.normalize(expr);
        return `@Scheduled(cron = "0 ${norm}")
public void scheduledTask() {
    // TODO: implement task logic
}`;
    }
    exportGithubActions(expr: string): string {
        const norm = this.normalize(expr);
        return `on:
  schedule:
    - cron: '${norm}'

jobs:
  scheduled-job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run task
        run: echo "Running scheduled task"`;
    }
}
export const CRON_ALIASES = ALIASES;
export const CRON_PRESETS: {
    label: string;
    expr: string;
    desc: string;
}[] = [
    { label: "Cada minuto", expr: "* * * * *", desc: "Se ejecuta cada minuto" },
    { label: "Cada 5 min", expr: "*/5 * * * *", desc: "Cada 5 minutos" },
    { label: "Cada 15 min", expr: "*/15 * * * *", desc: "Cada 15 minutos" },
    { label: "Cada hora", expr: "0 * * * *", desc: "Al inicio de cada hora" },
    { label: "Diariamente 00:00", expr: "0 0 * * *", desc: "Cada d\u00EDa a medianoche" },
    { label: "L\u2013V a las 9:00", expr: "0 9 * * 1-5", desc: "D\u00EDas laborables a las 9" },
    { label: "Primer d\u00EDa del mes", expr: "0 0 1 * *", desc: "El d\u00EDa 1 de cada mes a medianoche" },
    { label: "Cada domingo 03:00", expr: "0 3 * * 0", desc: "Domingos a las 3 AM" },
    { label: "Cada trimestre", expr: "0 0 1 1,4,7,10 *", desc: "Primero de enero, abril, julio, octubre" },
];
