import type { PHPContext } from "../../PHPContext";
export declare class ExecRuntime {
    static exec(ctx: PHPContext, command: string, outputArray?: any[], returnVarObj?: any): Promise<string>;
    static shell_exec(ctx: PHPContext, command: string): Promise<string | null>;
    static escapeshellarg(arg: string): string;
    static escapeshellcmd(cmd: string): string;
}
