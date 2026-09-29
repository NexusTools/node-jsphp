export declare class ArrayRuntime {
    static count(arrayOrCountable: any): number;
    static array_keys(input: any): any[];
    static array_values(input: any): any[];
    static array_flip(input: any): Record<string, any>;
    static array_reverse(array: any[]): any[];
    static in_array(needle: any, haystack: any, strict?: boolean): boolean;
    static array_search(needle: any, haystack: any, strict?: boolean): any | false;
    static array_key_exists(key: any, search: any): boolean;
    static array_merge(...arrays: any[]): any;
    static array_combine(keys: any[], values: any[]): Record<string, any> | false;
    static array_slice(array: any[], offset: number, length?: number): any[];
    static array_push(array: any[], ...varargs: any[]): number;
    static array_pop(array: any[]): any;
    static array_shift(array: any[]): any;
    static array_unshift(array: any[], ...varargs: any[]): number;
    static array_unique(array: any[]): any[];
    static array_column(array: any[], columnKey: string | number): any[];
    static sort(array: any[]): boolean;
    static rsort(array: any[]): boolean;
}
