"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputBufferRuntime = exports.OutputBufferStack = void 0;
class OutputBufferStack {
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
            return "";
        return this.buffers.pop() || "";
    }
    getContents() {
        if (this.buffers.length === 0)
            return "";
        return this.buffers[this.buffers.length - 1];
    }
    flush() {
        if (this.buffers.length === 0)
            return false;
        const content = this.buffers.pop() || "";
        if (this.buffers.length > 0) {
            this.buffers[this.buffers.length - 1] += content;
        }
        return true;
    }
    endClean() {
        if (this.buffers.length === 0)
            return false;
        this.buffers.pop();
        return true;
    }
    getLevel() {
        return this.buffers.length;
    }
    isActive() {
        return this.buffers.length > 0;
    }
}
exports.OutputBufferStack = OutputBufferStack;
class OutputBufferRuntime {
    static functions = {
        "flush": (ctx) => { ctx.flushHeaders(); return true; },
        "ob_start": (ctx) => ctx.outputBuffer.start(),
        "ob_get_clean": (ctx) => ctx.outputBuffer.getClean(),
        "ob_get_contents": (ctx) => ctx.outputBuffer.getContents(),
        "ob_flush": (ctx) => ctx.outputBuffer.flush(),
        "ob_end_clean": (ctx) => ctx.outputBuffer.endClean(),
        "ob_get_level": (ctx) => ctx.outputBuffer.getLevel(),
    };
    static register(engine) {
        engine.registerFunctions(OutputBufferRuntime.functions);
    }
}
exports.OutputBufferRuntime = OutputBufferRuntime;
//# sourceMappingURL=OutputBuffer.js.map