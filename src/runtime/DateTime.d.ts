import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";
export declare class PHPDateTimeZone {
    static [SYMBOL_PHP_NAME]: string;
    static __php_constants: Map<string, number>;
    timezone: string;
    constructor(timezone?: string);
    static __$$__new(ctx: PHPContext, timezoneArg?: PHPReference): Promise<PHPDateTimeZone>;
    __construct(ctx: PHPContext, timezoneArg?: PHPReference): Promise<void>;
    getName(): string;
    getname(): string;
    getOffset(datetimeArg?: any): number;
    getoffset(datetimeArg?: any): number;
}
export declare class PHPDateTime {
    static [SYMBOL_PHP_NAME]: string;
    date: Date;
    timezone?: PHPDateTimeZone;
    constructor(timeStr?: string, timezone?: PHPDateTimeZone);
    static __$$__new(ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<PHPDateTime>;
    __construct(ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<void>;
    format(ctxOrFormat?: any, formatArg?: any): string;
    setTimezone(ctxOrTz?: any, tzArg?: any): PHPDateTime;
    settimezone(ctxOrTz?: any, tzArg?: any): PHPDateTime;
    getTimezone(): PHPDateTimeZone | false;
    gettimezone(): PHPDateTimeZone | false;
    getTimestamp(): number;
    gettimestamp(): number;
    setTimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime;
    settimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime;
}
export declare class PHPDateTimeImmutable extends PHPDateTime {
    static [SYMBOL_PHP_NAME]: string;
    static createFromMutable(ctxOrDt?: any, dtArg?: any): Promise<PHPDateTimeImmutable>;
    static createfrommutable(ctxOrDt?: any, dtArg?: any): Promise<PHPDateTimeImmutable>;
}
export declare class DateTimeRuntime {
    private static defaultTimezone;
    static time(ctx?: PHPContext): number;
    static microtime(ctx?: PHPContext, getAsFloatArg?: PHPReference): string | number;
    static date(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): string;
    static strtotime(ctx: PHPContext | null, timeStrArg?: PHPReference, nowArg?: PHPReference): number | false;
    static date_default_timezone_get(ctx?: PHPContext): string;
    static date_default_timezone_set(ctx: PHPContext | null, timezoneIdArg?: PHPReference): boolean;
    static timezone_identifiers_list(ctx: PHPContext | null, timezoneGroupArg?: PHPReference, countryCodeArg?: PHPReference): string[];
    static gmdate(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): string;
    static functions: {
        time: typeof DateTimeRuntime.time;
        microtime: typeof DateTimeRuntime.microtime;
        date: typeof DateTimeRuntime.date;
        gmdate: typeof DateTimeRuntime.gmdate;
        strtotime: typeof DateTimeRuntime.strtotime;
        date_default_timezone_get: typeof DateTimeRuntime.date_default_timezone_get;
        date_default_timezone_set: typeof DateTimeRuntime.date_default_timezone_set;
        timezone_identifiers_list: typeof DateTimeRuntime.timezone_identifiers_list;
    };
    static classes: {
        datetime: typeof PHPDateTime;
        datetimezone: typeof PHPDateTimeZone;
        datetimeimmutable: typeof PHPDateTimeImmutable;
    };
    static register(engine: PHPEngine): void;
}
