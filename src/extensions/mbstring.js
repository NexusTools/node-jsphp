import { PHPExtension } from "../PHPExtension.js";
import { PHPReference } from "../runtime/PHPVariable.js";
export class MbstringExtension extends PHPExtension {
    name = "mbstring";
    async unwrap(val) {
        return val instanceof PHPReference ? await val.get() : val;
    }
    onInit(engine) {
        const unwrap = this.unwrap;
        this.functions = {
            mb_strlen: async (ctx, strArg) => String(await unwrap(strArg) ?? "").length,
            mb_substr: async (ctx, strArg, startArg, lengthArg) => {
                const s = String(await unwrap(strArg) ?? "");
                const start = Number(await unwrap(startArg)) || 0;
                const lengthVal = await unwrap(lengthArg);
                const length = lengthVal !== undefined && lengthVal !== null ? Number(lengthVal) : undefined;
                return length !== undefined ? s.substring(start, start + length) : s.substring(start);
            },
            mb_strtolower: async (ctx, strArg) => String(await unwrap(strArg) ?? "").toLowerCase(),
            mb_strtoupper: async (ctx, strArg) => String(await unwrap(strArg) ?? "").toUpperCase(),
            mb_check_encoding: async (ctx, valueArg, encodingArg) => {
                const val = await unwrap(valueArg);
                if (val === null || val === undefined)
                    return true;
                const str = await ctx.str(val);
                const rawEncoding = await unwrap(encodingArg);
                const encoding = rawEncoding !== undefined && rawEncoding !== null ? (await ctx.str(rawEncoding)).toUpperCase() : "UTF-8";
                if (encoding === "ASCII" || encoding === "US-ASCII") {
                    return !/[^\x00-\x7F]/.test(str);
                }
                if (encoding === "UTF-8" || encoding === "UTF8") {
                    try {
                        Buffer.from(str, "utf8");
                        return !/[\uFFFD]/.test(str);
                    }
                    catch {
                        return false;
                    }
                }
                return true;
            },
            mb_detect_encoding: async (ctx, strArg, encodingListArg, strictArg) => "UTF-8",
            mb_convert_encoding: async (ctx, strArg, toEncodingArg, fromEncodingArg) => {
                const str = await unwrap(strArg);
                if (Array.isArray(str))
                    return str.map((s) => String(s ?? ""));
                return String(str ?? "");
            },
            mb_internal_encoding: async (ctx, encodingArg) => await unwrap(encodingArg) ? true : "UTF-8",
            mb_regex_encoding: async (ctx, encodingArg) => await unwrap(encodingArg) ? true : "UTF-8",
            mb_list_encodings: async () => ["UTF-8", "ASCII", "ISO-8859-1"],
        };
    }
}
//# sourceMappingURL=mbstring.js.map