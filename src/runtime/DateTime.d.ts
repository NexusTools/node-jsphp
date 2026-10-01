import type { PHPEngine } from "../PHPEngine";
export declare class DateTimeRuntime {
    private static defaultTimezone;
    static register(engine: PHPEngine): void;
    static time(): number;
    static microtime(getAsFloat?: boolean): string | number;
    static date(format: string, timestamp?: number): string;
    static strtotime(timeStr: string, now?: number): number | false;
    static date_default_timezone_get(): string;
    static date_default_timezone_set(timezoneId: string): boolean;
}
export declare class PHPDateTime {
    date: Date;
    constructor(timeStr?: string);
    format(format: string): string;
    getTimestamp(): number;
    setTimestamp(timestamp: number): this;
}
