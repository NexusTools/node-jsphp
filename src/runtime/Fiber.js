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
export class FiberRuntime {
    static classes = {
        "fiber": PHPFiber,
    };
    static register(engine) {
        engine.registerClasses(FiberRuntime.classes);
    }
}
//# sourceMappingURL=Fiber.js.map