import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
import { PHPReference } from "./PHPVariable.js";
export declare class StringRuntime {
    /** Gets string length. */
    static strlen(ctx: PHPContext, strArg?: any): number;
    /** Count the number of substring occurrences. */
    static substr_count(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): number;
    /** Return part of a string. */
    static substr(ctx: PHPContext, strArg?: PHPReference, startArg?: PHPReference, lengthArg?: PHPReference): string;
    /** Replace text within a portion of a string. */
    static substr_replace(ctx: PHPContext, subjectArg?: PHPReference, replacementArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): string | string[];
    /** Find the position of the first occurrence of a substring in a string. */
    static strpos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false;
    /** Find the position of the first occurrence of a case-insensitive substring in a string. */
    static stripos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false;
    /** Find the position of the last occurrence of a substring in a string. */
    static strrpos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false;
    /** Find the position of the last occurrence of a case-insensitive substring in a string. */
    static strripos(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, offsetArg?: PHPReference): number | false;
    /** Find the first occurrence of a string. */
    static strstr(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference, beforeNeedleArg?: PHPReference): string | false;
    /**
     * Replace all occurrences of the search string with the replacement string.
     * @param countRef Output variable passed by reference to receive replacement count.
     */
    static str_replace(ctx: PHPContext, searchArg?: PHPReference, replaceArg?: PHPReference, subjectArg?: PHPReference, countRef?: PHPReference): any;
    /** Translate characters or replace substrings. */
    static strtr(ctx: PHPContext, subjectArg?: PHPReference, fromArg?: PHPReference, toArg?: PHPReference): string;
    /** Case-insensitive version of str_replace. */
    static str_ireplace(ctx: PHPContext, searchArg?: PHPReference, replaceArg?: PHPReference, subjectArg?: PHPReference, countRef?: PHPReference): any;
    /** Return a formatted string. */
    static sprintf(ctx: PHPContext, fmtArg?: PHPReference, ...args: PHPReference[]): string;
    /** Output a formatted string. */
    static printf(ctx: PHPContext, fmtArg?: PHPReference, ...args: PHPReference[]): Promise<number>;
    /** Split a string by a string. */
    static explode(ctx: PHPContext, delimiterArg?: PHPReference, stringArg?: PHPReference, limitArg?: PHPReference): string[];
    /** Join array elements with a string. */
    static implode(ctx: PHPContext, glueArg?: PHPReference, piecesArg?: PHPReference): string;
    /** Strip whitespace (or other characters) from the beginning and end of a string. */
    static trim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string;
    /** Strip whitespace (or other characters) from the beginning of a string. */
    static ltrim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string;
    /** Strip whitespace (or other characters) from the end of a string. */
    static rtrim(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string;
    /** Strip HTML and PHP tags from a string. */
    static strip_tags(ctx: PHPContext, strArg?: PHPReference, allowable_tagsArg?: PHPReference): string;
    /** Make a string lowercase. */
    static strtolower(ctx: PHPContext, strArg?: PHPReference): string;
    /** Make a string uppercase. */
    static strtoupper(ctx: PHPContext, strArg?: PHPReference): string;
    /** Make a string's first character uppercase. */
    static ucfirst(ctx: PHPContext, strArg?: PHPReference): string;
    /** Make a string's first character lowercase. */
    static lcfirst(ctx: PHPContext, strArg?: PHPReference): string;
    /** Uppercase the first character of each word in a string. */
    static ucwords(ctx: PHPContext, strArg?: PHPReference): string;
    /** Binary safe string comparison. */
    static strcmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference): number;
    /** Binary safe string comparison of the first n characters. */
    static strncmp(ctx: PHPContext, str1Arg?: PHPReference, str2Arg?: PHPReference, lengthArg?: PHPReference): number;
    /** Quote string with slashes. */
    static addslashes(ctx: PHPContext, strArg?: PHPReference): string;
    static addcslashes(ctx: PHPContext, strArg?: PHPReference, charlistArg?: PHPReference): string;
    /** Un-quotes a quoted string. */
    static stripslashes(ctx: PHPContext, strArg?: PHPReference): string;
    static stripcslashes(ctx: PHPContext, strArg?: PHPReference): string;
    /** Convert special characters to HTML entities. */
    static htmlspecialchars(ctx: PHPContext, strArg?: PHPReference): string;
    /** Convert special HTML entities back to characters. */
    static htmlspecialchars_decode(ctx: PHPContext, strArg?: PHPReference): string;
    static htmlentities(ctx: PHPContext, strArg?: PHPReference): string;
    static html_entity_decode(ctx: PHPContext, strArg?: PHPReference): string;
    static unpack(ctx: PHPContext, formatArg?: PHPReference, stringArg?: PHPReference, offsetArg?: PHPReference): Record<string, number> | false;
    static pack(ctx: PHPContext, formatArg?: PHPReference, ...args: PHPReference[]): string;
    private static strtokState;
    static strtok(ctx: PHPContext, strArg?: PHPReference, tokenArg?: PHPReference): string | false;
    /** Inserts HTML line breaks before all newlines in a string. */
    static nl2br(ctx: PHPContext, strArg?: PHPReference, isXhtmlArg?: PHPReference): string;
    /** Repeat a string. */
    static str_repeat(ctx: PHPContext, inputArg?: PHPReference, multiplierArg?: PHPReference): string;
    /** Pad a string to a certain length with another string. */
    static str_pad(ctx: PHPContext, inputArg?: PHPReference, padLengthArg?: PHPReference, padStringArg?: PHPReference, padTypeArg?: PHPReference): string;
    /** Convert a string to an array. */
    static str_split(ctx: PHPContext, stringArg?: PHPReference, lengthArg?: PHPReference): string[];
    /** Reverse a string. */
    static strrev(ctx: PHPContext, stringArg?: PHPReference): string;
    /** Generate a single-byte string from a number. */
    static chr(ctx: PHPContext, asciiArg?: PHPReference): string;
    /** Convert the first byte of a string to a value between 0 and 255. */
    static ord(ctx: PHPContext, characterArg?: PHPReference): number;
    /** Convert binary data into hexadecimal representation. */
    static bin2hex(ctx: PHPContext, stringArg?: PHPReference): string;
    /** Decodes a hexadecimally encoded binary string. */
    static hex2bin(ctx: PHPContext, hexStringArg?: PHPReference): string;
    /** Compares two "PHP-standardized" version number strings. */
    static version_compare(ctx: PHPContext, v1Arg?: PHPReference, v2Arg?: PHPReference, opArg?: PHPReference): any;
    /**
     * Parses encoded query string into variables.
     * @param result Output variable passed by reference to receive parsed key-value pairs.
     */
    static parse_str(ctx: PHPContext, queryArg?: PHPReference, result?: PHPReference): void;
    static strspn(ctx: PHPContext, stringArg?: PHPReference, charactersArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): number;
    static strcspn(ctx: PHPContext, stringArg?: PHPReference, charactersArg?: PHPReference, offsetArg?: PHPReference, lengthArg?: PHPReference): number;
    static vsprintf(ctx: PHPContext, formatArg?: PHPReference, valuesArg?: PHPReference): string;
    static str_starts_with(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference): boolean;
    static str_ends_with(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference): boolean;
    static str_contains(ctx: PHPContext, haystackArg?: PHPReference, needleArg?: PHPReference): boolean;
    static vprintf(ctx: PHPContext, formatArg?: PHPReference, valuesArg?: PHPReference): number;
    static functions: {
        str_starts_with: typeof StringRuntime.str_starts_with;
        str_ends_with: typeof StringRuntime.str_ends_with;
        str_contains: typeof StringRuntime.str_contains;
        parse_str: typeof StringRuntime.parse_str;
        version_compare: typeof StringRuntime.version_compare;
        unpack: typeof StringRuntime.unpack;
        pack: typeof StringRuntime.pack;
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
        vsprintf: typeof StringRuntime.vsprintf;
        vprintf: typeof StringRuntime.vprintf;
        strspn: typeof StringRuntime.strspn;
        strcspn: typeof StringRuntime.strcspn;
        explode: typeof StringRuntime.explode;
        implode: typeof StringRuntime.implode;
        trim: typeof StringRuntime.trim;
        ltrim: typeof StringRuntime.ltrim;
        rtrim: typeof StringRuntime.rtrim;
        strip_tags: typeof StringRuntime.strip_tags;
        strtolower: typeof StringRuntime.strtolower;
        strtoupper: typeof StringRuntime.strtoupper;
        ucfirst: typeof StringRuntime.ucfirst;
        lcfirst: typeof StringRuntime.lcfirst;
        ucwords: typeof StringRuntime.ucwords;
        strcmp: typeof StringRuntime.strcmp;
        strncmp: typeof StringRuntime.strncmp;
        addslashes: typeof StringRuntime.addslashes;
        addcslashes: typeof StringRuntime.addcslashes;
        stripslashes: typeof StringRuntime.stripslashes;
        stripcslashes: typeof StringRuntime.stripcslashes;
        htmlspecialchars: typeof StringRuntime.htmlspecialchars;
        htmlspecialchars_decode: typeof StringRuntime.htmlspecialchars_decode;
        htmlentities: typeof StringRuntime.htmlentities;
        html_entity_decode: typeof StringRuntime.html_entity_decode;
        strtok: typeof StringRuntime.strtok;
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
