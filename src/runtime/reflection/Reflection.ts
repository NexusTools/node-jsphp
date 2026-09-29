import { PHPClass } from "../objects/PHPObject";

export class ReflectionClass {
  public readonly name: string;
  private phpClass?: PHPClass;

  constructor(nameOrInstance: any) {
    this.name = typeof nameOrInstance === "string" ? nameOrInstance : nameOrInstance?.phpClass?.name || "Object";
  }

  public getName(): string {
    return this.name;
  }

  public isInstantiable(): boolean {
    return true;
  }
}

export class ReflectionMethod {
  public readonly className: string;
  public readonly methodName: string;

  constructor(className: string, methodName: string) {
    this.className = className;
    this.methodName = methodName;
  }

  public getName(): string {
    return this.methodName;
  }
}
