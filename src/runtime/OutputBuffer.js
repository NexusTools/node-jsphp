"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputBufferStack = exports.OutputBufferRuntime = void 0;
class OutputBufferRuntime {
    static register(engine) {
        const register = engine.registerFunction.bind(engine);
        register("flush", (ctx) => { ctx.flushHeaders(); return true; });
        register("ob_start", (ctx) => ctx.outputBuffer.start());
        register("ob_get_clean", (ctx) => ctx.outputBuffer.getClean());
        register("ob_get_contents", (ctx) => ctx.outputBuffer.getContents());
        register("ob_flush", (ctx) => ctx.outputBuffer.flush());
        register("ob_end_clean", (ctx) => ctx.outputBuffer.endClean());
        register("ob_get_level", (ctx) => ctx.outputBuffer.getLevel());
    }
}
exports.OutputBufferRuntime = OutputBufferRuntime;
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
//# sourceMappingURL=OutputBuffer.js.map