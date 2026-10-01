import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
export declare class VariablesRuntime {
    /**
     * Serializes a value into a PHP-compatible serialized string representation.
     */
    static serialize(ctx: PHPContext | null, value: any): string;
    /**
     * Dumps information about one or more variables.
     */
    static var_dump(ctx: any, ...args: any[]): void;
    /**
     * Prints human-readable information about a variable.
     */
    static print_r(ctx: any, val: any, returnVal?: boolean): string | true;
    /** Finds whether a variable is an array. */
    static is_array(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is a boolean. */
    static is_bool(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is a float. */
    static is_float(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is an integer. */
    static is_int(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is NULL. */
    static is_null(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is a number or a numeric string. */
    static is_numeric(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is an object. */
    static is_object(ctx: PHPContext | null, val: any): boolean;
    /** Gets the properties of the given object. */
    static get_object_vars(ctx: PHPContext | null, value: any): Record<string, any>;
    /** Finds whether a variable is a scalar. */
    static is_scalar(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is a string. */
    static is_string(ctx: PHPContext | null, val: any): boolean;
    /** Verify that the contents of a variable is an iterable value. */
    static is_iterable(ctx: PHPContext | null, val: any): boolean;
    /** Verify that the contents of a variable is a countable value. */
    static is_countable(ctx: PHPContext | null, val: any): boolean;
    /** Finds whether a variable is a resource. */
    static is_resource(ctx: PHPContext | null, val: any): boolean;
    /** Get the type of a variable. */
    static gettype(ctx: PHPContext | null, val: any): string;
    /** Returns the name of the class of an object. */
    static get_class(ctx: PHPContext | null, val: any): string | false;
    /** Gets a prefixed unique identifier based on the current time in microseconds. */
    static uniqid(ctx: PHPContext | null, prefix?: string, moreEntropy?: boolean): string;
    /** Get the integer value of a variable. */
    static intval(ctx: PHPContext | null, val: any, base?: number): number;
    /** Get float value of a variable. */
    static floatval(ctx: PHPContext | null, val: any): number;
    /** Get string value of a variable. */
    static strval(ctx: PHPContext | null, val: any): string;
    /** Get the boolean value of a variable. */
    static boolval(ctx: PHPContext | null, val: any): boolean;
    static functions: {
        var_dump: typeof VariablesRuntime.var_dump;
        print_r: typeof VariablesRuntime.print_r;
        is_array: typeof VariablesRuntime.is_array;
        is_bool: typeof VariablesRuntime.is_bool;
        is_float: typeof VariablesRuntime.is_float;
        is_int: typeof VariablesRuntime.is_int;
        is_null: typeof VariablesRuntime.is_null;
        is_numeric: typeof VariablesRuntime.is_numeric;
        is_object: typeof VariablesRuntime.is_object;
        is_scalar: typeof VariablesRuntime.is_scalar;
        is_string: typeof VariablesRuntime.is_string;
        is_iterable: typeof VariablesRuntime.is_iterable;
        is_countable: typeof VariablesRuntime.is_countable;
        is_resource: typeof VariablesRuntime.is_resource;
        gettype: typeof VariablesRuntime.gettype;
        get_class: typeof VariablesRuntime.get_class;
        get_object_vars: typeof VariablesRuntime.get_object_vars;
        serialize: typeof VariablesRuntime.serialize;
        uniqid: typeof VariablesRuntime.uniqid;
        intval: typeof VariablesRuntime.intval;
        floatval: typeof VariablesRuntime.floatval;
        strval: typeof VariablesRuntime.strval;
        boolval: typeof VariablesRuntime.boolval;
    };
    static register(engine: PHPEngine): void;
}
