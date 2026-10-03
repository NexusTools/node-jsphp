import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPReference } from "../runtime/PHPVariable";

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
    };

    this.functions = {
      curl_init: (ctx: PHPContext, urlArg?: PHPReference) => {
        const handle = new CurlHandle();
        const url = urlArg ? String(urlArg.get() ?? "") : undefined;
        if (url) handle.url = url;
        return handle;
      },
      curl_setopt: (ctx: PHPContext, handleArg?: PHPReference, optionArg?: PHPReference, valueArg?: PHPReference) => {
        const handle = handleArg?.get();
        const option = Number(optionArg?.get()) || 0;
        const value = valueArg?.get();
        if (handle) {
          handle.options[option] = value;
          if (option === 10002) handle.url = String(value ?? "");
          return true;
        }
        return false;
      },
      curl_exec: async (ctx: PHPContext, handleArg?: PHPReference) => {
        const handle = handleArg?.get();
        if (!handle || !handle.url) return false;
        try {
          const res = await fetch(handle.url, { signal: AbortSignal.timeout(3000) });
          return await res.text();
        } catch {
          return false;
        }
      },
      curl_close: (ctx: PHPContext, handleArg?: PHPReference) => true,
    };
  }
}
