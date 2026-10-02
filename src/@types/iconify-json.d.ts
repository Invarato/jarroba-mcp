declare module "@iconify-json/*/icons.json" {
    const coleccion: {
        prefix: string;
        icons: Record<string, {
            body: string;
            width?: number;
            height?: number;
            left?: number;
            top?: number;
            hidden?: boolean;
        }>;
        aliases?: Record<string, {
            parent: string;
        }>;
        width?: number;
        height?: number;
        categories?: Record<string, string[]>;
        info?: {
            name: string;
            author?: {
                name: string;
                url?: string;
            };
            license?: {
                title: string;
                spdx?: string;
                url?: string;
            };
        };
    };
    export default coleccion;
}
