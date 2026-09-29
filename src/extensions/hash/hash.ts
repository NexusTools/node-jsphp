import * as crypto from "crypto";
import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

export class HashExtension extends PHPExtension {
  public readonly name = "hash";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      hash: (ctx: PHPContext, algo: string, data: string, rawOutput = false) => {
        try {
          const h = crypto.createHash(algo).update(data);
          return rawOutput ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
      hash_hmac: (ctx: PHPContext, algo: string, data: string, key: string, rawOutput = false) => {
        try {
          const h = crypto.createHmac(algo, key).update(data);
          return rawOutput ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
    };
  }
}
