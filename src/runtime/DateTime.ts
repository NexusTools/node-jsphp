import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME } from "./Reflection.js";

export class PHPDateTimeZone {
  public static [SYMBOL_PHP_NAME] = "DateTimeZone";
  public static __php_constants = new Map([
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
  public timezone: string = "UTC";

  constructor(timezone: string = "UTC") {
    this.timezone = timezone;
  }

  public static async __$$__new(ctx: PHPContext, timezoneArg?: PHPReference): Promise<PHPDateTimeZone> {
    const obj = Object.create(this.prototype);
    obj.timezone = "UTC";
    await obj.__construct(ctx, timezoneArg);
    return obj;
  }

  public async __construct(ctx: PHPContext, timezoneArg?: PHPReference): Promise<void> {
    const tz = timezoneArg?.get ? timezoneArg.get() : timezoneArg;
    this.timezone = String(tz ?? "UTC");
  }

  public getName(): string {
    return this.timezone;
  }
  public getname(): string { return this.getName(); }

  public getOffset(datetimeArg?: any): number {
    return 0;
  }
  public getoffset(datetimeArg?: any): number { return this.getOffset(datetimeArg); }
}

export class PHPDateTime {
  public static [SYMBOL_PHP_NAME] = "DateTime";
  public date: Date;
  public timezone?: PHPDateTimeZone;

  constructor(timeStr = "now", timezone?: PHPDateTimeZone) {
    this.date = timeStr === "now" ? new Date() : new Date(Date.parse(timeStr) || Date.now());
    this.timezone = timezone;
  }

  public static async __$$__new(ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<PHPDateTime> {
    const obj = Object.create(this.prototype);
    obj.date = new Date();
    await obj.__construct(ctx, timeStrArg, timezoneArg);
    return obj;
  }

  public async __construct(ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<void> {
    const timeStr = timeStrArg?.get ? timeStrArg.get() : timeStrArg;
    const tz = timezoneArg?.get ? timezoneArg.get() : timezoneArg;
    this.date = !timeStr || timeStr === "now" ? new Date() : new Date(Date.parse(String(timeStr)) || Date.now());
    if (tz instanceof PHPDateTimeZone) {
      this.timezone = tz;
    }
  }

  public format(ctxOrFormat?: any, formatArg?: any): string {
    const fmt = typeof ctxOrFormat === "string" ? ctxOrFormat : String(formatArg?.get ? formatArg.get() : (formatArg || "Y-m-d H:i:s"));
    return DateTimeRuntime.date(null as any, new PHPLiteral(fmt), new PHPLiteral(Math.floor(this.date.getTime() / 1000)));
  }

  public setTimezone(ctxOrTz?: any, tzArg?: any): PHPDateTime {
    const tz = tzArg?.get ? tzArg.get() : (tzArg || ctxOrTz);
    if (tz instanceof PHPDateTimeZone) {
      this.timezone = tz;
    }
    return this;
  }
  public settimezone(ctxOrTz?: any, tzArg?: any): PHPDateTime { return this.setTimezone(ctxOrTz, tzArg); }

  public getTimezone(): PHPDateTimeZone | false {
    return this.timezone || new PHPDateTimeZone("UTC");
  }
  public gettimezone(): PHPDateTimeZone | false { return this.getTimezone(); }

  public getTimestamp(): number {
    return Math.floor(this.date.getTime() / 1000);
  }
  public gettimestamp(): number { return this.getTimestamp(); }

  public setTimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime {
    const ts = Number(tsArg?.get ? tsArg.get() : (tsArg || ctxOrTs)) || 0;
    this.date = new Date(ts * 1000);
    return this;
  }
  public settimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime { return this.setTimestamp(ctxOrTs, tsArg); }
}

export class PHPDateTimeImmutable extends PHPDateTime {
  public static [SYMBOL_PHP_NAME] = "DateTimeImmutable";

  public static async createFromMutable(ctxOrDt?: any, dtArg?: any): Promise<PHPDateTimeImmutable> {
    const dt = dtArg?.get ? dtArg.get() : (dtArg || ctxOrDt);
    const imm = Object.create(this.prototype);
    imm.date = dt instanceof PHPDateTime ? new Date(dt.date.getTime()) : new Date();
    imm.timezone = dt instanceof PHPDateTime ? dt.timezone : undefined;
    return imm;
  }
  public static async createfrommutable(ctxOrDt?: any, dtArg?: any): Promise<PHPDateTimeImmutable> {
    return PHPDateTimeImmutable.createFromMutable(ctxOrDt, dtArg);
  }
}

export class DateTimeRuntime {
  private static defaultTimezone = "UTC";

  public static time(ctx?: PHPContext): number {
    return Math.floor(Date.now() / 1000);
  }

  public static microtime(ctx?: PHPContext, getAsFloatArg?: PHPReference): string | number {
    const getAsFloat = Boolean(getAsFloatArg?.get());
    const now = Date.now();
    const sec = Math.floor(now / 1000);
    const msec = (now % 1000) / 1000;
    if (getAsFloat) return sec + msec;
    return `${msec.toFixed(8)} ${sec}`;
  }

  public static date(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): string {
    const format = String(formatArg?.get() ?? "");
    const timestamp = timestampArg?.get() !== undefined ? Number(timestampArg.get()) : undefined;
    const d = timestamp !== undefined ? new Date(timestamp * 1000) : new Date();
    let res = "";
    for (let i = 0; i < format.length; i++) {
      const ch = format[i];
      switch (ch) {
        case "Y": res += d.getFullYear(); break;
        case "m": res += String(d.getMonth() + 1).padStart(2, "0"); break;
        case "d": res += String(d.getDate()).padStart(2, "0"); break;
        case "H": res += String(d.getHours()).padStart(2, "0"); break;
        case "i": res += String(d.getMinutes()).padStart(2, "0"); break;
        case "s": res += String(d.getSeconds()).padStart(2, "0"); break;
        case "U": res += Math.floor(d.getTime() / 1000); break;
        default: res += ch; break;
      }
    }
    return res;
  }

  public static strtotime(ctx: PHPContext | null, timeStrArg?: PHPReference, nowArg?: PHPReference): number | false {
    try {
      const timeStr = String(timeStrArg?.get() ?? "");
      const now = nowArg?.get() !== undefined ? Number(nowArg.get()) : undefined;
      const base = now !== undefined ? new Date(now * 1000) : new Date();
      const parsed = Date.parse(timeStr);
      if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
      return Math.floor(base.getTime() / 1000);
    } catch {
      return false;
    }
  }

  public static date_default_timezone_get(ctx?: PHPContext): string {
    return DateTimeRuntime.defaultTimezone;
  }

  public static date_default_timezone_set(ctx: PHPContext | null, timezoneIdArg?: PHPReference): boolean {
    const timezoneId = String(timezoneIdArg?.get() ?? "");
    DateTimeRuntime.defaultTimezone = timezoneId;
    return true;
  }

  public static timezone_identifiers_list(ctx: PHPContext | null, timezoneGroupArg?: PHPReference, countryCodeArg?: PHPReference): string[] {
    return Array.from(PHPDateTimeZone.__php_constants.keys()).map(k => "UTC");
  }

  public static gmdate(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): string {
    const format = String(formatArg?.get() ?? "");
    const timestamp = timestampArg?.get() !== undefined ? Number(timestampArg.get()) : Math.floor(Date.now() / 1000);
    const d = new Date(timestamp * 1000);
    let res = "";
    for (let i = 0; i < format.length; i++) {
      const ch = format[i];
      switch (ch) {
        case "Y": res += d.getUTCFullYear(); break;
        case "m": res += String(d.getUTCMonth() + 1).padStart(2, "0"); break;
        case "d": res += String(d.getUTCDate()).padStart(2, "0"); break;
        case "H": res += String(d.getUTCHours()).padStart(2, "0"); break;
        case "i": res += String(d.getUTCMinutes()).padStart(2, "0"); break;
        case "s": res += String(d.getUTCSeconds()).padStart(2, "0"); break;
        case "U": res += Math.floor(d.getTime() / 1000); break;
        default: res += ch; break;
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

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(DateTimeRuntime.functions);
    engine.registerClasses(DateTimeRuntime.classes);
  }
}
