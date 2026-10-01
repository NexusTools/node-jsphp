import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";

export class MathRuntime {
  public static abs(ctx: PHPContext, num: number): number { return Math.abs(num); }
  public static ceil(ctx: PHPContext, num: number): number { return Math.ceil(num); }
  public static floor(ctx: PHPContext, num: number): number { return Math.floor(num); }
  public static round(ctx: PHPContext, num: number, precision = 0): number {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }
  public static max(ctx: PHPContext, ...args: any[]): any {
    const nums = args.flat(Infinity).map(Number);
    return Math.max(...nums);
  }
  public static min(ctx: PHPContext, ...args: any[]): any {
    const nums = args.flat(Infinity).map(Number);
    return Math.min(...nums);
  }
  public static pow(ctx: PHPContext, base: number, exp: number): number { return Math.pow(base, exp); }
  public static sqrt(ctx: PHPContext, num: number): number { return Math.sqrt(num); }
  public static rand(ctx: PHPContext, min = 0, max = 2147483647): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static mt_rand(ctx: PHPContext, min = 0, max = 2147483647): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static mt_getrandmax(ctx: PHPContext): number { return 2147483647; }
  public static sin(ctx: PHPContext, num: number): number { return Math.sin(num); }
  public static cos(ctx: PHPContext, num: number): number { return Math.cos(num); }
  public static tan(ctx: PHPContext, num: number): number { return Math.tan(num); }
  public static asin(ctx: PHPContext, num: number): number { return Math.asin(num); }
  public static acos(ctx: PHPContext, num: number): number { return Math.acos(num); }
  public static atan(ctx: PHPContext, num: number): number { return Math.atan(num); }
  public static atan2(ctx: PHPContext, y: number, x: number): number { return Math.atan2(y, x); }
  public static log(ctx: PHPContext, num: number, base?: number): number {
    return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
  }
  public static log10(ctx: PHPContext, num: number): number { return Math.log10(num); }
  public static exp(ctx: PHPContext, num: number): number { return Math.exp(num); }
  public static fmod(ctx: PHPContext, x: number, y: number): number { return x % y; }
  public static intdiv(ctx: PHPContext, x: number, y: number): number { return Math.trunc(x / y); }
  public static is_nan(ctx: PHPContext, num: number): boolean { return Number.isNaN(num); }
  public static is_finite(ctx: PHPContext, num: number): boolean { return Number.isFinite(num); }
  public static is_infinite(ctx: PHPContext, num: number): boolean { return !Number.isFinite(num) && !Number.isNaN(num); }
  public static pi(ctx: PHPContext): number { return Math.PI; }
  public static deg2rad(ctx: PHPContext, num: number): number { return (num * Math.PI) / 180; }
  public static rad2deg(ctx: PHPContext, num: number): number { return (num * 180) / Math.PI; }
  public static base_convert(ctx: PHPContext, num: string, fromBase: number, toBase: number): string {
    return parseInt(num, fromBase).toString(toBase);
  }
  public static bindec(ctx: PHPContext, binaryString: string): number { return parseInt(binaryString, 2); }
  public static decbin(ctx: PHPContext, num: number): string { return (num >>> 0).toString(2); }
  public static dechex(ctx: PHPContext, num: number): string { return (num >>> 0).toString(16); }
  public static hexdec(ctx: PHPContext, hexString: string): number { return parseInt(hexString, 16); }
  public static octdec(ctx: PHPContext, octString: string): number { return parseInt(octString, 8); }
  public static decoct(ctx: PHPContext, num: number): string { return (num >>> 0).toString(8); }

  static functions = {
    abs: MathRuntime.abs, ceil: MathRuntime.ceil, floor: MathRuntime.floor,
    round: MathRuntime.round, max: MathRuntime.max, min: MathRuntime.min,
    pow: MathRuntime.pow, sqrt: MathRuntime.sqrt, rand: MathRuntime.rand,
    mt_rand: MathRuntime.mt_rand, mt_getrandmax: MathRuntime.mt_getrandmax,
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
