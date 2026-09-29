export declare class FileSystemRuntime {
    static file_get_contents(filepath: string): string | false;
    static file_put_contents(filepath: string, data: any, flags?: number): number | false;
    static file_exists(filepath: string): boolean;
    static is_dir(filepath: string): boolean;
    static is_file(filepath: string): boolean;
    static unlink(filepath: string): boolean;
}
