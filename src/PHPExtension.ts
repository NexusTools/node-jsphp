import type { PHPEngine } from "./PHPEngine";

export abstract class PHPExtension {
  public abstract readonly name: string;
  public readonly version: string = "8.5.0";
  public constants: Record<string, any> = {};
  public functions: Record<string, Function> = {};
  public classes: Record<string, any> = {};

  public onInit(engine: PHPEngine): void | Promise<void> {
    // Optional extension initialization hook
  }
}
