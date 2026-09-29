export interface UnitEnum {
    name: string;
}
export interface BackedEnum extends UnitEnum {
    value: string | number;
}
export declare class PHPEnum implements BackedEnum {
    name: string;
    value: string | number;
    constructor(name: string, value: string | number);
    static cases(enumClass: any): UnitEnum[];
    static from(enumClass: any, value: string | number): BackedEnum;
    static tryFrom(enumClass: any, value: string | number): BackedEnum | null;
}
