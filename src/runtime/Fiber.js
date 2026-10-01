"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPFiber = exports.PHPFiberExit = exports.PHPFiberError = exports.FiberRuntime = void 0;
class FiberRuntime {
    static register(engine) {
        engine.registerClass("fiber", PHPFiber);
    }
}
exports.FiberRuntime = FiberRuntime;
class PHPFiberError extends Error {
}
exports.PHPFiberError = PHPFiberError;
class PHPFiberExit extends Error {
}
exports.PHPFiberExit = PHPFiberExit;
class PHPFiber {
    callback;
    running = false;
    started = false;
    terminated = false;
    suspended = false;
    value = undefined;
    constructor(callback) {
        this.callback = callback;
    }
    async start(ctx, ...args) {
        if (this.started)
            throw new PHPFiberError("Fiber has already been started");
        this.started = true;
        this.running = true;
        try {
            this.value = await this.callback.apply(null, [ctx, ...args]);
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
    isRunning() { return this.running; }
    isSuspended() { return this.suspended; }
    isTerminated() { return this.terminated; }
    static async suspend(value = undefined) {
        return value;
    }
}
exports.PHPFiber = PHPFiber;
//# sourceMappingURL=Fiber.js.map