"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputBufferStack = void 0;
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