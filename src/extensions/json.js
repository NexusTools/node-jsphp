import { PHPExtension } from "../PHPExtension.js";
export class JSONExtension extends PHPExtension {
    name = "json";
    onInit(engine) {
        this.constants = {
            json_error_none: 0,
            json_error_depth: 1,
            json_error_state_mismatch: 2,
            json_error_ctrl_char: 3,
            json_error_syntax: 4,
            json_error_utf8: 5,
            json_hex_tag: 1,
            json_hex_amp: 2,
            json_hex_apos: 4,
            json_hex_quot: 8,
            json_force_object: 16,
            json_numeric_check: 32,
            json_unescaped_slashes: 64,
            json_pretty_print: 128,
            json_unescaped_unicode: 256,
            json_partial_output_on_error: 512,
            json_preserve_zero_fraction: 1024,
            json_throw_on_error: 4194304,
        };
        let lastError = 0;
        let lastErrorMsg = "No error";
        this.functions = {
            json_encode: (ctx, valueArg, flagsArg) => {
                try {
                    const value = valueArg?.get();
                    const flags = Number(flagsArg?.get()) || 0;
                    lastError = 0;
                    lastErrorMsg = "No error";
                    if (flags & 128) {
                        return JSON.stringify(value, null, 2);
                    }
                    return JSON.stringify(value);
                }
                catch (e) {
                    lastError = 4;
                    lastErrorMsg = e.message || "Syntax error";
                    return false;
                }
            },
            json_decode: (ctx, jsonStrArg, assocArg) => {
                try {
                    const jsonStr = String(jsonStrArg?.get() ?? "");
                    lastError = 0;
                    lastErrorMsg = "No error";
                    if (!jsonStr.trim())
                        return null;
                    return JSON.parse(jsonStr);
                }
                catch (e) {
                    lastError = 4;
                    lastErrorMsg = e.message || "Syntax error";
                    return null;
                }
            },
            json_last_error: (ctx) => lastError,
            json_last_error_msg: (ctx) => lastErrorMsg,
        };
    }
}
//# sourceMappingURL=json.js.map