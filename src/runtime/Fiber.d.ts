import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPReference } from "./PHPVariable.js";
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
    constructor(callback?: Function);
    static __$$__new(ctx: PHPContext, callbackArg?: PHPReference): Promise<PHPFiber>;
    __construct(ctx: PHPContext, callbackArg?: PHPReference): Promise<void>;
    start(ctx: PHPContext, ...args: any[]): Promise<any>;
    isStarted(): boolean;
    isstarted(): boolean;
    isRunning(): boolean;
    isrunning(): boolean;
    isSuspended(): boolean;
    issuspended(): boolean;
    isTerminated(): boolean;
    isterminated(): boolean;
    static suspend(value?: any): Promise<any>;
}
export declare class FiberRuntime {
    static classes: {
        fiber: typeof PHPFiber;
    };
    static register(engine: PHPEngine): void;
}
