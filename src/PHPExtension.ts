import { PHPEngine } from "./PHPEngine.js";
import type { PHPFunction } from "./PHPEngine.js";

export abstract class PHPExtension {
  public abstract readonly name: string;
  public readonly version: string = PHPEngine.VERSION;
  public constants: Record<string, any> = {};
  public functions: Record<string, PHPFunction> = {};
  public classes: Record<string, any> = {};

  public registerFunction(name: string, fn: PHPFunction): void { this.functions[name] = fn; }

  public abstract onInit(engine: PHPEngine): void | Promise<void>
}
