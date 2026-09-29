"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurlExtension = exports.CurlHandle = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class CurlHandle {
    url = "";
    options = {};
}
exports.CurlHandle = CurlHandle;
class CurlExtension extends PHPExtension_1.PHPExtension {
    name = "curl";
    onInit(engine) {
        this.constants = {
            CURLOPT_URL: 10002,
            CURLOPT_RETURNTRANSFER: 19913,
            CURLOPT_POST: 47,
            CURLOPT_POSTFIELDS: 10015,
        };
        this.functions = {
            curl_init: (ctx, url) => {
                const handle = new CurlHandle();
                if (url)
                    handle.url = url;
                return handle;
            },
            curl_setopt: (ctx, handle, option, value) => {
                if (handle) {
                    handle.options[option] = value;
                    if (option === 10002)
                        handle.url = value;
                    return true;
                }
                return false;
            },
            curl_exec: async (ctx, handle) => {
                if (!handle || !handle.url)
                    return false;
                try {
                    const res = await fetch(handle.url);
                    return await res.text();
                }
                catch {
                    return false;
                }
            },
            curl_close: (ctx, handle) => true,
        };
    }
}
exports.CurlExtension = CurlExtension;
//# sourceMappingURL=curl.js.map