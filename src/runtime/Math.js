export class MathRuntime {
    static async abs(ctx, num) { return Math.abs(Number(await num?.get()) || 0); }
    static async ceil(ctx, num) { return Math.ceil(Number(await num?.get()) || 0); }
    static async floor(ctx, num) { return Math.floor(Number(await num?.get()) || 0); }
    static async round(ctx, num, precisionArg) {
        const n = Number(await num?.get()) || 0;
        const precision = Number(await precisionArg?.get()) || 0;
        const factor = Math.pow(10, precision);
        return Math.round(n * factor) / factor;
    }
    static async max(ctx, ...args) {
        const values = await Promise.all(args.map((arg) => arg?.get()));
        const nums = values.flat(Infinity).map(Number);
        return Math.max(...nums);
    }
    static async min(ctx, ...args) {
        const values = await Promise.all(args.map((arg) => arg?.get()));
        const nums = values.flat(Infinity).map(Number);
        return Math.min(...nums);
    }
    static async pow(ctx, baseArg, expArg) {
        const base = Number(await baseArg?.get()) || 0;
        const exp = Number(await expArg?.get()) || 0;
        return Math.pow(base, exp);
    }
    static async sqrt(ctx, numArg) { return Math.sqrt(Number(await numArg?.get()) || 0); }
    static async rand(ctx, minArg, maxArg) {
        const minValue = await minArg?.get();
        const maxValue = await maxArg?.get();
        const min = minValue !== undefined ? Number(minValue) : 0;
        const max = maxValue !== undefined ? Number(maxValue) : 2147483647;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static async mt_rand(ctx, minArg, maxArg) {
        const minValue = await minArg?.get();
        const maxValue = await maxArg?.get();
        const min = minValue !== undefined ? Number(minValue) : 0;
        const max = maxValue !== undefined ? Number(maxValue) : 2147483647;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static async random_int(ctx, minArg, maxArg) {
        const minValue = await minArg?.get();
        const maxValue = await maxArg?.get();
        const min = minValue !== undefined ? Number(minValue) : 0;
        const max = maxValue !== undefined ? Number(maxValue) : 2147483647;
        const low = Math.min(min, max);
        const high = Math.max(min, max);
        return Math.floor(Math.random() * (high - low + 1)) + low;
    }
    static async mt_getrandmax(ctx) { return 2147483647; }
    static async sin(ctx, numArg) { return Math.sin(Number(await numArg?.get()) || 0); }
    static async cos(ctx, numArg) { return Math.cos(Number(await numArg?.get()) || 0); }
    static async tan(ctx, numArg) { return Math.tan(Number(await numArg?.get()) || 0); }
    static async asin(ctx, numArg) { return Math.asin(Number(await numArg?.get()) || 0); }
    static async acos(ctx, numArg) { return Math.acos(Number(await numArg?.get()) || 0); }
    static async atan(ctx, numArg) { return Math.atan(Number(await numArg?.get()) || 0); }
    static async atan2(ctx, yArg, xArg) {
        return Math.atan2(Number(await yArg?.get()) || 0, Number(await xArg?.get()) || 0);
    }
    static async log(ctx, numArg, baseArg) {
        const num = Number(await numArg?.get()) || 0;
        const baseValue = await baseArg?.get();
        const base = baseValue !== undefined ? Number(baseValue) : undefined;
        return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
    }
    static async log10(ctx, numArg) { return Math.log10(Number(await numArg?.get()) || 0); }
    static async exp(ctx, numArg) { return Math.exp(Number(await numArg?.get()) || 0); }
    static async fmod(ctx, xArg, yArg) {
        return (Number(await xArg?.get()) || 0) % (Number(await yArg?.get()) || 1);
    }
    static async intdiv(ctx, xArg, yArg) {
        return Math.trunc((Number(await xArg?.get()) || 0) / (Number(await yArg?.get()) || 1));
    }
    static async is_nan(ctx, numArg) { return Number.isNaN(Number(await numArg?.get())); }
    static async is_finite(ctx, numArg) { return Number.isFinite(Number(await numArg?.get())); }
    static async is_infinite(ctx, numArg) {
        const num = Number(await numArg?.get());
        return !Number.isFinite(num) && !Number.isNaN(num);
    }
    static async pi(ctx) { return Math.PI; }
    static async deg2rad(ctx, numArg) { return ((Number(await numArg?.get()) || 0) * Math.PI) / 180; }
    static async rad2deg(ctx, numArg) { return ((Number(await numArg?.get()) || 0) * 180) / Math.PI; }
    static async base_convert(ctx, numArg, fromBaseArg, toBaseArg) {
        const num = String(await numArg?.get() ?? "");
        const fromBase = Number(await fromBaseArg?.get()) || 10;
        const toBase = Number(await toBaseArg?.get()) || 10;
        return parseInt(num, fromBase).toString(toBase);
    }
    static async bindec(ctx, binaryStringArg) {
        return parseInt(String(await binaryStringArg?.get() ?? ""), 2);
    }
    static async decbin(ctx, numArg) {
        return ((Number(await numArg?.get()) || 0) >>> 0).toString(2);
    }
    static async dechex(ctx, numArg) {
        return ((Number(await numArg?.get()) || 0) >>> 0).toString(16);
    }
    static async hexdec(ctx, hexStringArg) {
        return parseInt(String(await hexStringArg?.get() ?? ""), 16);
    }
    static async octdec(ctx, octStringArg) {
        return parseInt(String(await octStringArg?.get() ?? ""), 8);
    }
    static async decoct(ctx, numArg) {
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
    static register(engine) {
        engine.registerFunctions(MathRuntime.functions);
    }
}
//# sourceMappingURL=Math.js.map