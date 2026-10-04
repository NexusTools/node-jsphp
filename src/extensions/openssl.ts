import * as crypto from "crypto";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";

export class OpenSSLExtension extends PHPExtension {
  public readonly name = "openssl";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      openssl_random_pseudo_bytes: (ctx: PHPContext, lengthArg?: PHPReference) => {
        const length = Number(lengthArg?.get()) || 0;
        return crypto.randomBytes(length);
      },
      openssl_encrypt: (ctx: PHPContext, dataArg?: PHPReference, methodArg?: PHPReference, passphraseArg?: PHPReference) => {
        try {
          const data = String(dataArg?.get() ?? "");
          const method = String(methodArg?.get() ?? "");
          const passphrase = String(passphraseArg?.get() ?? "");
          const cipher = crypto.createCipheriv(method, passphrase, Buffer.alloc(16));
          let encrypted = cipher.update(data, "utf8", "base64");
          encrypted += cipher.final("base64");
          return encrypted;
        } catch {
          return false;
        }
      },
    };
  }
}
