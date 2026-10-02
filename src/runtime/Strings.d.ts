import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
export declare class StringRuntime {
    /** Gets string length. */
    static strlen(ctx: PHPContext, str: any): number;
    /** Count the number of substring occurrences. */
    static substr_count(ctx: PHPContext, haystack: any, needle: any, offset?: number, length?: number): number;
    /** Return part of a string. */
    static substr(ctx: PHPContext, str: string, start: number, length?: number): string;
    /** Replace text within a portion of a string. */
    static substr_replace(ctx: PHPContext, subject: any, replacement: any, offset: any, length?: any): string | string[];
    /** Find the position of the first occurrence of a substring in a string. */
    static strpos(ctx: PHPContext, haystack: string, needle: string, offset?: number): number | false;
    /** Find the position of the first occurrence of a case-insensitive substring in a string. */
    static stripos(ctx: PHPContext, haystack: string, needle: string, offset?: number): number | false;
    /** Find the position of the last occurrence of a substring in a string. */
    static strrpos(ctx: PHPContext, haystack: string, needle: string, offset?: number): number | false;
    /** Find the position of the last occurrence of a case-insensitive substring in a string. */
    static strripos(ctx: PHPContext, haystack: string, needle: string, offset?: number): number | false;
    /** Find the first occurrence of a string. */
    static strstr(ctx: PHPContext, haystack: string, needle: string, beforeNeedle?: boolean): string | false;
    /**
     * Replace all occurrences of the search string with the replacement string.
     * @param countRef Output variable passed by reference to receive replacement count.
     */
    static str_replace(ctx: PHPContext, search: any, replace: any, subject: any, countRef?: any): any;
    /** Translate characters or replace substrings. */
    static strtr(ctx: PHPContext, subject: any, from: any, to?: any): string;
    /** Case-insensitive version of str_replace. */
    static str_ireplace(ctx: PHPContext, search: any, replace: any, subject: any): any;
    /** Return a formatted string. */
    static sprintf(ctx: PHPContext, fmt: string, ...args: any[]): string;
    /** Output a formatted string. */
    static printf(ctx: PHPContext, fmt: string, ...args: any[]): Promise<number>;
    /** Split a string by a string. */
    static explode(ctx: PHPContext, delimiter: string, string: string, limit?: number): string[];
    /** Join array elements with a string. */
    static implode(ctx: PHPContext, glue: string, pieces: any[]): string;
    /** Strip whitespace (or other characters) from the beginning and end of a string. */
    static trim(ctx: PHPContext, str: string, charlist?: string): string;
    /** Strip whitespace (or other characters) from the beginning of a string. */
    static ltrim(ctx: PHPContext, str: string, charlist?: string): string;
    /** Strip whitespace (or other characters) from the end of a string. */
    static rtrim(ctx: PHPContext, str: string, charlist?: string): string;
    /** Make a string lowercase. */
    static strtolower(ctx: PHPContext, str: string): string;
    /** Make a string uppercase. */
    static strtoupper(ctx: PHPContext, str: string): string;
    /** Make a string's first character uppercase. */
    static ucfirst(ctx: PHPContext, str: string): string;
    /** Make a string's first character lowercase. */
    static lcfirst(ctx: PHPContext, str: string): string;
    /** Uppercase the first character of each word in a string. */
    static ucwords(ctx: PHPContext, str: string): string;
    /** Binary safe string comparison. */
    static strcmp(ctx: PHPContext, str1: string, str2: string): number;
    /** Binary safe string comparison of the first n characters. */
    static strncmp(ctx: PHPContext, str1: any, str2: any, length: number): number;
    /** Quote string with slashes. */
    static addslashes(ctx: PHPContext, str: string): string;
    static addcslashes(ctx: PHPContext, str: string, charlist: string): string;
    /** Un-quotes a quoted string. */
    static stripslashes(ctx: PHPContext, str: string): string;
    /** Convert special characters to HTML entities. */
    static htmlspecialchars(ctx: PHPContext, str: string): string;
    /** Convert special HTML entities back to characters. */
    static htmlspecialchars_decode(ctx: PHPContext, str: string): string;
    /** Inserts HTML line breaks before all newlines in a string. */
    static nl2br(ctx: PHPContext, str: string, isXhtml?: boolean): string;
    /** Repeat a string. */
    static str_repeat(ctx: PHPContext, input: string, multiplier: number): string;
    /** Pad a string to a certain length with another string. */
    static str_pad(ctx: PHPContext, input: string, padLength: number, padString?: string, padType?: number): string;
    /** Convert a string to an array. */
    static str_split(ctx: PHPContext, string: string, length?: number): string[];
    /** Reverse a string. */
    static strrev(ctx: PHPContext, string: string): string;
    /** Generate a single-byte string from a number. */
    static chr(ctx: PHPContext, ascii: number): string;
    /** Convert the first byte of a string to a value between 0 and 255. */
    static ord(ctx: PHPContext, character: string): number;
    /** Convert binary data into hexadecimal representation. */
    static bin2hex(ctx: PHPContext, string: string): string;
    /** Decodes a hexadecimally encoded binary string. */
    static hex2bin(ctx: PHPContext, hexString: string): string;
    /** Compares two "PHP-standardized" version number strings. */
    static version_compare(ctx: PHPContext, v1: string, v2: string, op?: string): any;
    /**
     * Parses encoded query string into variables.
     * @param result Output variable passed by reference to receive parsed key-value pairs.
     */
    static parse_str(ctx: PHPContext, query: string, result?: any): void;
    static functions: {
        parse_str: typeof StringRuntime.parse_str;
        version_compare: typeof StringRuntime.version_compare;
        strlen: typeof StringRuntime.strlen;
        substr_count: typeof StringRuntime.substr_count;
        substr: typeof StringRuntime.substr;
        substr_replace: typeof StringRuntime.substr_replace;
        strpos: typeof StringRuntime.strpos;
        stripos: typeof StringRuntime.stripos;
        strrpos: typeof StringRuntime.strrpos;
        strripos: typeof StringRuntime.strripos;
        strstr: typeof StringRuntime.strstr;
        str_replace: typeof StringRuntime.str_replace;
        strtr: typeof StringRuntime.strtr;
        str_ireplace: typeof StringRuntime.str_ireplace;
        sprintf: typeof StringRuntime.sprintf;
        printf: typeof StringRuntime.printf;
        explode: typeof StringRuntime.explode;
        implode: typeof StringRuntime.implode;
        trim: typeof StringRuntime.trim;
        ltrim: typeof StringRuntime.ltrim;
        rtrim: typeof StringRuntime.rtrim;
        strtolower: typeof StringRuntime.strtolower;
        strtoupper: typeof StringRuntime.strtoupper;
        ucfirst: typeof StringRuntime.ucfirst;
        lcfirst: typeof StringRuntime.lcfirst;
        ucwords: typeof StringRuntime.ucwords;
        strcmp: typeof StringRuntime.strcmp;
        strncmp: typeof StringRuntime.strncmp;
        addslashes: typeof StringRuntime.addslashes;
        stripslashes: typeof StringRuntime.stripslashes;
        htmlspecialchars: typeof StringRuntime.htmlspecialchars;
        htmlspecialchars_decode: typeof StringRuntime.htmlspecialchars_decode;
        nl2br: typeof StringRuntime.nl2br;
        str_repeat: typeof StringRuntime.str_repeat;
        str_pad: typeof StringRuntime.str_pad;
        str_split: typeof StringRuntime.str_split;
        strrev: typeof StringRuntime.strrev;
        chr: typeof StringRuntime.chr;
        ord: typeof StringRuntime.ord;
        bin2hex: typeof StringRuntime.bin2hex;
        hex2bin: typeof StringRuntime.hex2bin;
    };
    static register(engine: PHPEngine): void;
}
