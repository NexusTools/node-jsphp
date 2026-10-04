export class OutputBufferStack {
    buffers = [];
    start() {
        this.buffers.push("");
        return true;
    }
    write(data) {
        if (this.buffers.length > 0) {
            this.buffers[this.buffers.length - 1] += data;
        }
    }
    getClean() {
        if (this.buffers.length === 0)
            return false;
        return this.buffers.pop() || "";
    }
    getContents() {
        if (this.buffers.length === 0)
            return false;
        return this.buffers[this.buffers.length - 1];
    }
    flush(ctx) {
        if (this.buffers.length === 0)
            return false;
        const content = this.buffers.pop() || "";
        if (this.buffers.length > 0) {
            this.buffers[this.buffers.length - 1] += content;
        }
        else if (ctx) {
            ctx.writeStdout(content);
        }
        return true;
    }
    endClean() {
        if (this.buffers.length === 0)
            return false;
        this.buffers.pop();
        return true;
    }
    flushAll(ctx) {
        while (this.buffers.length > 0) {
            this.flush(ctx);
        }
    }
    getLevel() {
        return this.buffers.length;
    }
    isActive() {
        return this.buffers.length > 0;
    }
}
export class OutputBufferRuntime {
    static functions = {
        "flush": (ctx) => { ctx.flushHeaders(); return true; },
        "ob_start": (ctx) => ctx.outputBuffer.start(),
        "ob_get_clean": (ctx) => ctx.outputBuffer.getClean(),
        "ob_get_contents": (ctx) => ctx.outputBuffer.getContents(),
        "ob_flush": (ctx) => ctx.outputBuffer.flush(ctx),
        "ob_end_flush": (ctx) => ctx.outputBuffer.flush(ctx),
        "ob_end_clean": (ctx) => ctx.outputBuffer.endClean(),
        "ob_clean": (ctx) => {
            if (ctx.outputBuffer.isActive()) {
                ctx.outputBuffer.getClean();
                ctx.outputBuffer.start();
            }
            return true;
        },
        "ob_get_level": (ctx) => ctx.outputBuffer.getLevel(),
    };
    static register(engine) {
        engine.registerFunctions(OutputBufferRuntime.functions);
    }
}
//# sourceMappingURL=OutputBuffer.js.map