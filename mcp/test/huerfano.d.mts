export function probarHuerfano(comando: string, args: string[], opciones?: {
    env?: NodeJS.ProcessEnv;
    tool?: string;
    arranqueMs?: number;
}): Promise<{
    vivo: boolean;
    cpu: number;
    noAplica?: string;
}>;
export const CONTROL_ROTO: string[];
