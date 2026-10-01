import type { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
export declare class ExecRuntime {
    static register(engine: PHPEngine): void;
    static exec(ctx: PHPContext, command: string, outputArray?: any[], returnVarObj?: any): Promise<string>;
    static shell_exec(ctx: PHPContext, command: string): Promise<string | null>;
    static escapeshellarg(arg: string): string;
    static escapeshellcmd(cmd: string): string;
}
