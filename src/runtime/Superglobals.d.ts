export interface SuperglobalsOptions {
    env?: Record<string, string>;
    server?: Record<string, any>;
    get?: Record<string, any>;
    post?: Record<string, any>;
    files?: Record<string, any>;
    cookie?: Record<string, any>;
    session?: Record<string, any>;
    request?: Record<string, any>;
    ENV?: Record<string, string>;
    SERVER?: Record<string, string>;
    GET?: Record<string, any>;
    POST?: Record<string, any>;
    FILES?: Record<string, any>;
    COOKIE?: Record<string, any>;
    SESSION?: Record<string, any>;
    REQUEST?: Record<string, any>;
}
export declare class Superglobals {
    SERVER: Record<string, any>;
    GET: Record<string, any>;
    POST: Record<string, any>;
    FILES: Record<string, any>;
    COOKIE: Record<string, any>;
    SESSION: Record<string, any>;
    ENV: Record<string, any>;
    REQUEST: Record<string, any>;
    GLOBALS: Record<string, any>;
    constructor(options?: SuperglobalsOptions);
}
