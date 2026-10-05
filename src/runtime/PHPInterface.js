export class PHPInterface {
    name;
    parentInterfaces;
    constants = new Map();
    methods = new Set();
    constructor(name, parentInterfaces = []) {
        this.name = name;
        this.parentInterfaces = parentInterfaces;
    }
    isSubinterfaceOf(interfaceName) {
        const lower = interfaceName.toLowerCase();
        if (this.name.toLowerCase() === lower)
            return true;
        return this.parentInterfaces.some((iface) => iface.isSubinterfaceOf(lower));
    }
}
//# sourceMappingURL=PHPInterface.js.map