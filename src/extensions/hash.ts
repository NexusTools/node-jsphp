import * as crypto from "crypto";
import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";

export class HashExtension extends PHPExtension {
  public readonly name = "hash";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      md5: (ctx: PHPContext, data: any, rawOutput = false) => this.functions.hash(ctx, "md5", Buffer.isBuffer(data) ? data : String(data ?? ""), rawOutput),
      sha1: (ctx: PHPContext, data: any, rawOutput = false) => this.functions.hash(ctx, "sha1", Buffer.isBuffer(data) ? data : String(data ?? ""), rawOutput),
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
