"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurlExtension = exports.CurlHandle = void 0;
const PHPExtension_1 = require("../PHPExtension");
class CurlHandle {
    url = "";
    options = {};
}
exports.CurlHandle = CurlHandle;
class CurlExtension extends PHPExtension_1.PHPExtension {
    name = "curl";
    onInit(engine) {
        this.constants = {
            curlopt_url: 10002,
            curlopt_returnstream: 19913,
            curlopt_post: 47,
            curlopt_postfields: 10015,
        };
        this.functions = {
            curl_init: (ctx, urlArg) => {
                const handle = new CurlHandle();
                const url = urlArg ? String(urlArg.get() ?? "") : undefined;
                if (url)
                    handle.url = url;
                return handle;
            },
            curl_setopt: (ctx, handleArg, optionArg, valueArg) => {
                const handle = handleArg?.get();
                const option = Number(optionArg?.get()) || 0;
                const value = valueArg?.get();
                if (handle) {
                    handle.options[option] = value;
                    if (option === 10002)
                        handle.url = String(value ?? "");
                    return true;
                }
                return false;
            },
            curl_exec: async (ctx, handleArg) => {
                const handle = handleArg?.get();
                if (!handle || !handle.url)
                    return false;
                try {
                    const res = await fetch(handle.url, { signal: AbortSignal.timeout(3000) });
                    return await res.text();
                }
                catch {
                    return false;
                }
            },
            curl_close: (ctx, handleArg) => true,
        };
    }
}
exports.CurlExtension = CurlExtension;
//# sourceMappingURL=curl.js.map