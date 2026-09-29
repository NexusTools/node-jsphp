import { PHPObject, PHPMethodMetadata, PHPPropertyMetadata } from "../objects/PHPObject";
import type { PHPContext } from "../../PHPContext";
export interface FunctionMetaOptions {
    name: string;
    visibility?: "public" | "protected" | "private";
    parameters?: {
        name: string;
        isOptional?: boolean;
        hasDefault?: boolean;
        defaultValue?: any;
        type?: string;
    }[];
}
export declare function defineFunction<T extends Function>(fn: T, meta: FunctionMetaOptions): T;
export declare function parseJSFunctionMetadata(fn?: Function, name?: string): any;
export declare class Reflection {
    static getModifierNames(modifiers: number): string[];
}
export declare class ReflectionType {
    readonly typeName: string;
    readonly allowsNullFlag: boolean;
    constructor(typeName?: string, allowsNullFlag?: boolean);
    allowsNull(): boolean;
    getName(): string;
    __toString(): string;
}
export declare class ReflectionParameter {
    readonly paramName: string;
    readonly paramPosition: number;
    readonly defaultValue: any;
    readonly hasDefault: boolean;
    constructor(name: string, position: number, defaultValue?: any, hasDefault?: boolean);
    getName(): string;
    getPosition(): number;
    isOptional(): boolean;
    isDefaultValueAvailable(): boolean;
    getDefaultValue(): any;
    isPassedByReference(): boolean;
    getType(): ReflectionType;
}
export declare class ReflectionProperty {
    readonly name: string;
    readonly declaringClassName: string;
    readonly meta?: PHPPropertyMetadata;
    isAccessible: boolean;
    constructor(declaringClassName: string, name: string, meta?: PHPPropertyMetadata);
    getName(): string;
    getDeclaringClass(): ReflectionClass;
    isPublic(): boolean;
    isProtected(): boolean;
    isPrivate(): boolean;
    isStatic(): boolean;
    isReadOnly(): boolean;
    setAccessible(accessible: boolean): void;
    getValue(ctx: PHPContext, obj: PHPObject): Promise<any>;
    setValue(ctx: PHPContext, obj: PHPObject, val: any): Promise<void>;
}
export declare class ReflectionMethod {
    readonly className: string;
    readonly methodName: string;
    readonly meta: PHPMethodMetadata;
    constructor(className: string, methodName: string, meta?: PHPMethodMetadata, fn?: Function);
    getName(): string;
    getDeclaringClass(): ReflectionClass;
    isPublic(): boolean;
    isProtected(): boolean;
    isPrivate(): boolean;
    isStatic(): boolean;
    isAbstract(): boolean;
    isFinal(): boolean;
    isConstructor(): boolean;
    isDestructor(): boolean;
    getNumberOfParameters(): number;
    getNumberOfRequiredParameters(): number;
    getParameters(): ReflectionParameter[];
    setAccessible(accessible: boolean): void;
    invoke(ctx: PHPContext, object: PHPObject | null, ...args: any[]): Promise<any>;
}
export declare class ReflectionFunction {
    readonly name: string;
    readonly meta: any;
    constructor(name: string, fnOrCtx?: Function | any);
    getName(): string;
    getNamespaceName(): string;
    inNamespace(): boolean;
    getNumberOfParameters(): number;
    getNumberOfRequiredParameters(): number;
    getParameters(): ReflectionParameter[];
    invoke(ctx: PHPContext, ...args: any[]): Promise<any>;
    invokeArgs(ctx: PHPContext, args: any[]): Promise<any>;
}
export declare class ReflectionClass {
    readonly name: string;
    private phpClass?;
    constructor(nameOrInstance: any);
    getName(): string;
    getShortName(): string;
    getNamespaceName(): string;
    inNamespace(): boolean;
    getParentClass(): ReflectionClass | false;
    isInterface(): boolean;
    isAbstract(): boolean;
    isFinal(): boolean;
    isInstantiable(): boolean;
    isSubclassOf(className: string): boolean;
    hasMethod(name: string): boolean;
    getMethod(name: string): ReflectionMethod;
    getMethods(): ReflectionMethod[];
    hasProperty(name: string): boolean;
    getProperty(name: string): ReflectionProperty;
    getProperties(): ReflectionProperty[];
    hasConstant(name: string): boolean;
    getConstant(name: string): any;
    getConstants(): Record<string, any>;
    newInstance(ctx: PHPContext, ...args: any[]): Promise<PHPObject>;
    newInstanceArgs(ctx: PHPContext, args?: any[]): Promise<PHPObject>;
    newInstanceWithoutConstructor(ctx: PHPContext): Promise<PHPObject>;
}
