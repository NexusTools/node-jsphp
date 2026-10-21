import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";

export class MathRuntime {
  public static async abs(ctx: PHPContext, num?: PHPReference): Promise<number> { return Math.abs(Number(await num?.get()) || 0); }
  public static async ceil(ctx: PHPContext, num?: PHPReference): Promise<number> { return Math.ceil(Number(await num?.get()) || 0); }
  public static async floor(ctx: PHPContext, num?: PHPReference): Promise<number> { return Math.floor(Number(await num?.get()) || 0); }
  public static async round(ctx: PHPContext, num?: PHPReference, precisionArg?: PHPReference): Promise<number> {
    const n = Number(await num?.get()) || 0;
    const precision = Number(await precisionArg?.get()) || 0;
    const factor = Math.pow(10, precision);
    return Math.round(n * factor) / factor;
  }
  public static async max(ctx: PHPContext, ...args: PHPReference[]): Promise<number> {
    const values = await Promise.all(args.map((arg) => arg?.get()));
    const nums = values.flat(Infinity).map(Number);
    return Math.max(...nums);
  }
  public static async min(ctx: PHPContext, ...args: PHPReference[]): Promise<number> {
    const values = await Promise.all(args.map((arg) => arg?.get()));
    const nums = values.flat(Infinity).map(Number);
    return Math.min(...nums);
  }
  public static async pow(ctx: PHPContext, baseArg?: PHPReference, expArg?: PHPReference): Promise<number> {
    const base = Number(await baseArg?.get()) || 0;
    const exp = Number(await expArg?.get()) || 0;
    return Math.pow(base, exp);
  }
  public static async sqrt(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.sqrt(Number(await numArg?.get()) || 0); }
  public static async rand(ctx: PHPContext, minArg?: PHPReference, maxArg?: PHPReference): Promise<number> {
    const minValue = await minArg?.get();
    const maxValue = await maxArg?.get();
    const min = minValue !== undefined ? Number(minValue) : 0;
    const max = maxValue !== undefined ? Number(maxValue) : 2147483647;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static async mt_rand(ctx: PHPContext, minArg?: PHPReference, maxArg?: PHPReference): Promise<number> {
    const minValue = await minArg?.get();
    const maxValue = await maxArg?.get();
    const min = minValue !== undefined ? Number(minValue) : 0;
    const max = maxValue !== undefined ? Number(maxValue) : 2147483647;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static async random_int(ctx: PHPContext, minArg?: PHPReference, maxArg?: PHPReference): Promise<number> {
    const minValue = await minArg?.get();
    const maxValue = await maxArg?.get();
    const min = minValue !== undefined ? Number(minValue) : 0;
    const max = maxValue !== undefined ? Number(maxValue) : 2147483647;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }
  public static async mt_getrandmax(ctx: PHPContext): Promise<number> { return 2147483647; }
  public static async sin(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.sin(Number(await numArg?.get()) || 0); }
  public static async cos(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.cos(Number(await numArg?.get()) || 0); }
  public static async tan(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.tan(Number(await numArg?.get()) || 0); }
  public static async asin(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.asin(Number(await numArg?.get()) || 0); }
  public static async acos(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.acos(Number(await numArg?.get()) || 0); }
  public static async atan(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.atan(Number(await numArg?.get()) || 0); }
  public static async atan2(ctx: PHPContext, yArg?: PHPReference, xArg?: PHPReference): Promise<number> {
    return Math.atan2(Number(await yArg?.get()) || 0, Number(await xArg?.get()) || 0);
  }
  public static async log(ctx: PHPContext, numArg?: PHPReference, baseArg?: PHPReference): Promise<number> {
    const num = Number(await numArg?.get()) || 0;
    const baseValue = await baseArg?.get();
    const base = baseValue !== undefined ? Number(baseValue) : undefined;
    return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
  }
  public static async log10(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.log10(Number(await numArg?.get()) || 0); }
  public static async exp(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return Math.exp(Number(await numArg?.get()) || 0); }
  public static async fmod(ctx: PHPContext, xArg?: PHPReference, yArg?: PHPReference): Promise<number> {
    return (Number(await xArg?.get()) || 0) % (Number(await yArg?.get()) || 1);
  }
  public static async intdiv(ctx: PHPContext, xArg?: PHPReference, yArg?: PHPReference): Promise<number> {
    return Math.trunc((Number(await xArg?.get()) || 0) / (Number(await yArg?.get()) || 1));
  }
  public static async is_nan(ctx: PHPContext, numArg?: PHPReference): Promise<boolean> { return Number.isNaN(Number(await numArg?.get())); }
  public static async is_finite(ctx: PHPContext, numArg?: PHPReference): Promise<boolean> { return Number.isFinite(Number(await numArg?.get())); }
  public static async is_infinite(ctx: PHPContext, numArg?: PHPReference): Promise<boolean> {
    const num = Number(await numArg?.get());
    return !Number.isFinite(num) && !Number.isNaN(num);
  }
  public static async pi(ctx: PHPContext): Promise<number> { return Math.PI; }
  public static async deg2rad(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return ((Number(await numArg?.get()) || 0) * Math.PI) / 180; }
  public static async rad2deg(ctx: PHPContext, numArg?: PHPReference): Promise<number> { return ((Number(await numArg?.get()) || 0) * 180) / Math.PI; }
  public static async base_convert(ctx: PHPContext, numArg?: PHPReference, fromBaseArg?: PHPReference, toBaseArg?: PHPReference): Promise<string> {
    const num = String(await numArg?.get() ?? "");
    const fromBase = Number(await fromBaseArg?.get()) || 10;
    const toBase = Number(await toBaseArg?.get()) || 10;
    return parseInt(num, fromBase).toString(toBase);
  }
  public static async bindec(ctx: PHPContext, binaryStringArg?: PHPReference): Promise<number> {
    return parseInt(String(await binaryStringArg?.get() ?? ""), 2);
  }
  public static async decbin(ctx: PHPContext, numArg?: PHPReference): Promise<string> {
    return ((Number(await numArg?.get()) || 0) >>> 0).toString(2);
  }
  public static async dechex(ctx: PHPContext, numArg?: PHPReference): Promise<string> {
    return ((Number(await numArg?.get()) || 0) >>> 0).toString(16);
  }
  public static async hexdec(ctx: PHPContext, hexStringArg?: PHPReference): Promise<number> {
    return parseInt(String(await hexStringArg?.get() ?? ""), 16);
  }
  public static async octdec(ctx: PHPContext, octStringArg?: PHPReference): Promise<number> {
    return parseInt(String(await octStringArg?.get() ?? ""), 8);
  }
  public static async decoct(ctx: PHPContext, numArg?: PHPReference): Promise<string> {
    return ((Number(await numArg?.get()) || 0) >>> 0).toString(8);
  }

  static functions = {
    abs: MathRuntime.abs, ceil: MathRuntime.ceil, floor: MathRuntime.floor,
    round: MathRuntime.round, max: MathRuntime.max, min: MathRuntime.min,
    pow: MathRuntime.pow, sqrt: MathRuntime.sqrt, rand: MathRuntime.rand,
    mt_rand: MathRuntime.mt_rand, random_int: MathRuntime.random_int, mt_getrandmax: MathRuntime.mt_getrandmax,
    sin: MathRuntime.sin, cos: MathRuntime.cos, tan: MathRuntime.tan,
    asin: MathRuntime.asin, acos: MathRuntime.acos, atan: MathRuntime.atan,
    atan2: MathRuntime.atan2, log: MathRuntime.log, log10: MathRuntime.log10,
    exp: MathRuntime.exp, fmod: MathRuntime.fmod, intdiv: MathRuntime.intdiv,
    is_nan: MathRuntime.is_nan, is_finite: MathRuntime.is_finite,
    is_infinite: MathRuntime.is_infinite, pi: MathRuntime.pi,
    deg2rad: MathRuntime.deg2rad, rad2deg: MathRuntime.rad2deg,
    base_convert: MathRuntime.base_convert, bindec: MathRuntime.bindec,
    decbin: MathRuntime.decbin, dechex: MathRuntime.dechex, hexdec: MathRuntime.hexdec,
    octdec: MathRuntime.octdec, decoct: MathRuntime.decoct,
  };

  public static register(engine: PHPEngine): void {
    engine.registerFunctions(MathRuntime.functions);
  }
}
