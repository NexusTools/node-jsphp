import { PHPReference } from "./PHPVariable.js";
export class PHPFiberError extends Error {
}
export class PHPFiberExit extends Error {
}
export class PHPFiber {
    callback;
    running = false;
    started = false;
    terminated = false;
    suspended = false;
    value = undefined;
    constructor(callback) {
        if (callback)
            this.callback = callback;
    }
    static async __$$__new(ctx, callbackArg) {
        const obj = Object.create(this.prototype);
        obj.running = false;
        obj.started = false;
        obj.terminated = false;
        obj.suspended = false;
        obj.value = undefined;
        await obj.__construct(ctx, callbackArg);
        return obj;
    }
    async __construct(ctx, callbackArg) {
        const cb = callbackArg?.get ? callbackArg.get() : callbackArg;
        this.callback = cb;
    }
    async start(ctx, ...args) {
        if (this.started)
            throw new PHPFiberError("Fiber has already been started");
        this.started = true;
        this.running = true;
        try {
            const cb = this.callback instanceof PHPReference ? this.callback.get() : this.callback;
            if (typeof cb === "function") {
                this.value = await cb(ctx, ...args);
            }
            else if (ctx && typeof ctx.callUserFunction === "function") {
                this.value = await ctx.callUserFunction(cb, args);
            }
            this.terminated = true;
            this.running = false;
            return this.value;
        }
        catch (err) {
            this.terminated = true;
            this.running = false;
            throw err;
        }
    }
    isStarted() { return this.started; }
    isstarted() { return this.isStarted(); }
    isRunning() { return this.running; }
    isrunning() { return this.isRunning(); }
    isSuspended() { return this.suspended; }
    issuspended() { return this.isSuspended(); }
    isTerminated() { return this.terminated; }
    isterminated() { return this.isTerminated(); }
    static async suspend(value = undefined) {
        return value;
    }
}
export class FiberRuntime {
    static classes = {
        "fiber": PHPFiber,
    };
    static register(engine) {
        engine.registerClasses(FiberRuntime.classes);
    }
}
//# sourceMappingURL=Fiber.js.map