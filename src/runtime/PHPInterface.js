import { normalizePhpRegistryName } from "./Reflection.js";
export class PHPInterface {
    name;
    parentInterfaces;
    constants = Object.create(null);
    methods = new Set();
    constructor(name, parentInterfaces = []) {
        this.name = name;
        this.parentInterfaces = parentInterfaces;
    }
    isSubinterfaceOf(interfaceName) {
        const lower = normalizePhpRegistryName(interfaceName);
        if (normalizePhpRegistryName(this.name) === lower)
            return true;
        return this.parentInterfaces.some((iface) => iface.isSubinterfaceOf(lower));
    }
}
//# sourceMappingURL=PHPInterface.js.map