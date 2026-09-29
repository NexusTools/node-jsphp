import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

export class PCREExtension extends PHPExtension {
  public readonly name = "pcre";

  public onInit(engine: PHPEngine): void {
    this.functions = {
      preg_match: (ctx: PHPContext, pattern: string, subject: string, matchesObj?: any) => {
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
        } catch {
          return false;
        }
      },
      preg_replace: (ctx: PHPContext, pattern: string, replacement: string, subject: string) => {
        try {
          const match = pattern.match(/^\/(.*)\/([a-z]*)$/);
          const regex = match ? new RegExp(match[1], match[2]) : new RegExp(pattern);
          return String(subject || "").replace(regex, replacement);
        } catch {
          return subject;
        }
      },
    };
  }
}
