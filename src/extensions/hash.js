import * as crypto from "crypto";
import { PHPExtension } from "../PHPExtension.js";
import { PHPLiteral } from "../runtime/PHPVariable.js";
export class HashExtension extends PHPExtension {
    name = "hash";
    onInit(engine) {
        this.functions = {
            md5: (ctx, dataArg, rawOutputArg) => {
                const data = dataArg?.get();
                const rawOutput = Boolean(rawOutputArg?.get());
                return this.functions.hash(ctx, new PHPLiteral("md5"), new PHPLiteral(Buffer.isBuffer(data) ? data : String(data ?? "")), new PHPLiteral(rawOutput));
            },
            sha1: (ctx, dataArg, rawOutputArg) => {
                const data = dataArg?.get();
                const rawOutput = Boolean(rawOutputArg?.get());
                return this.functions.hash(ctx, new PHPLiteral("sha1"), new PHPLiteral(Buffer.isBuffer(data) ? data : String(data ?? "")), new PHPLiteral(rawOutput));
            },
            hash: (ctx, algoArg, dataArg, rawOutputArg) => {
                try {
                    const algo = String(algoArg?.get() ?? "");
                    const data = String(dataArg?.get() ?? "");
                    const rawOutput = Boolean(rawOutputArg?.get());
                    const h = crypto.createHash(algo).update(data);
                    return rawOutput ? h.digest() : h.digest("hex");
                }
                catch {
                    return false;
                }
            },
            hash_hmac: (ctx, algoArg, dataArg, keyArg, rawOutputArg) => {
                try {
                    const algo = String(algoArg?.get() ?? "");
                    const data = String(dataArg?.get() ?? "");
                    const key = String(keyArg?.get() ?? "");
                    const rawOutput = Boolean(rawOutputArg?.get());
                    const h = crypto.createHmac(algo, key).update(data);
                    return rawOutput ? h.digest() : h.digest("hex");
                }
                catch {
                    return false;
                }
            },
        };
    }
}
//# sourceMappingURL=hash.js.map