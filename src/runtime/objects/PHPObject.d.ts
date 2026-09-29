import type { PHPContext } from "../../PHPContext";
export declare class PHPClass {
    readonly name: string;
    readonly parentClass?: PHPClass;
    readonly interfaces: PHPClass[];
    readonly traits: any[];
    constants: Map<string, any>;
    staticProperties: Map<string, any>;
    methods: Map<string, Function>;
    isAbstract: boolean;
    isFinal: boolean;
    constructor(name: string, parentClass?: PHPClass);
    isSubclassOf(className: string): boolean;
}
export declare class PHPObject {
    readonly phpClass: PHPClass;
    properties: Map<string, any>;
    constructor(phpClass: PHPClass);
    getProperty(ctx: PHPContext, name: string): Promise<any>;
    setProperty(ctx: PHPContext, name: string, value: any): Promise<void>;
    callMethod(ctx: PHPContext, name: string, args: any[]): Promise<any>;
    toString(ctx: PHPContext): Promise<string>;
}
