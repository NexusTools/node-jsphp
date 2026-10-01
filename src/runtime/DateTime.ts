import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class DateTimeRuntime {
  private static defaultTimezone = "UTC";

  public static time(ctx?: PHPContext): number {
    return Math.floor(Date.now() / 1000);
  }

  public static microtime(ctx?: PHPContext, getAsFloat = false): string | number {
    const now = Date.now();
    const sec = Math.floor(now / 1000);
    const msec = (now % 1000) / 1000;
    if (getAsFloat) return sec + msec;
    return `${msec.toFixed(8)} ${sec}`;
  }

  public static date(ctx: PHPContext | null, format: string, timestamp?: number): string {
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

  public static strtotime(ctx: PHPContext | null, timeStr: string, now?: number): number | false {
    try {
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

  public static date_default_timezone_set(ctx: PHPContext | null, timezoneId: string): boolean {
    DateTimeRuntime.defaultTimezone = timezoneId;
    return true;
  }

  static functions = {
    "time": DateTimeRuntime.time,
    "microtime": DateTimeRuntime.microtime,
    "date": DateTimeRuntime.date,
    "strtotime": DateTimeRuntime.strtotime,
    "date_default_timezone_get": DateTimeRuntime.date_default_timezone_get,
    "date_default_timezone_set": DateTimeRuntime.date_default_timezone_set,
  };

  static classes = {
    "datetime": () => PHPDateTime,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(DateTimeRuntime.functions);
    engine.registerClass("datetime", PHPDateTime);
  }
}

export class PHPDateTime {
  public date: Date;

  constructor(timeStr = "now") {
    this.date = timeStr === "now" ? new Date() : new Date(timeStr);
  }

  public format(format: string): string {
    return DateTimeRuntime.date(null, format, Math.floor(this.date.getTime() / 1000));
  }

  public getTimestamp(): number {
    return Math.floor(this.date.getTime() / 1000);
  }

  public setTimestamp(timestamp: number): this {
    this.date = new Date(timestamp * 1000);
    return this;
  }
}
