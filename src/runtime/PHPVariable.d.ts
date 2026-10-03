import type { PHPContext } from "../PHPContext";
export interface PHPReference {
    get(): any;
    set(val: any): any;
    bindRef?(target: PHPReference): void;
    unbindRef?(): void;
    isReference?(): boolean;
    call?(ctx: PHPContext, method: string, args: any[]): Promise<any>;
}
export declare class PHPLiteral implements PHPReference {
    private readonly value;
    constructor(value: any);
    get(): any;
    set(val: any): any;
    bindRef(target: PHPReference): void;
    unbindRef(): void;
    isReference(): boolean;
    call(ctx: PHPContext, method: string, args?: any[]): Promise<any>;
}
export declare class PHPVariable implements PHPReference {
    private value;
    private refTarget?;
    constructor(initialValue?: any);
    get(): any;
    set(val: any): any;
    bindRef(target: PHPReference): void;
    unbindRef(): void;
    isReference(): boolean;
    call(ctx: PHPContext, method: string, args?: any[]): Promise<any>;
}
