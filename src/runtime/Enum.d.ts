import { PHPClass, PHPObject } from "./PHPObject";
import type { PHPEngine } from "../PHPEngine";
export declare class EnumRuntime {
    static register(engine: PHPEngine): void;
}
export declare class PHPEnum extends PHPObject {
    readonly name: string;
    readonly value?: any;
    constructor(enumClass: PHPClass, name: string, value?: any);
    static from(enumClass: PHPClass, value: any): PHPEnum;
    static tryFrom(enumClass: PHPClass, value: any): PHPEnum | null;
}
