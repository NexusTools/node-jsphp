import * as crypto from "crypto";
import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

export class OpenSSLExtension extends PHPExtension {
  public readonly name = "openssl";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      openssl_random_pseudo_bytes: (ctx: PHPContext, length: number) => {
        return crypto.randomBytes(length);
      },
      openssl_encrypt: (ctx: PHPContext, data: string, method: string, passphrase: string) => {
        try {
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
