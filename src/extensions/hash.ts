import * as crypto from "crypto";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";

export class HashExtension extends PHPExtension {
  public readonly name = "hash";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      PASSWORD_DEFAULT: 1,
      PASSWORD_BCRYPT: 1,
      PASSWORD_ARGON2I: 2,
      PASSWORD_ARGON2ID: 3,
      password_default: 1,
      password_bcrypt: 1,
      password_argon2i: 2,
      password_argon2id: 3,
    };
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
          const data = dataArg?.get();
          const rawOutput = Boolean(rawOutputArg?.get());
          const input = Buffer.isBuffer(data) ? data : (typeof data === "string" ? Buffer.from(data, "binary") : Buffer.from(String(data ?? "")));
          const h = crypto.createHash(algo).update(input);
          return rawOutput ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
      hash_hmac: (ctx: PHPContext, algoArg?: PHPReference, dataArg?: PHPReference, keyArg?: PHPReference, rawOutputArg?: PHPReference) => {
        try {
          const algo = String(algoArg?.get() ?? "");
          const data = dataArg?.get();
          const key = keyArg?.get();
          const rawOutput = Boolean(rawOutputArg?.get());
          const input = Buffer.isBuffer(data) ? data : (typeof data === "string" ? Buffer.from(data, "binary") : Buffer.from(String(data ?? "")));
          const keyBuf = Buffer.isBuffer(key) ? key : (typeof key === "string" ? Buffer.from(key, "binary") : Buffer.from(String(key ?? "")));
          const h = crypto.createHmac(algo, keyBuf).update(input);
          return rawOutput ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
      password_hash: (ctx: PHPContext, passwordArg?: PHPReference, algoArg?: PHPReference, optionsArg?: PHPReference) => {
        const password = String(passwordArg?.get() ?? "");
        const salt = crypto.randomBytes(16).toString("hex").slice(0, 22);
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 24, "sha256").toString("hex");
        return `$2y$10$${salt}${hash}`.slice(0, 60);
      },
      password_verify: (ctx: PHPContext, passwordArg?: PHPReference, hashArg?: PHPReference) => {
        const password = String(passwordArg?.get() ?? "");
        const hash = String(hashArg?.get() ?? "");
        if (hash.startsWith("$2y$")) {
          const salt = hash.slice(7, 29);
          const computed = crypto.pbkdf2Sync(password, salt, 1000, 24, "sha256").toString("hex");
          return `$2y$10$${salt}${computed}`.slice(0, 60) === hash;
        }
        return false;
      },
      password_needs_rehash: (ctx: PHPContext, hashArg?: PHPReference, algoArg?: PHPReference) => {
        return false;
      },
      password_get_info: (ctx: PHPContext, hashArg?: PHPReference) => {
        const hash = String(hashArg?.get() ?? "");
        if (hash.startsWith("$2y$")) {
          return { algo: 1, algoName: "bcrypt", options: { cost: 10 } };
        }
        return { algo: 0, algoName: "unknown", options: [] };
      },
    };
  }
}
