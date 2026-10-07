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
            JSON_ERROR_NONE: 0,
            JSON_ERROR_DEPTH: 1,
            JSON_ERROR_STATE_MISMATCH: 2,
            JSON_ERROR_CTRL_CHAR: 3,
            JSON_ERROR_SYNTAX: 4,
            JSON_ERROR_UTF8: 5,
            JSON_HEX_TAG: 1,
            JSON_HEX_AMP: 2,
            JSON_HEX_APOS: 4,
            JSON_HEX_QUOT: 8,
            JSON_FORCE_OBJECT: 16,
            JSON_NUMERIC_CHECK: 32,
            JSON_UNESCAPED_SLASHES: 64,
            JSON_PRETTY_PRINT: 128,
            JSON_UNESCAPED_UNICODE: 256,
            JSON_PARTIAL_OUTPUT_ON_ERROR: 512,
            JSON_PRESERVE_ZERO_FRACTION: 1024,
            JSON_THROW_ON_ERROR: 4194304,
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
                    const space = (flags & 128) ? 2 : undefined;
                    let res = JSON.stringify(value, null, space);
                    if (res === undefined)
                        return "null";
                    if (flags & 1) { // JSON_HEX_TAG
                        res = res.replace(/</g, "\\u003C").replace(/>/g, "\\u003E");
                    }
                    if (flags & 2) { // JSON_HEX_AMP
                        res = res.replace(/&/g, "\\u0026");
                    }
                    if (flags & 4) { // JSON_HEX_APOS
                        res = res.replace(/'/g, "\\u0027");
                    }
                    if (flags & 8) { // JSON_HEX_QUOT
                        res = res.replace(/"/g, "\\u0022");
                    }
                    if (flags & 64) { // JSON_UNESCAPED_SLASHES
                        res = res.replace(/\\\//g, "/");
                    }
                    return res;
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