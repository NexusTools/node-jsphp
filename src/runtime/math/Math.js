"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MathRuntime = void 0;
class MathRuntime {
    static abs(num) { return Math.abs(num); }
    static ceil(num) { return Math.ceil(num); }
    static floor(num) { return Math.floor(num); }
    static round(num, precision = 0) {
        const factor = Math.pow(10, precision);
        return Math.round(num * factor) / factor;
    }
    static max(...args) {
        const nums = args.flat(Infinity).map(Number);
        return Math.max(...nums);
    }
    static min(...args) {
        const nums = args.flat(Infinity).map(Number);
        return Math.min(...nums);
    }
    static pow(base, exp) { return Math.pow(base, exp); }
    static sqrt(num) { return Math.sqrt(num); }
    static rand(min = 0, max = 2147483647) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static mt_rand(min = 0, max = 2147483647) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    static mt_getrandmax() { return 2147483647; }
    static sin(num) { return Math.sin(num); }
    static cos(num) { return Math.cos(num); }
    static tan(num) { return Math.tan(num); }
    static asin(num) { return Math.asin(num); }
    static acos(num) { return Math.acos(num); }
    static atan(num) { return Math.atan(num); }
    static atan2(y, x) { return Math.atan2(y, x); }
    static log(num, base) {
        return base !== undefined ? Math.log(num) / Math.log(base) : Math.log(num);
    }
    static log10(num) { return Math.log10(num); }
    static exp(num) { return Math.exp(num); }
    static fmod(x, y) { return x % y; }
    static intdiv(x, y) { return Math.trunc(x / y); }
    static is_nan(num) { return Number.isNaN(num); }
    static is_finite(num) { return Number.isFinite(num); }
    static is_infinite(num) { return !Number.isFinite(num) && !Number.isNaN(num); }
    static pi() { return Math.PI; }
    static deg2rad(num) { return (num * Math.PI) / 180; }
    static rad2deg(num) { return (num * 180) / Math.PI; }
    static base_convert(num, fromBase, toBase) {
        return parseInt(num, fromBase).toString(toBase);
    }
    static bindec(binaryString) { return parseInt(binaryString, 2); }
    static decbin(num) { return (num >>> 0).toString(2); }
    static dechex(num) { return (num >>> 0).toString(16); }
    static hexdec(hexString) { return parseInt(hexString, 16); }
    static octdec(octString) { return parseInt(octString, 8); }
    static decoct(num) { return (num >>> 0).toString(8); }
}
exports.MathRuntime = MathRuntime;
//# sourceMappingURL=Math.js.map