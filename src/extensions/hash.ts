import * as crypto from "crypto";
import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
import { PHPContext } from "../PHPContext";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable";

export class HashExtension extends PHPExtension {
  public readonly name = "hash";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      md5: (ctx: PHPContext, dataArg?: PHPReference, rawOutputArg?: PHPReference) => {
        const data = dataArg?.get();
        const rawOutput = Boolean(rawOutputArg?.get());
        return this.functions.hash(ctx, new PHPLiteral("md5"), new PHPLiteral(Buffer.isBuffer(data) ? data : String(data ?? "")), new PHPLiteral(rawOutput));
      },
      sha1: (ctx: PHPContext, dataArg?: PHPReference, rawOutputArg?: PHPReference) => {
        const data = dataArg?.get();
        const rawOutput = Boolean(rawOutputArg?.get());
        return this.functions.hash(ctx, new PHPLiteral("sha1"), new PHPLiteral(Buffer.isBuffer(data) ? data : String(data ?? "")), new PHPLiteral(rawOutput));
      },
      hash: (ctx: PHPContext, algoArg?: PHPReference, dataArg?: PHPReference, rawOutputArg?: PHPReference) => {
        try {
          const algo = String(algoArg?.get() ?? "");
          const data = String(dataArg?.get() ?? "");
          const rawOutput = Boolean(rawOutputArg?.get());
          const h = crypto.createHash(algo).update(data);
          return rawOutput ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
      hash_hmac: (ctx: PHPContext, algoArg?: PHPReference, dataArg?: PHPReference, keyArg?: PHPReference, rawOutputArg?: PHPReference) => {
        try {
          const algo = String(algoArg?.get() ?? "");
          const data = String(dataArg?.get() ?? "");
          const key = String(keyArg?.get() ?? "");
          const rawOutput = Boolean(rawOutputArg?.get());
          const h = crypto.createHmac(algo, key).update(data);
          return rawOutput ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
    };
  }
}
