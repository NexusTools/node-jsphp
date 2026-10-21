import type { PHPContext } from "../PHPContext.js";
export interface PHPParameterMetadata {
    name: string;
    position: number;
    isOptional: boolean;
    hasDefault: boolean;
    defaultValue?: any;
    type?: string;
    byref?: boolean;
}
export interface PHPPropertyMetadata {
    name: string;
    visibility: "public" | "protected" | "private";
    isStatic: boolean;
    isReadOnly: boolean;
    defaultValue?: any;
}
export interface PHPMethodMetadata {
    name: string;
    visibility: "public" | "protected" | "private";
    isStatic: boolean;
    isAbstract: boolean;
    isFinal: boolean;
    numberOfParameters: number;
    numberOfRequiredParameters: number;
    parameters: PHPParameterMetadata[];
    fn: Function;
}
export declare class PHPClass {
    readonly name: string;
    readonly parentClass?: PHPClass;
    nativeConstructor?: Function;
    readonly interfaces: PHPClass[];
    readonly traits: any[];
    constants: Record<string, any>;
    staticProperties: Record<string, any>;
    properties: Record<string, PHPPropertyMetadata>;
    methods: Record<string, PHPMethodMetadata>;
    isAbstract: boolean;
    isFinal: boolean;
    constructor(name: string, parentClass?: PHPClass | Function);
    isSubclassOf(className: string): boolean;
}
export declare class PHPObject {
    readonly phpClass: PHPClass;
    properties: Record<string, any>;
    private settingProperties;
    private gettingProperties;
    constructor(phpClass: PHPClass);
    getProperty(ctx: PHPContext, name: string): Promise<any>;
    setProperty(ctx: PHPContext, name: string, value: any): Promise<void>;
    callMethod(ctx: PHPContext, name: string, args: any[]): Promise<any>;
    toString(ctx: PHPContext): Promise<string>;
}
