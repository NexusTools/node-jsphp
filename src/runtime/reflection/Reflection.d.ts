export declare class ReflectionClass {
    readonly name: string;
    private phpClass?;
    constructor(nameOrInstance: any);
    getName(): string;
    isInstantiable(): boolean;
}
export declare class ReflectionMethod {
    readonly className: string;
    readonly methodName: string;
    constructor(className: string, methodName: string);
    getName(): string;
}
