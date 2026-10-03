"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MathRuntime = void 0;
class MathRuntime {
    static abs(ctx, num) { return Math.abs(Number(num?.get()) || 0); }
    static ceil(ctx, num) { return Math.ceil(Number(num?.get()) || 0); }
    static floor(ctx, num) { return Math.floor(Number(num?.get()) || 0); }
    static round(ctx, num, precisionArg) {
        const n = Number(num?.get()) || 0;
        const precision = Number(precisionArg?.get()) || 0;
        const factor = Math.pow(10, precision);
        return Math.round(n * factor) / factor;
    }
    static max(ctx, ...args) {
        const nums = args.map((a) => a?.get()).flat(Infinity).map(Number);
        return Math.max(...nums);
    }
    static min(ctx, ...args) {
        const nums = args.map((a) => a?.get()).flat(Infinity).map(Number);
        return Math.min(...nums);
    }
    static pow(ctx, baseArg, expArg) {
        const base = Number(baseArg?.get()) || 0;
        const exp = Number(expArg?.get()) || 0;
        return Math.pow(base, exp);
    }
    static sqrt(ctx, numArg) { return Math.sqrt(Number(numArg?.get()) || 0); }
    static rand(ctx, minArg, maxArg) {
        const min = minArg?.get() !== undefined ? Number(minArg.get()) : 0;
        const max = maxArg?.get() !== undefined ? Number(maxArg.get()) : 2147483647;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static mt_rand(ctx, minArg, maxArg) {
        const min = minArg?.get() !== undefined ? Number(minArg.get()) : 0;
        const max = maxArg?.get() !== undefined ? Number(maxArg.get()) : 2147483647;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static random_int(ctx, minArg, maxArg) {
        const min = minArg?.get() !== undefined ? Number(minArg.get()) : 0;
        const max = maxArg?.get() !== undefined ? Number(maxArg.get()) : 2147483647;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return Math.floor(Math.random() * (high - low + 1)) + low;
    }
    static mt_getrandmax(ctx) { return 2147483647; }
    static sin(ctx, numArg) { return Math.sin(Number(numArg?.get()) || 0); }
    static cos(ctx, numArg) { return Math.cos(Number(numArg?.get()) || 0); }
    static tan(ctx, numArg) { return Math.tan(Number(numArg?.get()) || 0); }
    static asin(ctx, numArg) { return Math.asin(Number(numArg?.get()) || 0); }
    static acos(ctx, numArg) { return Math.acos(Number(numArg?.get()) || 0); }
    static atan(ctx, numArg) { return Math.atan(Number(numArg?.get()) || 0); }
    static atan2(ctx, yArg, xArg) {
        return Math.atan2(Number(yArg?.get()) || 0, Number(xArg?.get()) || 0);
    }
    static log(ctx, numArg, baseArg) {
        const num = Number(numArg?.get()) || 0;
        const base = baseArg?.get() !== undefined ? Number(baseArg.get()) : undefined;
        return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
    }
    static log10(ctx, numArg) { return Math.log10(Number(numArg?.get()) || 0); }
    static exp(ctx, numArg) { return Math.exp(Number(numArg?.get()) || 0); }
    static fmod(ctx, xArg, yArg) {
        return (Number(xArg?.get()) || 0) % (Number(yArg?.get()) || 1);
    }
    static intdiv(ctx, xArg, yArg) {
        return Math.trunc((Number(xArg?.get()) || 0) / (Number(yArg?.get()) || 1));
    }
    static is_nan(ctx, numArg) { return Number.isNaN(Number(numArg?.get())); }
    static is_finite(ctx, numArg) { return Number.isFinite(Number(numArg?.get())); }
    static is_infinite(ctx, numArg) {
        const num = Number(numArg?.get());
        return !Number.isFinite(num) && !Number.isNaN(num);
    }
    static pi(ctx) { return Math.PI; }
    static deg2rad(ctx, numArg) { return ((Number(numArg?.get()) || 0) * Math.PI) / 180; }
    static rad2deg(ctx, numArg) { return ((Number(numArg?.get()) || 0) * 180) / Math.PI; }
    static base_convert(ctx, numArg, fromBaseArg, toBaseArg) {
        const num = String(numArg?.get() ?? "");
        const fromBase = Number(fromBaseArg?.get()) || 10;
        const toBase = Number(toBaseArg?.get()) || 10;
        return parseInt(num, fromBase).toString(toBase);
    }
    static bindec(ctx, binaryStringArg) {
        return parseInt(String(binaryStringArg?.get() ?? ""), 2);
    }
    static decbin(ctx, numArg) {
        return ((Number(numArg?.get()) || 0) >>> 0).toString(2);
    }
    static dechex(ctx, numArg) {
        return ((Number(numArg?.get()) || 0) >>> 0).toString(16);
    }
    static hexdec(ctx, hexStringArg) {
        return parseInt(String(hexStringArg?.get() ?? ""), 16);
    }
    static octdec(ctx, octStringArg) {
        return parseInt(String(octStringArg?.get() ?? ""), 8);
    }
    static decoct(ctx, numArg) {
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
    static register(engine) {
        engine.registerFunctions(MathRuntime.functions);
    }
}
exports.MathRuntime = MathRuntime;
//# sourceMappingURL=Math.js.map