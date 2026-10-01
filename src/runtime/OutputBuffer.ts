import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class OutputBufferRuntime {
  public static register(engine: PHPEngine): void {
    const register = engine.registerFunction.bind(engine);
    register("flush", (ctx: PHPContext) => { ctx.flushHeaders(); return true; });
    register("ob_start", (ctx: PHPContext) => ctx.outputBuffer.start());
    register("ob_get_clean", (ctx: PHPContext) => ctx.outputBuffer.getClean());
    register("ob_get_contents", (ctx: PHPContext) => ctx.outputBuffer.getContents());
    register("ob_flush", (ctx: PHPContext) => ctx.outputBuffer.flush());
    register("ob_end_clean", (ctx: PHPContext) => ctx.outputBuffer.endClean());
    register("ob_get_level", (ctx: PHPContext) => ctx.outputBuffer.getLevel());
  }
}

export class OutputBufferStack {
  private buffers: string[] = [];

  public start(): boolean {
    this.buffers.push("");
    return true;
  }

  public write(data: string): void {
    if (this.buffers.length > 0) {
      this.buffers[this.buffers.length - 1] += data;
    }
  }

  public getClean(): string {
    if (this.buffers.length === 0) return "";
    return this.buffers.pop() || "";
  }

  public getContents(): string {
    if (this.buffers.length === 0) return "";
    return this.buffers[this.buffers.length - 1];
  }

  public flush(): boolean {
    if (this.buffers.length === 0) return false;
    const content = this.buffers.pop() || "";
    if (this.buffers.length > 0) {
      this.buffers[this.buffers.length - 1] += content;
    }
    return true;
  }

  public endClean(): boolean {
    if (this.buffers.length === 0) return false;
    this.buffers.pop();
    return true;
  }

  public getLevel(): number {
    return this.buffers.length;
  }

  public isActive(): boolean {
    return this.buffers.length > 0;
  }
}
