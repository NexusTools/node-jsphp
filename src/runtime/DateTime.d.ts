import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW } from "./Reflection.js";
export declare class PHPDateTimeZone {
    static [SYMBOL_PHP_NAME]: string;
    static [SYMBOL_PHP_CONSTANTS]: {
        africa: number;
        america: number;
        antarctica: number;
        arctic: number;
        asia: number;
        atlantic: number;
        australia: number;
        europe: number;
        indian: number;
        pacific: number;
        utc: number;
        all: number;
        all_with_bc: number;
        per_country: number;
    };
    timezone: string;
    constructor(timezone?: string);
    static [SYMBOL_PHP_NEW](ctx: PHPContext, timezoneArg?: PHPReference): Promise<PHPDateTimeZone>;
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
    static [SYMBOL_PHP_NEW](ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<PHPDateTime>;
    __construct(ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<void>;
    format(ctxOrFormat?: any, formatArg?: any): Promise<string>;
    modify(ctxOrMod?: any, modArg?: any): PHPDateTime;
    setTimezone(ctxOrTz?: any, tzArg?: any): PHPDateTime;
    settimezone(ctxOrTz?: any, tzArg?: any): PHPDateTime;
    getTimezone(): PHPDateTimeZone | false;
    gettimezone(): PHPDateTimeZone | false;
    getTimestamp(): number;
    gettimestamp(): number;
    getOffset(): number;
    getoffset(): number;
    static createFromFormat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTime | false;
    static createfromformat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTime | false;
    setTimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime;
    settimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime;
}
export declare class PHPDateTimeImmutable extends PHPDateTime {
    static [SYMBOL_PHP_NAME]: string;
    modify(ctxOrMod?: any, modArg?: any): PHPDateTimeImmutable;
    static createFromMutable(ctxOrDt?: any, dtArg?: any): Promise<PHPDateTimeImmutable>;
    static createfrommutable(ctxOrDt?: any, dtArg?: any): Promise<PHPDateTimeImmutable>;
    static createFromFormat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTimeImmutable | false;
    static createfromformat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTimeImmutable | false;
}
export declare class DateTimeRuntime {
    private static defaultTimezone;
    static checkdate(ctx: PHPContext, monthArg?: any, dayArg?: any, yearArg?: any): Promise<boolean>;
    static time(ctx?: PHPContext): Promise<number>;
    static microtime(ctx?: PHPContext, getAsFloatArg?: PHPReference): Promise<string | number>;
    static date(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): Promise<string>;
    static strtotime(ctx: PHPContext | null, timeStrArg?: PHPReference, nowArg?: PHPReference): Promise<number | false>;
    static date_default_timezone_get(ctx?: PHPContext): Promise<string>;
    static date_default_timezone_set(ctx: PHPContext | null, timezoneIdArg?: PHPReference): Promise<boolean>;
    static timezone_identifiers_list(ctx: PHPContext | null, timezoneGroupArg?: PHPReference, countryCodeArg?: PHPReference): Promise<string[]>;
    static gmdate(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): Promise<string>;
    static date_create(ctx: PHPContext, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTime | false>;
    static date_create_immutable(ctx: PHPContext, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTimeImmutable | false>;
    static date_create_from_format(ctx: PHPContext, formatArg?: any, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTime | false>;
    static date_create_immutable_from_format(ctx: PHPContext, formatArg?: any, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTimeImmutable | false>;
    static functions: {
        checkdate: typeof DateTimeRuntime.checkdate;
        time: typeof DateTimeRuntime.time;
        microtime: typeof DateTimeRuntime.microtime;
        date: typeof DateTimeRuntime.date;
        gmdate: typeof DateTimeRuntime.gmdate;
        strtotime: typeof DateTimeRuntime.strtotime;
        date_create: typeof DateTimeRuntime.date_create;
        date_create_immutable: typeof DateTimeRuntime.date_create_immutable;
        date_create_from_format: typeof DateTimeRuntime.date_create_from_format;
        date_create_immutable_from_format: typeof DateTimeRuntime.date_create_immutable_from_format;
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
