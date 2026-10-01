import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
export declare class DateTimeRuntime {
    private static defaultTimezone;
    static time(ctx?: PHPContext): number;
    static microtime(ctx?: PHPContext, getAsFloat?: boolean): string | number;
    static date(ctx: PHPContext | null, format: string, timestamp?: number): string;
    static strtotime(ctx: PHPContext | null, timeStr: string, now?: number): number | false;
    static date_default_timezone_get(ctx?: PHPContext): string;
    static date_default_timezone_set(ctx: PHPContext | null, timezoneId: string): boolean;
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
    getTimestamp(): number;
    setTimestamp(timestamp: number): this;
}
