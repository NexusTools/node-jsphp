import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";

export class CurlHandle {
  public url: string = "";
  public options: Record<number, any> = {};
}

export class CurlExtension extends PHPExtension {
  public readonly name = "curl";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      curlopt_url: 10002,
      curlopt_returnstream: 19913,
      curlopt_post: 47,
      curlopt_postfields: 10015,
      curl_version_ssl: 4,
    };

    this.functions = {
      curl_version: async (ctx: PHPContext) => {
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
      curl_init: async (ctx: PHPContext, urlArg?: PHPReference) => {
        const handle = new CurlHandle();
        const url = urlArg ? String(await urlArg.get() ?? "") : undefined;
        if (url) handle.url = url;
        return handle;
      },
      curl_setopt: async (ctx: PHPContext, handleArg?: PHPReference, optionArg?: PHPReference, valueArg?: PHPReference) => {
        const handle = await handleArg?.get();
        const option = Number(await optionArg?.get()) || 0;
        const value = await valueArg?.get();
        if (handle) {
          handle.options[option] = value;
          if (option === 10002) handle.url = String(value ?? "");
          return true;
        }
        return false;
      },
      curl_exec: async (ctx: PHPContext, handleArg?: PHPReference) => {
        const handle = await handleArg?.get();
        if (!handle || !handle.url) return false;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1000);
          if (typeof timer.unref === "function") timer.unref();
          try {
            const res = await fetch(handle.url, { signal: controller.signal });
            clearTimeout(timer);
            return await res.text();
          } catch {
            clearTimeout(timer);
            return false;
          }
        } catch {
          return false;
        }
      },
      curl_close: async (ctx: PHPContext, handleArg?: PHPReference) => true,
    };
  }
}
