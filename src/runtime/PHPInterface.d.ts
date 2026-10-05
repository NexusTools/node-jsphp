export declare class PHPInterface {
    readonly name: string;
    readonly parentInterfaces: PHPInterface[];
    readonly constants: Map<string, any>;
    readonly methods: Set<string>;
    constructor(name: string, parentInterfaces?: PHPInterface[]);
    isSubinterfaceOf(interfaceName: string): boolean;
}
