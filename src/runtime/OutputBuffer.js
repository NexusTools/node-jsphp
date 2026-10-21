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
    getLength() {
        const contents = this.getContents();
        return contents === false ? false : Buffer.byteLength(contents, "utf8");
    }
    getFlush(ctx) {
        const contents = this.getContents();
        if (contents === false)
            return false;
        this.flush(ctx);
        return contents;
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
        "flush": async (ctx) => { ctx.flushHeaders(); return true; },
        "ob_start": async (ctx) => ctx.outputBuffer.start(),
        "ob_get_clean": async (ctx) => ctx.outputBuffer.getClean(),
        "ob_get_contents": async (ctx) => ctx.outputBuffer.getContents(),
        "ob_get_length": async (ctx) => ctx.outputBuffer.getLength(),
        "ob_get_flush": async (ctx) => ctx.outputBuffer.getFlush(ctx),
        "ob_flush": async (ctx) => ctx.outputBuffer.flush(ctx),
        "ob_end_flush": async (ctx) => ctx.outputBuffer.flush(ctx),
        "ob_end_clean": async (ctx) => ctx.outputBuffer.endClean(),
        "ob_clean": async (ctx) => {
            if (ctx.outputBuffer.isActive()) {
                ctx.outputBuffer.getClean();
                ctx.outputBuffer.start();
            }
            return true;
        },
        "ob_get_level": async (ctx) => ctx.outputBuffer.getLevel(),
    };
    static register(engine) {
        engine.registerFunctions(OutputBufferRuntime.functions);
    }
}
//# sourceMappingURL=OutputBuffer.js.map