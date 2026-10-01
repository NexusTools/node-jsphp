import type { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
export declare class ExecRuntime {
    /**
     * Execute an external program.
     * @param outputArray Output variable passed by reference to receive output lines.
     * @param returnVarObj Output variable passed by reference to receive exit status code.
     */
    static exec(ctx: PHPContext, command: string, outputArray?: any, returnVarObj?: any): Promise<string>;
    static shell_exec(ctx: PHPContext, command: string): Promise<string | null>;
    static escapeshellarg(ctx: PHPContext, arg: string): string;
    static escapeshellcmd(ctx: PHPContext, cmd: string): string;
    static functions: {
        exec: typeof ExecRuntime.exec;
        shell_exec: typeof ExecRuntime.shell_exec;
        escapeshellarg: typeof ExecRuntime.escapeshellarg;
        escapeshellcmd: typeof ExecRuntime.escapeshellcmd;
    };
    static register(engine: PHPEngine): void;
}
