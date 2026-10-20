import type { PHPContext } from "../PHPContext.js";
export declare abstract class PHPReference {
    readonly __isPHPReference: boolean;
    abstract get(): any;
    abstract set(val: any): any;
    bindRef?(target: PHPReference): void;
    unbindRef?(): void;
    isReference?(): boolean;
    call?(ctx: PHPContext, method: string, args: any[]): Promise<any>;
}
export declare function isPHPReference(val: any): val is PHPReference;
export declare function isPHPVariable(val: any): boolean;
export declare class PHPLiteral extends PHPReference {
    readonly __isPHPLiteral: boolean;
    private readonly value;
    constructor(value: any);
    get(): any;
    set(val: any): any;
    bindRef(target: PHPReference): void;
    unbindRef(): void;
    isReference(): boolean;
    call(ctx: PHPContext, method: string, args?: any[]): Promise<any>;
    toString(): string;
    valueOf(): any;
    [Symbol.toPrimitive](hint: string): any;
}
export declare class PHPPropertyReference extends PHPReference {
    private ctx;
    private obj;
    private prop;
    constructor(ctx: PHPContext, obj: any, prop: string);
    get(): any;
    set(val: any): any;
}
export declare class PHPArrayOffsetReference extends PHPReference {
    private container;
    private key;
    constructor(container: any, key: any);
    get(): any;
    set(val: any): any;
}
export declare class PHPVariable extends PHPReference {
    readonly __isPHPVariable: boolean;
    private value;
    private refTarget?;
    constructor(initialValue?: any);
    get(): any;
    set(val: any): any;
    bindRef(target: PHPReference): void;
    unbindRef(): void;
    isReference(): boolean;
    call(ctx: PHPContext, method: string, args?: any[]): Promise<any>;
    toString(): string;
    valueOf(): any;
    [Symbol.toPrimitive](hint: string): any;
}
