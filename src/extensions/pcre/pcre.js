"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PCREExtension = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class PCREExtension extends PHPExtension_1.PHPExtension {
    name = "pcre";
    onInit(engine) {
        this.functions = {
            preg_match: (ctx, pattern, subject, matchesObj) => {
                try {
                    const match = pattern.match(/^\/(.*)\/([a-z]*)$/);
                    const regex = match ? new RegExp(match[1], match[2]) : new RegExp(pattern);
                    const res = String(subject || "").match(regex);
                    if (res) {
                        if (matchesObj) {
                            matchesObj[0] = Array.from(res);
                        }
                        return 1;
                    }
                    return 0;
                }
                catch {
                    return false;
                }
            },
            preg_replace: (ctx, pattern, replacement, subject) => {
                try {
                    const match = pattern.match(/^\/(.*)\/([a-z]*)$/);
                    const regex = match ? new RegExp(match[1], match[2]) : new RegExp(pattern);
                    return String(subject || "").replace(regex, replacement);
                }
                catch {
                    return subject;
                }
            },
        };
    }
}
exports.PCREExtension = PCREExtension;
//# sourceMappingURL=pcre.js.map