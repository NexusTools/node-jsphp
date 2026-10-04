import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPReference } from "./PHPVariable.js";
export declare class DateTimeRuntime {
    private static defaultTimezone;
    static time(ctx?: PHPContext): number;
    static microtime(ctx?: PHPContext, getAsFloatArg?: PHPReference): string | number;
    static date(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): string;
    static strtotime(ctx: PHPContext | null, timeStrArg?: PHPReference, nowArg?: PHPReference): number | false;
    static date_default_timezone_get(ctx?: PHPContext): string;
    static date_default_timezone_set(ctx: PHPContext | null, timezoneIdArg?: PHPReference): boolean;
    static functions: {
        time: typeof DateTimeRuntime.time;
        microtime: typeof DateTimeRuntime.microtime;
        date: typeof DateTimeRuntime.date;
        strtotime: typeof DateTimeRuntime.strtotime;
        date_default_timezone_get: typeof DateTimeRuntime.date_default_timezone_get;
        date_default_timezone_set: typeof DateTimeRuntime.date_default_timezone_set;
    };
    static classes: {
        datetime: () => typeof PHPDateTime;
    };
    static register(engine: PHPEngine): void;
}
export declare class PHPDateTime {
    date: Date;
    constructor(timeStr?: string);
    format(format: string): string;
}
