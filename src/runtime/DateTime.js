import { PHPLiteral } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";
export class PHPDateTimeZone {
    static [SYMBOL_PHP_NAME] = "DateTimeZone";
    static __php_constants = new Map([
        ["africa", 1],
        ["america", 2],
        ["antarctica", 4],
        ["arctic", 8],
        ["asia", 16],
        ["atlantic", 32],
        ["australia", 64],
        ["europe", 128],
        ["indian", 256],
        ["pacific", 512],
        ["utc", 1024],
        ["all", 2047],
        ["all_with_bc", 4095],
        ["per_country", 4096],
    ]);
    timezone = "UTC";
    constructor(timezone = "UTC") {
        this.timezone = timezone;
    }
    static async __$$__new(ctx, timezoneArg) {
        const obj = Object.create(this.prototype);
        obj.timezone = "UTC";
        await obj.__construct(ctx, timezoneArg);
        return obj;
    }
    async __construct(ctx, timezoneArg) {
        const tz = timezoneArg?.get ? timezoneArg.get() : timezoneArg;
        this.timezone = String(tz ?? "UTC");
    }
    getName() {
        return this.timezone;
    }
    getname() { return this.getName(); }
    getOffset(datetimeArg) {
        return 0;
    }
    getoffset(datetimeArg) { return this.getOffset(datetimeArg); }
}
export class PHPDateTime {
    static [SYMBOL_PHP_NAME] = "DateTime";
    date;
    timezone;
    constructor(timeStr = "now", timezone) {
        this.date = timeStr === "now" ? new Date() : new Date(Date.parse(timeStr) || Date.now());
        this.timezone = timezone;
    }
    static async __$$__new(ctx, timeStrArg, timezoneArg) {
        const obj = Object.create(this.prototype);
        obj.date = new Date();
        await obj.__construct(ctx, timeStrArg, timezoneArg);
        return obj;
    }
    async __construct(ctx, timeStrArg, timezoneArg) {
        const timeStr = timeStrArg?.get ? timeStrArg.get() : timeStrArg;
        const tz = timezoneArg?.get ? timezoneArg.get() : timezoneArg;
        this.date = !timeStr || timeStr === "now" ? new Date() : new Date(Date.parse(String(timeStr)) || Date.now());
        if (tz instanceof PHPDateTimeZone) {
            this.timezone = tz;
        }
    }
    format(ctxOrFormat, formatArg) {
        const fmt = typeof ctxOrFormat === "string" ? ctxOrFormat : String(formatArg?.get ? formatArg.get() : (formatArg || "Y-m-d H:i:s"));
        return DateTimeRuntime.date(null, new PHPLiteral(fmt), new PHPLiteral(Math.floor(this.date.getTime() / 1000)));
    }
    setTimezone(ctxOrTz, tzArg) {
        const tz = tzArg?.get ? tzArg.get() : (tzArg || ctxOrTz);
        if (tz instanceof PHPDateTimeZone) {
            this.timezone = tz;
        }
        return this;
    }
    settimezone(ctxOrTz, tzArg) { return this.setTimezone(ctxOrTz, tzArg); }
    getTimezone() {
        return this.timezone || new PHPDateTimeZone("UTC");
    }
    gettimezone() { return this.getTimezone(); }
    getTimestamp() {
        return Math.floor(this.date.getTime() / 1000);
    }
    gettimestamp() { return this.getTimestamp(); }
    setTimestamp(ctxOrTs, tsArg) {
        const ts = Number(tsArg?.get ? tsArg.get() : (tsArg || ctxOrTs)) || 0;
        this.date = new Date(ts * 1000);
        return this;
    }
    settimestamp(ctxOrTs, tsArg) { return this.setTimestamp(ctxOrTs, tsArg); }
}
export class PHPDateTimeImmutable extends PHPDateTime {
    static [SYMBOL_PHP_NAME] = "DateTimeImmutable";
    static async createFromMutable(ctxOrDt, dtArg) {
        const dt = dtArg?.get ? dtArg.get() : (dtArg || ctxOrDt);
        const imm = Object.create(this.prototype);
        imm.date = dt instanceof PHPDateTime ? new Date(dt.date.getTime()) : new Date();
        imm.timezone = dt instanceof PHPDateTime ? dt.timezone : undefined;
        return imm;
    }
    static async createfrommutable(ctxOrDt, dtArg) {
        return PHPDateTimeImmutable.createFromMutable(ctxOrDt, dtArg);
    }
}
export class DateTimeRuntime {
    static defaultTimezone = "UTC";
    static time(ctx) {
        return Math.floor(Date.now() / 1000);
    }
    static microtime(ctx, getAsFloatArg) {
        const getAsFloat = Boolean(getAsFloatArg?.get());
        const now = Date.now();
        const sec = Math.floor(now / 1000);
        const msec = (now % 1000) / 1000;
        if (getAsFloat)
            return sec + msec;
        return `${msec.toFixed(8)} ${sec}`;
    }
    static date(ctx, formatArg, timestampArg) {
        const format = String(formatArg?.get() ?? "");
        const timestamp = timestampArg?.get() !== undefined ? Number(timestampArg.get()) : undefined;
        const d = timestamp !== undefined ? new Date(timestamp * 1000) : new Date();
        let res = "";
        for (let i = 0; i < format.length; i++) {
            const ch = format[i];
            switch (ch) {
                case "Y":
                    res += d.getFullYear();
                    break;
                case "m":
                    res += String(d.getMonth() + 1).padStart(2, "0");
                    break;
                case "d":
                    res += String(d.getDate()).padStart(2, "0");
                    break;
                case "H":
                    res += String(d.getHours()).padStart(2, "0");
                    break;
                case "i":
                    res += String(d.getMinutes()).padStart(2, "0");
                    break;
                case "s":
                    res += String(d.getSeconds()).padStart(2, "0");
                    break;
                case "U":
                    res += Math.floor(d.getTime() / 1000);
                    break;
                default:
                    res += ch;
                    break;
            }
        }
        return res;
    }
    static strtotime(ctx, timeStrArg, nowArg) {
        try {
            const timeStr = String(timeStrArg?.get() ?? "");
            const now = nowArg?.get() !== undefined ? Number(nowArg.get()) : undefined;
            const base = now !== undefined ? new Date(now * 1000) : new Date();
            const parsed = Date.parse(timeStr);
            if (!Number.isNaN(parsed))
                return Math.floor(parsed / 1000);
            return Math.floor(base.getTime() / 1000);
        }
        catch {
            return false;
        }
    }
    static date_default_timezone_get(ctx) {
        return DateTimeRuntime.defaultTimezone;
    }
    static date_default_timezone_set(ctx, timezoneIdArg) {
        const timezoneId = String(timezoneIdArg?.get() ?? "");
        DateTimeRuntime.defaultTimezone = timezoneId;
        return true;
    }
    static timezone_identifiers_list(ctx, timezoneGroupArg, countryCodeArg) {
        return Array.from(PHPDateTimeZone.__php_constants.keys()).map(k => "UTC");
    }
    static gmdate(ctx, formatArg, timestampArg) {
        const format = String(formatArg?.get() ?? "");
        const timestamp = timestampArg?.get() !== undefined ? Number(timestampArg.get()) : Math.floor(Date.now() / 1000);
        const d = new Date(timestamp * 1000);
        let res = "";
        for (let i = 0; i < format.length; i++) {
            const ch = format[i];
            switch (ch) {
                case "Y":
                    res += d.getUTCFullYear();
                    break;
                case "m":
                    res += String(d.getUTCMonth() + 1).padStart(2, "0");
                    break;
                case "d":
                    res += String(d.getUTCDate()).padStart(2, "0");
                    break;
                case "H":
                    res += String(d.getUTCHours()).padStart(2, "0");
                    break;
                case "i":
                    res += String(d.getUTCMinutes()).padStart(2, "0");
                    break;
                case "s":
                    res += String(d.getUTCSeconds()).padStart(2, "0");
                    break;
                case "U":
                    res += Math.floor(d.getTime() / 1000);
                    break;
                default:
                    res += ch;
                    break;
            }
        }
        return res;
    }
    static functions = {
        "time": DateTimeRuntime.time,
        "microtime": DateTimeRuntime.microtime,
        "date": DateTimeRuntime.date,
        "gmdate": DateTimeRuntime.gmdate,
        "strtotime": DateTimeRuntime.strtotime,
        "date_default_timezone_get": DateTimeRuntime.date_default_timezone_get,
        "date_default_timezone_set": DateTimeRuntime.date_default_timezone_set,
        "timezone_identifiers_list": DateTimeRuntime.timezone_identifiers_list,
    };
    static classes = {
        "datetime": PHPDateTime,
        "datetimezone": PHPDateTimeZone,
        "datetimeimmutable": PHPDateTimeImmutable,
    };
    static register(engine) {
        engine.registerFunctions(DateTimeRuntime.functions);
        engine.registerClasses(DateTimeRuntime.classes);
    }
}
//# sourceMappingURL=DateTime.js.map