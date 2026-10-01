import type { PHPEngine } from "../PHPEngine";
export declare class VariablesRuntime {
    static register(engine: PHPEngine): void;
    static serialize(value: any): string;
    static var_dump(ctx: any, ...args: any[]): void;
    static print_r(ctx: any, val: any, returnVal?: boolean): string | true;
    static is_array(val: any): boolean;
    static is_bool(val: any): boolean;
    static is_float(val: any): boolean;
    static is_int(val: any): boolean;
    static is_null(val: any): boolean;
    static is_numeric(val: any): boolean;
    static is_object(val: any): boolean;
    static get_object_vars(value: any): Record<string, any>;
    static is_scalar(val: any): boolean;
    static is_string(val: any): boolean;
    static gettype(val: any): string;
    static intval(val: any, base?: number): number;
    static floatval(val: any): number;
    static strval(val: any): string;
    static boolval(val: any): boolean;
}
