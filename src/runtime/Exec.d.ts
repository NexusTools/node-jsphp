import type { PHPContext } from "../PHPContext";
import type { PHPEngine } from "../PHPEngine";
import { PHPReference } from "./PHPVariable";
export declare class ExecRuntime {
    /**
     * Execute an external program.
     * @param outputArray Output variable passed by reference to receive output lines.
     * @param returnVarObj Output variable passed by reference to receive exit status code.
     */
    static exec(ctx: PHPContext, commandArg?: PHPReference, outputArray?: PHPReference, returnVarObj?: PHPReference): Promise<string>;
    static shell_exec(ctx: PHPContext, commandArg?: PHPReference): Promise<string | null>;
    static escapeshellarg(ctx: PHPContext, argParam?: PHPReference): string;
    static escapeshellcmd(ctx: PHPContext, cmdParam?: PHPReference): string;
    static functions: {
        exec: typeof ExecRuntime.exec;
        shell_exec: typeof ExecRuntime.shell_exec;
        escapeshellarg: typeof ExecRuntime.escapeshellarg;
        escapeshellcmd: typeof ExecRuntime.escapeshellcmd;
    };
    static register(engine: PHPEngine): void;
}
