import { SYMBOL_PHP_CLASS_INTERFACES, normalizePhpRegistryName } from "./Reflection.js";

export class PHPInterface {
  public readonly name: string;
  public readonly parentInterfaces: PHPInterface[];
  public readonly constants: Record<string, any> = Object.create(null);
  public readonly methods: Set<string> = new Set();

  constructor(name: string, parentInterfaces: PHPInterface[] = []) {
    this.name = name;
    this.parentInterfaces = parentInterfaces;
  }

  public isSubinterfaceOf(interfaceName: string): boolean {
    const lower = normalizePhpRegistryName(interfaceName);
    if (normalizePhpRegistryName(this.name) === lower) return true;
    return this.parentInterfaces.some((iface) => iface.isSubinterfaceOf(lower));
  }
}
