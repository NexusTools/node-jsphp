import type { PHPContext } from "../../PHPContext";

export class PHPFiberError extends Error {}
export class PHPFiberExit extends Error {}

export class PHPFiber {
  private callback: Function;
  private running = false;
  private started = false;
  private terminated = false;
  private suspended = false;
  private value: any = undefined;

  constructor(callback: Function) {
    this.callback = callback;
  }

  public async start(ctx: PHPContext, ...args: any[]): Promise<any> {
    if (this.started) throw new PHPFiberError("Fiber has already been started");
    this.started = true;
    this.running = true;
    try {
      this.value = await this.callback.apply(null, [ctx, ...args]);
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
  public isRunning(): boolean { return this.running; }
  public isSuspended(): boolean { return this.suspended; }
  public isTerminated(): boolean { return this.terminated; }

  public static async suspend(value: any = undefined): Promise<any> {
    return value;
  }
}
