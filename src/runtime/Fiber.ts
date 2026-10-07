import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPReference } from "./PHPVariable.js";

export class PHPFiberError extends Error {}
export class PHPFiberExit extends Error {}

export class PHPFiber {
  private callback!: Function;
  private running = false;
  private started = false;
  private terminated = false;
  private suspended = false;
  private value: any = undefined;

  constructor(callback?: Function) {
    if (callback) this.callback = callback;
  }

  public static async __$$__new(ctx: PHPContext, callbackArg?: PHPReference): Promise<PHPFiber> {
    const obj = Object.create(this.prototype);
    obj.running = false;
    obj.started = false;
    obj.terminated = false;
    obj.suspended = false;
    obj.value = undefined;
    await obj.__construct(ctx, callbackArg);
    return obj;
  }

  public async __construct(ctx: PHPContext, callbackArg?: PHPReference): Promise<void> {
    const cb = callbackArg?.get ? callbackArg.get() : callbackArg;
    this.callback = cb;
  }

  public async start(ctx: PHPContext, ...args: any[]): Promise<any> {
    if (this.started) throw new PHPFiberError("Fiber has already been started");
    this.started = true;
    this.running = true;
    try {
      const cb = this.callback instanceof PHPReference ? this.callback.get() : this.callback;
      if (typeof cb === "function") {
        this.value = await cb(ctx, ...args);
      } else if (ctx && typeof (ctx as any).callUserFunction === "function") {
        this.value = await (ctx as any).callUserFunction(cb, args);
      }
      this.terminated = true;
      this.running = false;
      return this.value;
    } catch (err) {
      this.terminated = true;
      this.running = false;
      throw err;
    }
  }

  public isStarted(): boolean { return this.started; }
  public isstarted(): boolean { return this.isStarted(); }
  public isRunning(): boolean { return this.running; }
  public isrunning(): boolean { return this.isRunning(); }
  public isSuspended(): boolean { return this.suspended; }
  public issuspended(): boolean { return this.isSuspended(); }
  public isTerminated(): boolean { return this.terminated; }
  public isterminated(): boolean { return this.isTerminated(); }

  public static async suspend(value: any = undefined): Promise<any> {
    return value;
  }
}

export class FiberRuntime {
  static classes = {
    "fiber": PHPFiber,
  };

  public static register(engine: PHPEngine): void {
    engine.registerClasses(FiberRuntime.classes);
  }
}
