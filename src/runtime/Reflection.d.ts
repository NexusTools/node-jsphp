import type { PHPContext } from "../PHPContext.js";
import type { PHPEngine } from "../PHPEngine.js";
import { PHPReference } from "./PHPVariable.js";
export declare const SYMBOL_PHP_META: unique symbol;
export declare const SYMBOL_PHP_NAME: unique symbol;
export declare const SYMBOL_PHP_CONSTANTS: unique symbol;
export declare const SYMBOL_PHP_PROPERTIES: unique symbol;
export declare const SYMBOL_PHP_METHODS: unique symbol;
export declare const SYMBOL_PHP_CLASS: unique symbol;
export declare const SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS: unique symbol;
export declare const SYMBOL_PHP_CLASS_INTERFACES: unique symbol;
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
    fn?: Function;
}
export interface FunctionMetaOptions {
    name: string;
    visibility?: "public" | "protected" | "private";
    parameters?: {
        name: string;
        byref?: boolean;
        isOptional?: boolean;
        hasDefault?: boolean;
        defaultValue?: any;
        type?: string;
    }[];
}
export declare function defineFunction<T extends Function>(fn: T, meta: FunctionMetaOptions): T;
export declare function parseJSFunctionMetadata(fn?: Function, name?: string): any;
export declare class Reflection {
    static getModifierNames(ctx: PHPContext, modifiersArg?: PHPReference): string[];
}
export declare class ReflectionType {
    typeName: string;
    allowsNullFlag: boolean;
    static __$$__new(ctx: PHPContext, typeNameArg?: PHPReference, allowsNullFlagArg?: PHPReference): Promise<ReflectionType>;
    static __construct(this: ReflectionType, ctx: PHPContext, typeNameArg?: PHPReference, allowsNullFlagArg?: PHPReference): Promise<void>;
    allowsNull(ctx: PHPContext): boolean;
    getName(ctx: PHPContext): string;
    __toString(ctx: PHPContext): string;
}
export declare class ReflectionParameter {
    paramName: string;
    paramPosition: number;
    defaultValue: any;
    hasDefault: boolean;
    static __$$__new(ctx: PHPContext, nameArg?: PHPReference, positionArg?: PHPReference, defaultValueArg?: PHPReference, hasDefaultArg?: PHPReference): Promise<ReflectionParameter>;
    static __construct(this: ReflectionParameter, ctx: PHPContext, nameArg?: PHPReference, positionArg?: PHPReference, defaultValueArg?: PHPReference, hasDefaultArg?: PHPReference): Promise<void>;
    getName(ctx: PHPContext): string;
    getPosition(ctx: PHPContext): number;
    isOptional(ctx: PHPContext): boolean;
    isDefaultValueAvailable(ctx: PHPContext): boolean;
    getDefaultValue(ctx: PHPContext): any;
    isPassedByReference(ctx: PHPContext): boolean;
    getType(ctx: PHPContext): Promise<ReflectionType>;
}
export declare class ReflectionProperty {
    name: string;
    declaringClassName: string;
    meta?: PHPPropertyMetadata;
    isAccessible: boolean;
    static __$$__new(ctx: PHPContext, classArg?: PHPReference, nameArg?: PHPReference, metaArg?: PHPReference): Promise<ReflectionProperty>;
    static __construct(this: ReflectionProperty, ctx: PHPContext, classArg?: PHPReference, nameArg?: PHPReference, metaArg?: PHPReference): Promise<void>;
    getName(ctx: PHPContext): string;
    getDeclaringClass(ctx: PHPContext): Promise<ReflectionClass>;
    isPublic(ctx: PHPContext): boolean;
    isProtected(ctx: PHPContext): boolean;
    isPrivate(ctx: PHPContext): boolean;
    isStatic(ctx: PHPContext): boolean;
    isReadOnly(ctx: PHPContext): boolean;
    setAccessible(ctx: PHPContext, accessibleArg?: PHPReference): void;
    getValue(ctx: PHPContext, objArg?: PHPReference): Promise<any>;
    setValue(ctx: PHPContext, objArg?: PHPReference, valArg?: PHPReference): Promise<void>;
}
export declare class ReflectionMethod {
    className: string;
    methodName: string;
    meta: PHPMethodMetadata;
    static __$$__new(ctx: PHPContext, classArg?: PHPReference, methodArg?: PHPReference, metaArg?: PHPReference, fnArg?: PHPReference): Promise<ReflectionMethod>;
    static __construct(this: ReflectionMethod, ctx: PHPContext, classArg?: PHPReference, methodArg?: PHPReference, metaArg?: PHPReference, fnArg?: PHPReference): Promise<void>;
    getName(ctx: PHPContext): string;
    getDeclaringClass(ctx: PHPContext): Promise<ReflectionClass>;
    isPublic(ctx: PHPContext): boolean;
    isProtected(ctx: PHPContext): boolean;
    isPrivate(ctx: PHPContext): boolean;
    isStatic(ctx: PHPContext): boolean;
    isAbstract(ctx: PHPContext): boolean;
    isFinal(ctx: PHPContext): boolean;
    isConstructor(ctx: PHPContext): boolean;
    isDestructor(ctx: PHPContext): boolean;
    getNumberOfParameters(ctx: PHPContext): number;
    getNumberOfRequiredParameters(ctx: PHPContext): number;
    getParameters(ctx: PHPContext): Promise<ReflectionParameter[]>;
    setAccessible(ctx: PHPContext, accessibleArg?: PHPReference): void;
    invoke(ctx: PHPContext, objectArg?: PHPReference, ...args: PHPReference[]): Promise<any>;
    invokeArgs(ctx: PHPContext, objectArg?: PHPReference, argsArg?: PHPReference): Promise<any>;
}
export declare class ReflectionFunction {
    name: string;
    meta: any;
    static __$$__new(ctx: PHPContext, nameArg?: PHPReference, fnOrCtxArg?: PHPReference): Promise<ReflectionFunction>;
    static __construct(this: ReflectionFunction, ctx: PHPContext, nameArg?: PHPReference, fnOrCtxArg?: PHPReference): Promise<void>;
    getName(ctx: PHPContext): string;
    getNamespaceName(ctx: PHPContext): string;
    inNamespace(ctx: PHPContext): boolean;
    getNumberOfParameters(ctx: PHPContext): number;
    getNumberOfRequiredParameters(ctx: PHPContext): number;
    getParameters(ctx: PHPContext): Promise<ReflectionParameter[]>;
    invoke(ctx: PHPContext, ...args: PHPReference[]): Promise<any>;
    invokeArgs(ctx: PHPContext, argsArg?: PHPReference): Promise<any>;
}
export declare class ReflectionClass {
    name: string;
    private phpClass?;
    static __$$__new(ctx: PHPContext, nameOrInstanceArg?: PHPReference): Promise<ReflectionClass>;
    static __construct(this: ReflectionClass, ctx: PHPContext, nameOrInstanceArg?: PHPReference): Promise<void>;
    getName(ctx: PHPContext): string;
    getShortName(ctx: PHPContext): string;
    getNamespaceName(ctx: PHPContext): string;
    inNamespace(ctx: PHPContext): boolean;
    getParentClass(ctx: PHPContext): Promise<ReflectionClass | false>;
    isInterface(ctx: PHPContext): boolean;
    isAbstract(ctx: PHPContext): boolean;
    isFinal(ctx: PHPContext): boolean;
    isInstantiable(ctx: PHPContext): boolean;
    isSubclassOf(ctx: PHPContext, classNameArg?: PHPReference): boolean;
    hasMethod(ctx: PHPContext, nameArg?: PHPReference): boolean;
    getMethod(ctx: PHPContext, nameArg?: PHPReference): Promise<ReflectionMethod>;
    getMethods(ctx: PHPContext): Promise<ReflectionMethod[]>;
    hasProperty(ctx: PHPContext, nameArg?: PHPReference): boolean;
    getProperty(ctx: PHPContext, nameArg?: PHPReference): Promise<ReflectionProperty>;
    getProperties(ctx: PHPContext): Promise<ReflectionProperty[]>;
    hasConstant(ctx: PHPContext, nameArg?: PHPReference): boolean;
    getConstant(ctx: PHPContext, nameArg?: PHPReference): any;
    getConstants(ctx: PHPContext): Record<string, any>;
    newInstance(ctx: PHPContext, ...args: PHPReference[]): Promise<any>;
    newInstanceArgs(ctx: PHPContext, argsArg?: PHPReference): Promise<any>;
    newInstanceWithoutConstructor(ctx: PHPContext): Promise<any>;
}
export declare class ReflectionRuntime {
    static classes: {
        reflectionclass: typeof ReflectionClass;
        reflectionmethod: typeof ReflectionMethod;
        reflectionproperty: typeof ReflectionProperty;
        reflectionfunction: typeof ReflectionFunction;
        reflectionparameter: typeof ReflectionParameter;
        reflectiontype: typeof ReflectionType;
    };
    static register(engine: PHPEngine): void;
}
