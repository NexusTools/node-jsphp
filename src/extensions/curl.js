import { PHPExtension } from "../PHPExtension.js";
export class CurlHandle {
    url = "";
    options = {};
}
export class CurlExtension extends PHPExtension {
    name = "curl";
    onInit(engine) {
        this.constants = {
            curlopt_url: 10002,
            curlopt_returnstream: 19913,
            curlopt_post: 47,
            curlopt_postfields: 10015,
            curl_version_ssl: 4,
        };
        this.functions = {
            curl_version: (ctx) => {
                return {
                    version_number: 0x074e00,
                    version: "7.78.0",
                    ssl_version_number: 0,
                    ssl_version: "OpenSSL/1.1.1l",
                    host: "x86_64-pc-win32",
                    age: 3,
                    features: 4,
                    protocols: ["http", "https"],
                };
            },
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
//# sourceMappingURL=curl.js.map