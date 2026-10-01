import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

export class CurlHandle {
  public url: string = "";
  public options: Record<number, any> = {};
}

export class CurlExtension extends PHPExtension {
  public readonly name = "curl";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      CURLOPT_URL: 10002,
      CURLOPT_RETURNTRANSFER: 19913,
      CURLOPT_POST: 47,
      CURLOPT_POSTFIELDS: 10015,
    };

    this.functions = {
      curl_init: (ctx: PHPContext, url?: string) => {
        const handle = new CurlHandle();
        if (url) handle.url = url;
        return handle;
      },
      curl_setopt: (ctx: PHPContext, handle: CurlHandle, option: number, value: any) => {
        if (handle) {
          handle.options[option] = value;
          if (option === 10002) handle.url = value;
          return true;
        }
        return false;
      },
      curl_exec: async (ctx: PHPContext, handle: CurlHandle) => {
        if (!handle || !handle.url) return false;
        try {
          const res = await fetch(handle.url);
          return await res.text();
        } catch {
          return false;
        }
      },
      curl_close: (ctx: PHPContext, handle: CurlHandle) => true,
    };
  }
}
