import { PHPClass, PHPObject } from "../objects/PHPObject";
export declare class PHPEnum extends PHPObject {
    readonly name: string;
    readonly value?: any;
    constructor(enumClass: PHPClass, name: string, value?: any);
    static from(enumClass: PHPClass, value: any): PHPEnum;
    static tryFrom(enumClass: PHPClass, value: any): PHPEnum | null;
}
