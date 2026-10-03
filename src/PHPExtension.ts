import { PHPEngine, PHPFunction } from "./PHPEngine";
import { defineFunction, FunctionMetaOptions } from "./runtime/Reflection";

export abstract class PHPExtension {
  public abstract readonly name: string;
  public readonly version: string = PHPEngine.VERSION;
  public constants: Record<string, any> = {};
  public functions: Record<string, PHPFunction> = {};
  public classes: Record<string, any> = {};

  public registerFunction(
    name: string,
    fn: PHPFunction,
    params: { name: string; isOptional?: boolean; defaultValue?: any; type?: string }[] = [],
    visibility: "public" | "protected" | "private" = "public"
  ): void {
    const fnWithMeta = defineFunction(fn, { name, visibility, parameters: params });
    this.functions[name.toLowerCase()] = fnWithMeta;
  }

  public abstract onInit(engine: PHPEngine): void | Promise<void>
}
