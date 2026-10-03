import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
import { PHPReference } from "./PHPVariable";
export declare class VariablesRuntime {
    /**
     * Serializes a value into a PHP-compatible serialized string representation.
     */
    static serialize(ctx: PHPContext | null, valueArg?: PHPReference): string;
    /**
     * Dumps information about one or more variables.
     */
    static var_dump(ctx: any, ...args: PHPReference[]): void;
    /**
     * Prints human-readable information about a variable.
     */
    static print_r(ctx: any, valArg?: PHPReference, returnValArg?: PHPReference): string | true;
    /** Finds whether a variable is an array. */
    static is_array(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is a boolean. */
    static is_bool(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is a float. */
    static is_float(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is an integer. */
    static is_int(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is NULL. */
    static is_null(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is a number or a numeric string. */
    static is_numeric(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is an object. */
    static is_object(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Gets the properties of the given object. */
    static get_object_vars(ctx: PHPContext | null, valueArg?: PHPReference): Record<string, any>;
    /** Finds whether a variable is a scalar. */
    static is_scalar(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is a string. */
    static is_string(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Verify that the contents of a variable is an iterable value. */
    static is_iterable(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Verify that the contents of a variable is a countable value. */
    static is_countable(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Finds whether a variable is a resource. */
    static is_resource(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    /** Get the type of a variable. */
    static gettype(ctx: PHPContext | null, valArg?: PHPReference): string;
    /** Returns the name of the class of an object. */
    static get_class(ctx: PHPContext | null, valArg?: PHPReference): string | false;
    /** Gets a prefixed unique identifier based on the current time in microseconds. */
    static uniqid(ctx: PHPContext | null, prefixArg?: PHPReference, moreEntropyArg?: PHPReference): string;
    /** Get the integer value of a variable. */
    static intval(ctx: PHPContext | null, valArg?: PHPReference, baseArg?: PHPReference): number;
    /** Get float value of a variable. */
    static floatval(ctx: PHPContext | null, valArg?: PHPReference): number;
    /** Get string value of a variable. */
    static strval(ctx: PHPContext | null, valArg?: PHPReference): string;
    /** Get the boolean value of a variable. */
    static boolval(ctx: PHPContext | null, valArg?: PHPReference): boolean;
    static compact(ctx: PHPContext, ...args: PHPReference[]): Record<string, any>;
    static extract(ctx: PHPContext, arrayArg?: PHPReference): number;
    static var_export(ctx: PHPContext, valArg?: PHPReference, returnArg?: PHPReference): string | true;
    static functions: {
        var_dump: typeof VariablesRuntime.var_dump;
        print_r: typeof VariablesRuntime.print_r;
        var_export: typeof VariablesRuntime.var_export;
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
        compact: typeof VariablesRuntime.compact;
        extract: typeof VariablesRuntime.extract;
    };
    static register(engine: PHPEngine): void;
}
