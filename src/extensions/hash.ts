import * as crypto from "crypto";
import { promisify } from "util";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPVariable, PHPLiteral, PHPReference } from "../runtime/PHPVariable.js";

const randomBytes = promisify(crypto.randomBytes);
const pbkdf2 = promisify(crypto.pbkdf2);

export class HashExtension extends PHPExtension {
  public readonly name = "hash";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      password_default: "2y",
      password_bcrypt: "2y",
      password_argon2i: "argon2i",
      password_argon2id: "argon2id",
    };
    this.functions = {
      md5: async (ctx: PHPContext, dataArg?: any, rawOutputArg?: any) => {
        return await (this.functions as any).hash(ctx, new PHPLiteral("md5"), dataArg, rawOutputArg);
      },
      sha1: async (ctx: PHPContext, dataArg?: any, rawOutputArg?: any) => {
        return await (this.functions as any).hash(ctx, new PHPLiteral("sha1"), dataArg, rawOutputArg);
      },
      hash: async (ctx: PHPContext, algoArg?: any, dataArg?: any, rawOutputArg?: any) => {
        try {
          const algo = algoArg instanceof PHPReference ? await algoArg.get() : algoArg;
          const data = dataArg instanceof PHPReference ? await dataArg.get() : dataArg;
          const rawOutput = rawOutputArg instanceof PHPReference ? await rawOutputArg.get() : rawOutputArg;

          const algoStr = await ctx.str(algo);
          const isRaw = Boolean(rawOutput);
          const input = Buffer.isBuffer(data) ? data : Buffer.from(await ctx.str(data), "latin1");
          const h = crypto.createHash(algoStr).update(input);
          return isRaw ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
      hash_algos: async (ctx: PHPContext) => crypto.getHashes(),
      hash_hmac_algos: async (ctx: PHPContext) => crypto.getHashes(),
      hash_equals: async (ctx: PHPContext, knownStrArg?: any, userStrArg?: any) => {
        const knownStr = knownStrArg instanceof PHPReference ? await knownStrArg.get() : knownStrArg;
        const userStr = userStrArg instanceof PHPReference ? await userStrArg.get() : userStrArg;

        const kStr = await ctx.str(knownStr);
        const uStr = await ctx.str(userStr);
        if (kStr.length !== uStr.length) return false;
        try {
          return crypto.timingSafeEqual(Buffer.from(kStr, "utf8"), Buffer.from(uStr, "utf8"));
        } catch {
          return kStr === uStr;
        }
      },
      hash_hmac: async (ctx: PHPContext, algoArg?: any, dataArg?: any, keyArg?: any, rawOutputArg?: any) => {
        try {
          const algo = algoArg instanceof PHPReference ? await algoArg.get() : algoArg;
          const data = dataArg instanceof PHPReference ? await dataArg.get() : dataArg;
          const key = keyArg instanceof PHPReference ? await keyArg.get() : keyArg;
          const rawOutput = rawOutputArg instanceof PHPReference ? await rawOutputArg.get() : rawOutputArg;

          const algoStr = await ctx.str(algo);
          const isRaw = Boolean(rawOutput);
          const input = Buffer.isBuffer(data) ? data : Buffer.from(await ctx.str(data), "latin1");
          const keyBuf = Buffer.isBuffer(key) ? key : Buffer.from(await ctx.str(key), "latin1");
          const h = crypto.createHmac(algoStr, keyBuf).update(input);
          return isRaw ? h.digest() : h.digest("hex");
        } catch {
          return false;
        }
      },
      password_hash: async (ctx: PHPContext, passwordArg?: any, algoArg?: any, optionsArg?: any) => {
        const password = passwordArg instanceof PHPReference ? await passwordArg.get() : passwordArg;
        const pwdStr = String(password ?? "");
        const prefix = "$2y$10$";
        const salt = (await randomBytes(16)).toString("hex").slice(0, 22);
        const hash = (await pbkdf2(pwdStr, salt, 1000, 32, "sha256")).toString("hex");
        return (prefix + salt + hash).slice(0, 60);
      },
      password_verify: async (ctx: PHPContext, passwordArg?: any, hashArg?: any) => {
        const password = passwordArg instanceof PHPReference ? await passwordArg.get() : passwordArg;
        const hash = hashArg instanceof PHPReference ? await hashArg.get() : hashArg;

        const pwdStr = String(password ?? "");
        const hashStr = String(hash ?? "");

        if (hashStr.startsWith("$2y$")) {
          const prefix = hashStr.startsWith("$2y$10$") ? "$2y$10$" : "$2y$";
          const salt = hashStr.slice(prefix.length, prefix.length + 22);
          const computed = (await pbkdf2(pwdStr, salt, 1000, 32, "sha256")).toString("hex");
          const vFull = (prefix + salt + computed).slice(0, hashStr.length);
          return vFull === hashStr;
        }
        return false;
      },
      password_needs_rehash: async (ctx: PHPContext, hashArg?: PHPReference, algoArg?: PHPReference) => {
        return false;
      },
      password_get_info: async (ctx: PHPContext, hashArg?: PHPReference) => {
        const hash = String(await hashArg?.get() ?? "");
        if (hash.startsWith("$2y$")) {
          return { algo: 1, algoName: "bcrypt", options: { cost: 10 } };
        }
        return { algo: 0, algoName: "unknown", options: [] };
      },
      crypt: async (ctx: PHPContext, strArg?: PHPReference, saltArg?: PHPReference) => {
        const str = String(await strArg?.get() ?? "");
        const salt = String(await saltArg?.get() ?? "");
        if (!salt) return str;
        if (salt.startsWith("$1$")) {
          const saltParts = salt.split("$");
          const realSalt = saltParts[2] || "";
          const hash = crypto.createHash("md5").update(str + "$1$" + realSalt).digest("hex");
          return `$1$${realSalt}$${hash.slice(0, 22)}`;
        }
        if (salt.startsWith("$2a$") || salt.startsWith("$2y$") || salt.startsWith("$2b$")) {
          const parts = salt.split("$");
          const rounds = parts[2] || "10";
          const realSalt = parts[3] || "";
          const hash = crypto.createHash("sha256").update(str + salt).digest("hex");
          return `${salt.slice(0, 29)}${hash.slice(0, 31)}`;
        }
        const hash = crypto.createHash("sha256").update(str + salt).digest("hex");
        return salt + hash.slice(0, 13);
      },
    };
  }
}
