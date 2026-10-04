import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "./PHPVariable.js";

export class MathRuntime {
  public static abs(ctx: PHPContext, num?: PHPReference): number { return Math.abs(Number(num?.get()) || 0); }
  public static ceil(ctx: PHPContext, num?: PHPReference): number { return Math.ceil(Number(num?.get()) || 0); }
  public static floor(ctx: PHPContext, num?: PHPReference): number { return Math.floor(Number(num?.get()) || 0); }
  public static round(ctx: PHPContext, num?: PHPReference, precisionArg?: PHPReference): number {
    const n = Number(num?.get()) || 0;
    const precision = Number(precisionArg?.get()) || 0;
    const factor = Math.pow(10, precision);
    return Math.round(n * factor) / factor;
  }
  public static max(ctx: PHPContext, ...args: PHPReference[]): any {
    const nums = args.map((a) => a?.get()).flat(Infinity).map(Number);
    return Math.max(...nums);
  }
  public static min(ctx: PHPContext, ...args: PHPReference[]): any {
    const nums = args.map((a) => a?.get()).flat(Infinity).map(Number);
    return Math.min(...nums);
  }
  public static pow(ctx: PHPContext, baseArg?: PHPReference, expArg?: PHPReference): number {
    const base = Number(baseArg?.get()) || 0;
    const exp = Number(expArg?.get()) || 0;
    return Math.pow(base, exp);
  }
  public static sqrt(ctx: PHPContext, numArg?: PHPReference): number { return Math.sqrt(Number(numArg?.get()) || 0); }
  public static rand(ctx: PHPContext, minArg?: PHPReference, maxArg?: PHPReference): number {
    const min = minArg?.get() !== undefined ? Number(minArg.get()) : 0;
    const max = maxArg?.get() !== undefined ? Number(maxArg.get()) : 2147483647;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static mt_rand(ctx: PHPContext, minArg?: PHPReference, maxArg?: PHPReference): number {
    const min = minArg?.get() !== undefined ? Number(minArg.get()) : 0;
    const max = maxArg?.get() !== undefined ? Number(maxArg.get()) : 2147483647;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static random_int(ctx: PHPContext, minArg?: PHPReference, maxArg?: PHPReference): number {
    const min = minArg?.get() !== undefined ? Number(minArg.get()) : 0;
    const max = maxArg?.get() !== undefined ? Number(maxArg.get()) : 2147483647;
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }
  public static mt_getrandmax(ctx: PHPContext): number { return 2147483647; }
  public static sin(ctx: PHPContext, numArg?: PHPReference): number { return Math.sin(Number(numArg?.get()) || 0); }
  public static cos(ctx: PHPContext, numArg?: PHPReference): number { return Math.cos(Number(numArg?.get()) || 0); }
  public static tan(ctx: PHPContext, numArg?: PHPReference): number { return Math.tan(Number(numArg?.get()) || 0); }
  public static asin(ctx: PHPContext, numArg?: PHPReference): number { return Math.asin(Number(numArg?.get()) || 0); }
  public static acos(ctx: PHPContext, numArg?: PHPReference): number { return Math.acos(Number(numArg?.get()) || 0); }
  public static atan(ctx: PHPContext, numArg?: PHPReference): number { return Math.atan(Number(numArg?.get()) || 0); }
  public static atan2(ctx: PHPContext, yArg?: PHPReference, xArg?: PHPReference): number {
    return Math.atan2(Number(yArg?.get()) || 0, Number(xArg?.get()) || 0);
  }
  public static log(ctx: PHPContext, numArg?: PHPReference, baseArg?: PHPReference): number {
    const num = Number(numArg?.get()) || 0;
    const base = baseArg?.get() !== undefined ? Number(baseArg.get()) : undefined;
    return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
  }
  public static log10(ctx: PHPContext, numArg?: PHPReference): number { return Math.log10(Number(numArg?.get()) || 0); }
  public static exp(ctx: PHPContext, numArg?: PHPReference): number { return Math.exp(Number(numArg?.get()) || 0); }
  public static fmod(ctx: PHPContext, xArg?: PHPReference, yArg?: PHPReference): number {
    return (Number(xArg?.get()) || 0) % (Number(yArg?.get()) || 1);
  }
  public static intdiv(ctx: PHPContext, xArg?: PHPReference, yArg?: PHPReference): number {
    return Math.trunc((Number(xArg?.get()) || 0) / (Number(yArg?.get()) || 1));
  }
  public static is_nan(ctx: PHPContext, numArg?: PHPReference): boolean { return Number.isNaN(Number(numArg?.get())); }
  public static is_finite(ctx: PHPContext, numArg?: PHPReference): boolean { return Number.isFinite(Number(numArg?.get())); }
  public static is_infinite(ctx: PHPContext, numArg?: PHPReference): boolean {
    const num = Number(numArg?.get());
    return !Number.isFinite(num) && !Number.isNaN(num);
  }
  public static pi(ctx: PHPContext): number { return Math.PI; }
  public static deg2rad(ctx: PHPContext, numArg?: PHPReference): number { return ((Number(numArg?.get()) || 0) * Math.PI) / 180; }
  public static rad2deg(ctx: PHPContext, numArg?: PHPReference): number { return ((Number(numArg?.get()) || 0) * 180) / Math.PI; }
  public static base_convert(ctx: PHPContext, numArg?: PHPReference, fromBaseArg?: PHPReference, toBaseArg?: PHPReference): string {
    const num = String(numArg?.get() ?? "");
    const fromBase = Number(fromBaseArg?.get()) || 10;
    const toBase = Number(toBaseArg?.get()) || 10;
    return parseInt(num, fromBase).toString(toBase);
  }
  public static bindec(ctx: PHPContext, binaryStringArg?: PHPReference): number {
    return parseInt(String(binaryStringArg?.get() ?? ""), 2);
  }
  public static decbin(ctx: PHPContext, numArg?: PHPReference): string {
    return ((Number(numArg?.get()) || 0) >>> 0).toString(2);
  }
  public static dechex(ctx: PHPContext, numArg?: PHPReference): string {
    return ((Number(numArg?.get()) || 0) >>> 0).toString(16);
  }
  public static hexdec(ctx: PHPContext, hexStringArg?: PHPReference): number {
    return parseInt(String(hexStringArg?.get() ?? ""), 16);
  }
  public static octdec(ctx: PHPContext, octStringArg?: PHPReference): number {
    return parseInt(String(octStringArg?.get() ?? ""), 8);
  }
  public static decoct(ctx: PHPContext, numArg?: PHPReference): string {
    return ((Number(numArg?.get()) || 0) >>> 0).toString(8);
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
