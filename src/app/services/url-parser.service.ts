export interface ParsedUrl {
    protocol: string;
    username: string;
    password: string;
    hostname: string;
    port: string;
    pathname: string;
    queryParams: {
        key: string;
        value: string;
    }[];
    hash: string;
    full: string;
}
export class UrlParserService {
    parse(url: string): ParsedUrl | null {
        try {
            const u = new URL(url);
            const queryParams: {
                key: string;
                value: string;
            }[] = [];
            u.searchParams.forEach((value, key) => queryParams.push({ key, value }));
            return {
                protocol: u.protocol.replace(":", ""),
                username: u.username,
                password: u.password,
                hostname: u.hostname,
                port: u.port,
                pathname: u.pathname,
                queryParams,
                hash: u.hash.replace("#", ""),
                full: u.toString(),
            };
        }
        catch {
            return null;
        }
    }
    build(parts: Partial<ParsedUrl>): string | null {
        try {
            const protocol = parts.protocol || "https";
            const hostname = parts.hostname || "";
            if (!hostname)
                return null;
            const port = parts.port ? `:${parts.port}` : "";
            const auth = parts.username
                ? `${parts.username}${parts.password ? ":" + parts.password : ""}@`
                : "";
            const base = `${protocol}://${auth}${hostname}${port}`;
            const url = new URL(base);
            if (parts.pathname)
                url.pathname = parts.pathname;
            if (parts.queryParams) {
                for (const { key, value } of parts.queryParams) {
                    if (key)
                        url.searchParams.append(key, value);
                }
            }
            if (parts.hash)
                url.hash = parts.hash;
            return url.toString();
        }
        catch {
            return null;
        }
    }
}
