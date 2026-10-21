import type { PHPContext } from "../PHPContext.js";
export declare const SYMBOL_PHP_REFERENCE: unique symbol;
export declare const SYMBOL_PHP_VARIABLE: unique symbol;
export declare abstract class PHPReference {
    static [Symbol.hasInstance](value: unknown): boolean;
    abstract get(): Promise<any>;
    abstract set(value: any): Promise<any>;
    setFrom(otherref: PHPReference): Promise<any>;
    isset(): Promise<boolean>;
    unset(): Promise<void>;
}
export declare function isPHPReference(value: any): value is PHPReference;
export declare function isPHPVariable(value: any): boolean;
export declare class PHPLiteral extends PHPReference {
    private readonly value;
    constructor(value: any);
    get(): Promise<any>;
    set(_value: any): Promise<never>;
    toString(): string;
    valueOf(): any;
    [Symbol.toPrimitive](hint: string): any;
}
export declare class PHPPropertyReference extends PHPReference {
    private readonly ctx;
    private readonly obj;
    private readonly prop;
    private readonly phpName;
    constructor(ctx: PHPContext, obj: any, prop: string, phpName?: string);
    get(): Promise<any>;
    set(value: any): Promise<any>;
    isset(): Promise<boolean>;
    unset(): Promise<void>;
}
export declare class PHPArrayOffsetReference extends PHPReference {
    private readonly container;
    private readonly key;
    constructor(container: any, key: any);
    get(): Promise<any>;
    set(value: any): Promise<any>;
}
export declare class PHPVariable extends PHPReference {
    private value;
    constructor(initialValue?: any);
    get(): Promise<any>;
    set(value: any): Promise<any>;
    setFrom(otherref: PHPReference): Promise<any>;
    toString(): string;
    valueOf(): any;
    [Symbol.toPrimitive](hint: string): any;
}
