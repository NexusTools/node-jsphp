# AI Agent Guidelines for `node-jsphp`

This document provides operational context and guidance for AI agents working on the `node-jsphp` codebase.

## Core Directives

1. **Synchronous PHP / Asynchronous JS**:
   PHP code semantics appear synchronous to the PHP script, but generated JavaScript code MUST run asynchronously using `async/await` so Node.js can handle concurrent requests without blocking.

2. **Stack Trace Masking**:
   Never expose raw JavaScript execution stack frames to PHP. Standardize all stack traces in `PHPError` to reflect PHP line numbers or `[INTERNAL]`.

3. **No Build Output Directory for Sources**:
   TypeScript source files in `src/` must compile to JavaScript `.js` and declaration `.d.ts` files placed directly alongside their corresponding `.ts` sources. Do NOT use a `dist/` or `out/` folder.

4. **AST Optimization Rules**:
   Always ensure optimizer handles `extension_loaded(...)`, `defined(...)`, and boolean expressions at compile time. Eliminate unreachable `if` branches before generating JS output.

5. **WordPress & MySQL Compatibility**:
   Maintain full compatibility with WordPress database operations and standard themes.
