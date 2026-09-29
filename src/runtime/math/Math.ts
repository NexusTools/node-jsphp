export class MathRuntime {
  public static abs(num: number): number { return Math.abs(num); }
  public static ceil(num: number): number { return Math.ceil(num); }
  public static floor(num: number): number { return Math.floor(num); }
  public static round(num: number, precision = 0): number {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }
  public static max(...args: any[]): any {
    const nums = args.flat(Infinity).map(Number);
    return Math.max(...nums);
  }
  public static min(...args: any[]): any {
    const nums = args.flat(Infinity).map(Number);
    return Math.min(...nums);
  }
  public static pow(base: number, exp: number): number { return Math.pow(base, exp); }
  public static sqrt(num: number): number { return Math.sqrt(num); }
  public static rand(min = 0, max = 2147483647): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static mt_rand(min = 0, max = 2147483647): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  public static mt_getrandmax(): number { return 2147483647; }
  public static sin(num: number): number { return Math.sin(num); }
  public static cos(num: number): number { return Math.cos(num); }
  public static tan(num: number): number { return Math.tan(num); }
  public static asin(num: number): number { return Math.asin(num); }
  public static acos(num: number): number { return Math.acos(num); }
  public static atan(num: number): number { return Math.atan(num); }
  public static atan2(y: number, x: number): number { return Math.atan2(y, x); }
  public static log(num: number, base?: number): number {
    return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
  }
  public static log10(num: number): number { return Math.log10(num); }
  public static exp(num: number): number { return Math.exp(num); }
  public static fmod(x: number, y: number): number { return x % y; }
  public static intdiv(x: number, y: number): number { return Math.trunc(x / y); }
  public static is_nan(num: number): boolean { return Number.isNaN(num); }
  public static is_finite(num: number): boolean { return Number.isFinite(num); }
  public static is_infinite(num: number): boolean { return !Number.isFinite(num) && !Number.isNaN(num); }
  public static pi(): number { return Math.PI; }
  public static deg2rad(num: number): number { return (num * Math.PI) / 180; }
  public static rad2deg(num: number): number { return (num * 180) / Math.PI; }
  public static base_convert(num: string, fromBase: number, toBase: number): string {
    return parseInt(num, fromBase).toString(toBase);
  }
  public static bindec(binaryString: string): number { return parseInt(binaryString, 2); }
  public static decbin(num: number): string { return (num >>> 0).toString(2); }
  public static dechex(num: number): string { return (num >>> 0).toString(16); }
  public static hexdec(hexString: string): number { return parseInt(hexString, 16); }
  public static octdec(octString: string): number { return parseInt(octString, 8); }
  public static decoct(num: number): string { return (num >>> 0).toString(8); }
}
