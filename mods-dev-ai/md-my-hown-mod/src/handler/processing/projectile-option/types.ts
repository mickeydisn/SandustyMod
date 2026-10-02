export type ProjectileOptionFn = (params: unknown) => Record<string, unknown>;

export interface ProjectileOptionRef {
    key: string;
    params?: Record<string, unknown>;
}

export type ProjectileGetOptions = () => Record<string, unknown>;

export interface ProjectileOptionFailure {
    key: string;
    error: unknown;
}
