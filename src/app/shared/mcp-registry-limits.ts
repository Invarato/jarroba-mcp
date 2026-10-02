export const LIMITES_REGISTRO_MCP = {
    title: { maxLength: 100, minLength: 1 },
    description: { maxLength: 100, minLength: 1 },
    name: { maxLength: 200, minLength: 3, pattern: /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/ },
    version: { maxLength: 255 },
} as const;
