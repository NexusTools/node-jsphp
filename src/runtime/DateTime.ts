import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";
import { SYMBOL_PHP_NAME, SYMBOL_PHP_CONSTANTS, SYMBOL_PHP_NEW } from "./Reflection.js";

export class PHPDateTimeZone {
  public static [SYMBOL_PHP_NAME] = "DateTimeZone";
  public static [SYMBOL_PHP_CONSTANTS] = {
    africa: 1,
    america: 2,
    antarctica: 4,
    arctic: 8,
    asia: 16,
    atlantic: 32,
    australia: 64,
    europe: 128,
    indian: 256,
    pacific: 512,
    utc: 1024,
    all: 2047,
    all_with_bc: 4095,
    per_country: 4096,
  };
  public timezone: string = "UTC";

  constructor(timezone: string = "UTC") {
    this.timezone = timezone;
  }

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, timezoneArg?: PHPReference): Promise<PHPDateTimeZone> {
    const obj = Object.create(this.prototype);
    obj.timezone = "UTC";
    await obj.__construct(ctx, timezoneArg);
    return obj;
  }

  public async __construct(ctx: PHPContext, timezoneArg?: PHPReference): Promise<void> {
    const tz = timezoneArg?.get ? await timezoneArg.get() : timezoneArg;
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

  public static async [SYMBOL_PHP_NEW](ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<PHPDateTime> {
    const obj = Object.create(this.prototype);
    obj.date = new Date();
    await obj.__construct(ctx, timeStrArg, timezoneArg);
    return obj;
  }

  public async __construct(ctx: PHPContext, timeStrArg?: PHPReference, timezoneArg?: PHPReference): Promise<void> {
    const timeStr = await ctx.toVal(timeStrArg);
    const tz = await ctx.toVal(timezoneArg);
    this.date = !timeStr || timeStr === "now" ? new Date() : new Date(Date.parse(String(timeStr)) || Date.now());
    if (tz instanceof PHPDateTimeZone) {
      this.timezone = tz;
    }
  }

  public async format(ctxOrFormat?: any, formatArg?: any): Promise<string> {
    const fmt = typeof ctxOrFormat === "string" ? ctxOrFormat : String(formatArg?.get ? formatArg.get() : (formatArg || "Y-m-d H:i:s"));
    return await DateTimeRuntime.date(null, new PHPLiteral(fmt), new PHPLiteral(Math.floor(this.date.getTime() / 1000)));
  }

  public modify(ctxOrMod?: any, modArg?: any): PHPDateTime {
    const modStr = String(modArg?.get ? modArg.get() : (modArg || ctxOrMod || ""));
    const match = modStr.match(/^([+-]?\d+)\s*(day|days|month|months|year|years|hour|hours|minute|minutes|second|seconds)$/i);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      if (unit.startsWith("day")) this.date.setDate(this.date.getDate() + amount);
      else if (unit.startsWith("month")) this.date.setMonth(this.date.getMonth() + amount);
      else if (unit.startsWith("year")) this.date.setFullYear(this.date.getFullYear() + amount);
      else if (unit.startsWith("hour")) this.date.setHours(this.date.getHours() + amount);
      else if (unit.startsWith("minute")) this.date.setMinutes(this.date.getMinutes() + amount);
      else if (unit.startsWith("second")) this.date.setSeconds(this.date.getSeconds() + amount);
    }
    return this;
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

  public getOffset(): number {
    if (this.timezone) {
      return this.timezone.getOffset(this);
    }
    return 0;
  }
  public getoffset(): number { return this.getOffset(); }

  public static createFromFormat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTime | false {
    const fmt = String(fmtArg?.get ? fmtArg.get() : (fmtArg || ctxOrFmt || ""));
    const dt = String(dtArg?.get ? dtArg.get() : (dtArg || ""));
    const tz = tzArg?.get ? tzArg.get() : tzArg;

    const d = new PHPDateTime();
    if (tz instanceof PHPDateTimeZone) d.timezone = tz;

    const timestamp = Date.parse(dt);
    if (!isNaN(timestamp)) {
      d.date = new Date(timestamp);
      return d;
    }
    return d;
  }
  public static createfromformat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTime | false {
    return PHPDateTime.createFromFormat(ctxOrFmt, fmtArg, dtArg, tzArg);
  }

  public setTimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime {
    const ts = Number(tsArg?.get ? tsArg.get() : (tsArg || ctxOrTs)) || 0;
    this.date = new Date(ts * 1000);
    return this;
  }
  public settimestamp(ctxOrTs?: any, tsArg?: any): PHPDateTime { return this.setTimestamp(ctxOrTs, tsArg); }
}

export class PHPDateTimeImmutable extends PHPDateTime {
  public static [SYMBOL_PHP_NAME] = "DateTimeImmutable";

  public override modify(ctxOrMod?: any, modArg?: any): PHPDateTimeImmutable {
    const clone = Object.create(PHPDateTimeImmutable.prototype);
    clone.date = new Date(this.date.getTime());
    clone.timezone = this.timezone;
    return (PHPDateTime.prototype.modify.call(clone, ctxOrMod, modArg) as PHPDateTimeImmutable);
  }

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

  public static override createFromFormat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTimeImmutable | false {
    const dt = PHPDateTime.createFromFormat(ctxOrFmt, fmtArg, dtArg, tzArg);
    if (!dt) return false;
    const imm = Object.create(PHPDateTimeImmutable.prototype);
    imm.date = new Date(dt.date.getTime());
    imm.timezone = dt.timezone;
    return imm;
  }
  public static override createfromformat(ctxOrFmt?: any, fmtArg?: any, dtArg?: any, tzArg?: any): PHPDateTimeImmutable | false {
    return PHPDateTimeImmutable.createFromFormat(ctxOrFmt, fmtArg, dtArg, tzArg);
  }
}

export class DateTimeRuntime {
  private static defaultTimezone = "UTC";

  public static async checkdate(ctx: PHPContext, monthArg?: any, dayArg?: any, yearArg?: any): Promise<boolean> {
    const month = Number(await (monthArg?.get !== undefined ? monthArg.get() : monthArg));
    const day = Number(await (dayArg?.get !== undefined ? dayArg.get() : dayArg));
    const year = Number(await (yearArg?.get !== undefined ? yearArg.get() : yearArg));
    if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) return false;
    if (year < 1 || year > 32767 || month < 1 || month > 12 || day < 1) return false;
    const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  }

  public static async time(ctx?: PHPContext): Promise<number> {
    return Math.floor(Date.now() / 1000);
  }

  public static async microtime(ctx?: PHPContext, getAsFloatArg?: PHPReference): Promise<string | number> {
    const getAsFloat = Boolean(await getAsFloatArg?.get());
    const now = Date.now();
    const sec = Math.floor(now / 1000);
    const msec = (now % 1000) / 1000;
    if (getAsFloat) return sec + msec;
    return `${msec.toFixed(8)} ${sec}`;
  }

  public static async date(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): Promise<string> {
    const format = String(await formatArg?.get() ?? "");
    const timestampValue = await timestampArg?.get();
    const timestamp = timestampValue !== undefined ? Number(timestampValue) : undefined;
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

  public static async strtotime(ctx: PHPContext | null, timeStrArg?: PHPReference, nowArg?: PHPReference): Promise<number | false> {
    try {
      const timeStr = String(await timeStrArg?.get() ?? "");
      const nowValue = await nowArg?.get();
      const now = nowValue !== undefined ? Number(nowValue) : undefined;
      const base = now !== undefined ? new Date(now * 1000) : new Date();
      const parsed = Date.parse(timeStr);
      if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
      return Math.floor(base.getTime() / 1000);
    } catch {
      return false;
    }
  }

  public static async date_default_timezone_get(ctx?: PHPContext): Promise<string> {
    return DateTimeRuntime.defaultTimezone;
  }

  public static async date_default_timezone_set(ctx: PHPContext | null, timezoneIdArg?: PHPReference): Promise<boolean> {
    const timezoneId = String(await timezoneIdArg?.get() ?? "");
    DateTimeRuntime.defaultTimezone = timezoneId;
    return true;
  }

  public static async timezone_identifiers_list(ctx: PHPContext | null, timezoneGroupArg?: PHPReference, countryCodeArg?: PHPReference): Promise<string[]> {
    return Object.keys(PHPDateTimeZone[SYMBOL_PHP_CONSTANTS]).map(() => "UTC");
  }

  public static async gmdate(ctx: PHPContext | null, formatArg?: PHPReference, timestampArg?: PHPReference): Promise<string> {
    const format = String(await formatArg?.get() ?? "");
    const timestampValue = await timestampArg?.get();
    const timestamp = timestampValue !== undefined ? Number(timestampValue) : Math.floor(Date.now() / 1000);
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

  public static async date_create(ctx: PHPContext, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTime | false> {
    const dtStr = await ctx.toVal(datetimeArg);
    const tz = await ctx.toVal(timezoneArg);

    const d = new PHPDateTime();
    if (tz instanceof PHPDateTimeZone) d.timezone = tz;

    const str = await ctx.str(dtStr || "now");
    const ts = Date.parse(str === "now" ? new Date().toISOString() : str);
    if (!isNaN(ts)) {
      d.date = new Date(ts);
    }
    return d;
  }

  public static async date_create_immutable(ctx: PHPContext, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTimeImmutable | false> {
    const dt = await DateTimeRuntime.date_create(ctx, datetimeArg, timezoneArg);
    if (!dt) return false;
    const imm = Object.create(PHPDateTimeImmutable.prototype);
    imm.date = new Date(dt.date.getTime());
    imm.timezone = dt.timezone;
    return imm;
  }

  public static async date_create_from_format(ctx: PHPContext, formatArg?: any, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTime | false> {
    return PHPDateTime.createFromFormat(ctx, formatArg, datetimeArg, timezoneArg);
  }

  public static async date_create_immutable_from_format(ctx: PHPContext, formatArg?: any, datetimeArg?: any, timezoneArg?: any): Promise<PHPDateTimeImmutable | false> {
    return PHPDateTimeImmutable.createFromFormat(ctx, formatArg, datetimeArg, timezoneArg);
  }

  static functions = {
    "checkdate": DateTimeRuntime.checkdate,
    "time": DateTimeRuntime.time,
    "microtime": DateTimeRuntime.microtime,
    "date": DateTimeRuntime.date,
    "gmdate": DateTimeRuntime.gmdate,
    "strtotime": DateTimeRuntime.strtotime,
    "date_create": DateTimeRuntime.date_create,
    "date_create_immutable": DateTimeRuntime.date_create_immutable,
    "date_create_from_format": DateTimeRuntime.date_create_from_format,
    "date_create_immutable_from_format": DateTimeRuntime.date_create_immutable_from_format,
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
