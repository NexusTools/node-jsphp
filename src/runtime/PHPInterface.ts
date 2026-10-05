import { SYMBOL_PHP_CLASS_INTERFACES } from "./Reflection.js";

export class PHPInterface {
  public readonly name: string;
  public readonly parentInterfaces: PHPInterface[];
  public readonly constants: Map<string, any> = new Map();
  public readonly methods: Set<string> = new Set();

  constructor(name: string, parentInterfaces: PHPInterface[] = []) {
    this.name = name;
    this.parentInterfaces = parentInterfaces;
  }

  public isSubinterfaceOf(interfaceName: string): boolean {
    const lower = interfaceName.toLowerCase();
    if (this.name.toLowerCase() === lower) return true;
    return this.parentInterfaces.some((iface) => iface.isSubinterfaceOf(lower));
  }
}
