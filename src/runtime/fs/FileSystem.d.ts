export declare class FileSystemRuntime {
    static file_get_contents(filepath: string): Promise<string | false>;
    static file_put_contents(filepath: string, data: any, flags?: number): Promise<number | false>;
    static file_exists(filepath: string): Promise<boolean>;
    static is_dir(filepath: string): Promise<boolean>;
    static is_file(filepath: string): Promise<boolean>;
    static is_readable(filepath: string): Promise<boolean>;
    static is_writable(filepath: string): Promise<boolean>;
    static filesize(filepath: string): Promise<number | false>;
    static filemtime(filepath: string): Promise<number | false>;
    static realpath(filepath: string): Promise<string | false>;
    static basename(filepath: string, suffix?: string): string;
    static dirname(filepath: string): string;
    static pathinfo(filepath: string, flags?: number): Record<string, string>;
    static mkdir(dirpath: string, mode?: number, recursive?: boolean): Promise<boolean>;
    static rmdir(dirpath: string): Promise<boolean>;
    static unlink(filepath: string): Promise<boolean>;
    static rename(oldname: string, newname: string): Promise<boolean>;
    static copy(source: string, dest: string): Promise<boolean>;
    static tempnam(dir: string, prefix: string): Promise<string | false>;
    static sys_get_temp_dir(): string;
    static scandir(dirpath: string): Promise<string[] | false>;
}
