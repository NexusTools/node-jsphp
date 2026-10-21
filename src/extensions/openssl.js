import * as crypto from "crypto";
import { PHPExtension } from "../PHPExtension.js";
export class OpenSSLExtension extends PHPExtension {
    name = "openssl";
    onInit(engine) {
        this.functions = {
            openssl_random_pseudo_bytes: async (ctx, lengthArg) => {
                const length = Number(await lengthArg?.get()) || 0;
                return crypto.randomBytes(length);
            },
            openssl_encrypt: async (ctx, dataArg, methodArg, passphraseArg) => {
                try {
                    const data = String(await dataArg?.get() ?? "");
                    const method = String(await methodArg?.get() ?? "");
                    const passphrase = String(await passphraseArg?.get() ?? "");
                    const cipher = crypto.createCipheriv(method, passphrase, Buffer.alloc(16));
                    let encrypted = cipher.update(data, "utf8", "base64");
                    encrypted += cipher.final("base64");
                    return encrypted;
                }
                catch {
                    return false;
                }
            },
        };
    }
}
//# sourceMappingURL=openssl.js.map