import type { PHPEngine } from "./PHPEngine";
import { defineFunction, FunctionMetaOptions } from "./runtime/Reflection";

export abstract class PHPExtension {
  public abstract readonly name: string;
  public readonly version: string = "8.5.0";
  public constants: Record<string, any> = {};
  public functions: Record<string, Function> = {};
  public classes: Record<string, any> = {};

  public registerFunction(
    name: string,
    fn: Function,
    params: { name: string; isOptional?: boolean; defaultValue?: any; type?: string }[] = [],
    visibility: "public" | "protected" | "private" = "public"
  ): void {
    const fnWithMeta = defineFunction(fn, { name, visibility, parameters: params });
    this.functions[name.toLowerCase()] = fnWithMeta;
  }

  public onInit(engine: PHPEngine): void | Promise<void> {
    // Optional extension initialization hook
  }
}
