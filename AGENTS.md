# AI Agent Guidelines for `node-jsphp` (`@nexustools/php`)

This document provides operational context, architecture directives, and guidance for AI agents working on the `@nexustools/php` codebase.

## Core Directives

1. **Synchronous PHP / Asynchronous JS**:
   PHP code semantics appear synchronous to the PHP script, but transpiled JavaScript code MUST run asynchronously using `async/await` so Node.js can handle concurrent execution without blocking the event loop.

2. **Stack Trace Virtualization**:
   Never expose raw JavaScript execution stack frames to PHP. Standardize all stack traces in `PHPError` to reflect PHP source line numbers or `[INTERNAL]`.

3. **No Build Output Directory for Sources**:
   TypeScript source files in `src/` compile to JavaScript `.js` and declaration `.d.ts` files placed directly alongside their corresponding `.ts` sources. Do NOT use a `dist/` or `out/` folder.

4. **AST Optimization Rules**:
   Ensure `ASTOptimizer` optimizes `extension_loaded(...)`, `defined(...)`, `constant(...)` and more, constant references (`name` / `constref`), and boolean expressions at compile time. Eliminate dead `if` branches prior to code generation.

5. **CLI & Server Binaries**:
   - `php` (`bin/php.js`): Single-file CLI execution binary.
   - `php-fpm` (`bin/php-fpm.js`): FastCGI (FCGI 1.0) binary socket server for Nginx/Apache proxying.
   - `php-http-server` (`bin/php-http-server.js`): HTTP web server supporting static file serving and smart URL resolution (`/` -> `index.php`/`index.html`, `/test` -> `test.php`/`test.html`/`test/index.php`).

6. **Internal Variables (`internalVars`)**:
   `PHPEngine` and `PHPContext` maintain `internalVars` (`Map<string, any>`) that are invisible to PHP userland (`$GLOBALS`, `get_defined_vars()`, Reflection), but accessible to internal engine methods, AST optimization, and server handlers.

7. **Header & Response Lifecycle**:
   HTTP response functions (`header`, `setcookie`, `setrawcookie`, `header_remove`, `headers_list`, `headers_sent`, `http_response_code`) operate on `PHPResponse` attached to `PHPContext`. Calling header functions in CLI mode without a registered server response handler throws a `PHPWarning` / `PHPError`.

8. **Error Handling & `set_error_handler`**:
   Supports `set_error_handler`, `restore_error_handler`, `trigger_error`, `error_reporting`, and `ErrorException`. Errors thrown within PHP methods use subclasses of `PHPError` (`PHPFatalError`, `PHPWarning`, `PHPNotice`, `PHPTypeError`, etc.).

9. **Reflection Metadata & JS Source Fallback**:
   Function/method metadata is tracked via `.phpMeta` attached by `defineFunction`. If `.phpMeta` is absent, `ReflectionFunction` and `ReflectionMethod` fall back to parsing the function's JavaScript `.toString()` source declaration.

10. **Optional Node.js Interop (`nodejs` extension)**:
    Provides Node.js module/package loading (`nodejs_require`), global variable access (`nodejs_global`), eval (`nodejs_eval`), and instantiation (`nodejs_new` / `NodeJS` class) wrapped via `NodeJSObject`.

11. **WordPress & MySQL Compatibility**:
    Maintain full compatibility with WordPress database operations (`mysqli`), installation flows, and theme/admin dashboard rendering tested against a local MySQL database.
