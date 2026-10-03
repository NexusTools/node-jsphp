import { PHPContext } from "../PHPContext";
export declare class CoreRuntime {
    static functions: {
        exit: (ctx: PHPContext, statusArg?: any) => never;
        die: (ctx: PHPContext, statusArg?: any) => never;
        call_user_func: (ctx: PHPContext, callbackArg: any, ...args: any[]) => Promise<any>;
        call_user_func_array: (ctx: PHPContext, callbackArg: any, argsArg?: any) => Promise<any>;
        func_get_args: (ctx: PHPContext) => any[];
        func_get_arg: (ctx: PHPContext, indexArg?: any) => any;
        func_num_args: (ctx: PHPContext) => number;
        define: (ctx: PHPContext, nameArg: any, valueArg: any) => Promise<boolean>;
        defined: (ctx: PHPContext, nameArg: any) => boolean;
        extension_loaded: (ctx: PHPContext, nameArg: any) => boolean;
        function_exists: (ctx: PHPContext, nameArg: any) => boolean;
        class_alias: (ctx: PHPContext, original: string, alias: string, autoload?: boolean) => Promise<boolean>;
        class_exists: (ctx: PHPContext, name: string, autoload?: boolean) => Promise<boolean>;
        interface_exists: (ctx: PHPContext, name: string, autoload?: boolean) => Promise<boolean>;
        trait_exists: (ctx: PHPContext, name: string, autoload?: boolean) => Promise<boolean>;
        constant: (ctx: PHPContext, nameArg: any) => any;
        assert: (ctx: PHPContext, assertionArg: any, descriptionArg?: any) => boolean;
        is_callable: (ctx: PHPContext, vArg: any) => boolean;
        ini_get: (ctx: PHPContext, optionArg: any) => "" | "1" | "UTC" | "512M" | "30" | "64M";
        ini_set: (ctx: PHPContext, option: string, value: any) => string;
        register_shutdown_function: (ctx: PHPContext, callback: any, ...args: any[]) => boolean;
        register_tick_function: (ctx: PHPContext, callback: any, ...args: any[]) => boolean;
        unregister_tick_function: (ctx: PHPContext, callback: any) => boolean;
    };
    static register(engine: any): void;
}
