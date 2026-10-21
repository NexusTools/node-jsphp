import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";

export class JSONExtension extends PHPExtension {
  public readonly name = "json";

  public onInit(engine: PHPEngine): void {
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
      json_encode: async (ctx: PHPContext, valueArg?: PHPReference, flagsArg?: PHPReference) => {
        try {
          const value = await valueArg?.get();
          const flags = Number(await flagsArg?.get()) || 0;
          lastError = 0;
          lastErrorMsg = "No error";
          const space = (flags & 128) ? 2 : undefined;
          let res = JSON.stringify(value, null, space);
          if (res === undefined) return "null";
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
        } catch (e: any) {
          lastError = 4;
          lastErrorMsg = e.message || "Syntax error";
          return false;
        }
      },
      json_decode: async (ctx: PHPContext, jsonStrArg?: PHPReference, assocArg?: PHPReference) => {
        try {
          const jsonStr = String(await jsonStrArg?.get() ?? "");
          lastError = 0;
          lastErrorMsg = "No error";
          if (!jsonStr.trim()) return null;
          return JSON.parse(jsonStr);
        } catch (e: any) {
          lastError = 4;
          lastErrorMsg = e.message || "Syntax error";
          return null;
        }
      },
      json_last_error: async (ctx: PHPContext) => lastError,
      json_last_error_msg: async (ctx: PHPContext) => lastErrorMsg,
    };
  }
}
