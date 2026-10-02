import { ArchNode, ArchEdge, CATALOG, isDesignNode, DEFAULT_POOL } from "./archsim-model";
export interface NodeSim {
    q: number;
    lambdaIn: number;
    rho: number;
    served: number;
    dropped: number;
    errored: number;
    delayMs: number;
    down: boolean;
    degraded?: boolean;
}
export interface SimResult {
    perNode: Record<string, NodeSim>;
    offered: number;
    throughput: number;
    dropRate: number;
    errorRate: number;
    availability: number;
    p50: number;
    p95: number;
    legitOffered: number;
    attackOffered: number;
    legitAvailability: number;
    underAttack: boolean;
    bottleneck: string | null;
}
