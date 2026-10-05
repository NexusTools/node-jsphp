import type { PHPEngine } from "../PHPEngine.js";
export declare class EnumRuntime {
    static register(engine: PHPEngine): void;
}
export declare class PHPEnum {
    name: string;
    value?: any;
    static __$$__new(ctx: any, nameArg?: any, valueArg?: any): Promise<PHPEnum>;
    __construct(ctx: any, nameArg?: any, valueArg?: any): Promise<void>;
    static from(enumClass: any, value: any): PHPEnum;
    static tryFrom(enumClass: any, value: any): PHPEnum | null;
}
