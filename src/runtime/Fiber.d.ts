import type { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
export declare class PHPFiberError extends Error {
}
export declare class PHPFiberExit extends Error {
}
export declare class PHPFiber {
    private callback;
    private running;
    private started;
    private terminated;
    private suspended;
    private value;
    constructor(callback: Function);
    start(ctx: PHPContext, ...args: any[]): Promise<any>;
    isStarted(): boolean;
    isRunning(): boolean;
    isSuspended(): boolean;
    isTerminated(): boolean;
    static suspend(value?: any): Promise<any>;
}
export declare class FiberRuntime {
    static classes: {
        fiber: typeof PHPFiber;
    };
    static register(engine: PHPEngine): void;
}
