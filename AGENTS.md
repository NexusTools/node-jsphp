# Agent Guidelines for `@nexustools/php`

These instructions define the runtime and transpiler contracts for this repository. Preserve PHP semantics while making generated JavaScript the most direct, efficient representation of the source PHP. When a design choice is not specified here or by the user, ask before choosing behavior.

## Runtime and async contract

- PHP code retains PHP semantics, while generated JavaScript uses native asynchronous execution. Generated PHP functions, methods, constructors, and registered runtime/extension functions are `async` and return `Promise<any>`.
- Runtime and extension functions accept `PHPReference` arguments. Their resolved results may be ordinary PHP values or `PHPReference` objects; do not wrap every return value merely to satisfy the promise contract.
- `PHPReference.get()` and `PHPReference.set(value)` are asynchronous and return promises. Access values with `await reference.get()` and mutate them with `await reference.set(value)`.
- All PHP-callable runtime and extension functions are async and return promises before registration; registration does not wrap functions. All function, class, and constant registry names are lowercase plain strings, and `encodePhpIdentifier` is only for emitted JavaScript identifiers.
- Filesystem operations are asynchronous throughout the engine, runtime, extensions, compiler cache, and CLI. Do not use synchronous filesystem APIs. `JSTranspiler.transpile()` is asynchronous because its cache I/O is asynchronous.
- `PHPVariable` represents mutable PHP state. Engine-created literals use `PHPLiteral`; generated scripts may hoist static string call arguments into reusable `BasicLiteral` instances branded with `Symbol.for("php.reference")`. Both reject writes with `Literals cannot be changed`.
- PHP by-reference variables and parameters share the same `PHPReference` object in all scopes that refer to that variable. Do not introduce reference-forwarding chains or `bindRef`, `unbindRef`, `isReference`, or `PHPReference.call` APIs.
- PHP method/function arguments remain references so by-reference parameters can share identity. Do not unwrap an argument before invocation unless PHP semantics require a value.

## PHP classes and JavaScript output

- Transpile PHP classes to native JavaScript classes. Emit PHP static methods as JavaScript `static` methods and PHP instance methods as JavaScript instance methods. Keep methods on their native class/prototype locations; call the correct method directly.
- Emit PHP variables as `$`-prefixed JavaScript bindings. PHP instance and static properties are stored directly on their JavaScript object/class using `$`-prefixed names. Every property value is a `PHPReference`. Methods do not use the `$` prefix.
- Never emit a native JavaScript class `constructor` for a PHP constructor. Emit an async `__construct(ctx, ...args)` instance method. Instantiate PHP classes only through the static async method keyed by `SYMBOL_PHP_NEW`; never transpile PHP instantiation to `new ClassName(...)`.
- The `[SYMBOL_PHP_NEW]` factory creates an object without invoking a native constructor, initializes its PHP property references through `[SYMBOL_PHP_INIT]`, invokes `__construct` unconditionally, and returns the instance. Use `Object.create(this.prototype)` where needed to retain native JavaScript inheritance.
- Generate direct property and method operations whenever possible: `await object.$property.get()`, `await object.$property.set(value)`, and `await object.method(ctx, ...args)`. Do not route ordinary declared-property or direct method accesses through `PHPContext` lookup helpers.
- PHP `parent::method()` calls use native JavaScript `super.method(ctx, ...args)` in the matching static or instance context. Do not probe a class prototype as a fallback for static methods or probe a constructor as a fallback for instance methods.

## Magic methods and property references

- Classes with instance magic methods are returned as JavaScript `Proxy` objects from `[SYMBOL_PHP_NEW]`. Classes without instance magic methods return raw instances without proxy overhead.
- The instance proxy distinguishes property keys from method keys by the leading `$`. For a `$` property key, it returns the existing property reference or a `PHPPropertyReference` that performs the magic operation asynchronously. For a non-`$` key, it returns the native method or a generated async `__call` dispatcher.
- JavaScript Proxy traps are synchronous. Do not await PHP magic methods inside a trap. Async `PHPPropertyReference` operations perform `__get`, `__set`, `__isset`, and `__unset` as appropriate.
- `isset($object->property)` and `unset($object->property)` use async operations on the property reference, allowing `__isset` and `__unset` to run. Preserve PHP null and unset semantics for declared properties.
- Store a class constructor behind a class-level JavaScript `Proxy` only when the class defines `__callStatic`. The proxy returns a generated async dispatcher for missing static methods; ordinary static methods and classes remain direct.
- The factory and initializer are engine internals, not string-named PHP methods: declare and invoke them only as `[SYMBOL_PHP_NEW]` and `[SYMBOL_PHP_INIT]` symbol-keyed static methods. Use these symbols for PHP class inheritance/initialization and all built-in/extension class factories as well as transpiled classes.
- Magic dispatchers pass PHP arguments and the original PHP method/property name with PHP-compatible value/reference semantics. Keep generated dispatch as direct as possible; restrict dynamic name conversion to genuinely dynamic names.

## Identifiers and reflection metadata

- Use one shared, deterministic PHP-to-JavaScript identifier converter for generated JavaScript identifiers and property keys. Never encode PHP function, class, or constant names when registering or looking them up in runtime Records; those registry keys are already lowercase PHP names and remain plain strings.
- Preserve ASCII letters, digits, and underscores. Encode every other UTF-8 byte as `$HH` using uppercase hexadecimal, including literal `$` bytes within the name. Preserve the leading `$` sigil for PHP variable/property names; encode any literal `$` in the name. The encoding must be collision-free and produce valid JavaScript identifiers/property keys; account for JavaScript-special names such as `constructor`.
- Lowercase PHP's case-insensitive identifiers at transpile time: class names, namespaces, functions, methods, and constants. Preserve case-sensitive variable and property names.
- Store namespaced class and function registry keys with lowercase namespace/name segments joined by `$$` (for example, `Runtime\One\Item` becomes `runtime$$one$$item`); nested namespaces use one `$$` between every segment. Generated JavaScript identifiers preserve these separators while encoding each segment independently. Keep original backslash-separated spelling and casing in symbol metadata for reflection and diagnostics.
- Retain original source casing in symbol-backed metadata when needed for reflection, magic-method arguments, and PHP diagnostics. Do not carry duplicate runtime strings when casing can be recovered from metadata or the reversible encoding.
- Store engine-owned class and reflection metadata using exported `Symbol` constants, not string properties such as `__php_properties`, `__php_constants`, or `__php_parent`. This includes class name, property/method/constant metadata, parent class, implemented interfaces, and magic-method flags. `SYMBOL_PHP_PROPERTIES`, `SYMBOL_PHP_METHODS`, and `SYMBOL_PHP_CONSTANTS` values are Records/object literals, never `Map` instances. Actual PHP properties and methods stay directly on the JavaScript class/object under their emitted names.
- Do not use JavaScript `Map` or `WeakMap` anywhere in the codebase. Use null-prototype Records for string-keyed collections, arrays for identity-keyed collections, and `Set` where membership semantics are needed.
- Function and method reflection metadata uses `SYMBOL_PHP_META` exclusively. Do not attach or read a string-named `phpMeta` property. If symbol metadata is unavailable, reflection may fall back to parsing the JavaScript function source.

## Performance and diagnostics

- Generated output should look like a direct JavaScript representation of the PHP program. Avoid redundant closures, dynamic dispatch checks, prototype probing, repeated case conversion, metadata scans, context helpers, and other per-operation overhead when direct JavaScript suffices.
- Resolve cross-file function and class registry references lazily at first executed use so preceding `require`/`include` statements can register them; cache successful lookups within their transpile scope.
- Analyze each function, method, and closure body before emitting scope management. Emit `pushScope`/`popScope` only for PHP scope-dependent behavior (such as globals/statics, variable variables, includes/eval, scope inspection/extraction, offset helpers, or argument introspection); otherwise use local `PHPVariable`s or direct `$arg_*` arguments. Emit `argPHPVar` only when PHP reference identity, mutable by-value parameter copies, or context-visible parameters require it. Use `const` for stable bindings and `let` only when the binding is reassigned.
- Hoist static string arguments to PHP calls into module-level immutable `BasicLiteral` constants, reusing each value within the compiled script. Keep literals created by engine-internal operations as `PHPLiteral`.
- Do not emit loop tick counters, `checkLoop()` calls, cooperative yielding, PHP-engine call-stack tracking, or per-call debug instrumentation. Trusted PHP that loops indefinitely behaves like JavaScript that loops indefinitely.
- Do not block Node.js with synchronous filesystem or password-hashing APIs; use their asynchronous equivalents.
- Remove `JSPHP_DEBUG`, its environment checks, and internal debug-only logging. Retain actual PHP error handling, PHP's `error_log()` function, and diagnostics required to report real failures.
- Generate source maps and use source-map-mapped native JavaScript error stacks when the active entrypoint has already installed `source-map-support`. Do not install or import `source-map-support` globally from the engine. `debug_backtrace()` parses native JavaScript `Error` frames as-is when mapping support is absent; do not maintain a PHP call stack to construct traces.
- Native JavaScript errors caught by PHP `try/catch` are wrapped as PHP `Error` instances. Preserve PHP error classes, error handlers, and source locations without adding hot-path tracking.
- Increment `PHPEngine.REVISION` whenever runtime or transpiler changes can invalidate compiled-code caches.

## Runtime behavior to preserve

- `PHPEngine` and `PHPContext` keep `internalVars` invisible to PHP userland (`$GLOBALS`, `get_defined_vars()`, and reflection).
- Output buffering supports nested buffers and flushes remaining output and shutdown functions at the established top-level `require`/`eval` lifecycle boundaries.
- HTTP response functions use the `PHPResponse` attached to `PHPContext`. Preserve CLI/server distinctions and existing warning/error behavior.
- Keep case-insensitive PHP lookup behavior for user-supplied names in functions such as `define`, `defined`, `class_exists`, `function_exists`, `constant`, and `is_callable`; preserve user-provided casing in diagnostics.
- Function, class, and constant registry names are already lowercase before registration. Do not call `toLowerCase()` or `encodePhpIdentifier()` for registry keys.
- `PHPEngine.registerFunction(name, fn)` directly assigns `this.functions[name] = fn`; `registerFunctions(functions)` uses `Object.assign(this.functions, functions)`. These accept already-async functions and do not wrap or modify metadata.
- `PHPEngine.registerClass(name, value)` directly assigns `this.classes[name] = value`; `registerClasses(classes)` uses `Object.assign(this.classes, classes)`.
- Preserve Node.js interoperability through the `nodejs` extension and its dedicated proxy symbols.
- Maintain WordPress and MySQL compatibility, including installation, administrator access, dashboard/theme rendering, `mysqli` operations, and the end-to-end WordPress test.
- Preserve the CLI, FastCGI, and HTTP server binaries and their documented behavior.

## Validation

- Follow the existing TypeScript, generated JavaScript/declaration/source-map, formatting, and test conventions. Keep generated artifacts in sync using the repository build.
- Add focused regression tests for changes to references, name conversion, native class emission, magic instance/static dispatch, reflection, and source-mapped stack traces.
- Run the smallest relevant tests first, then the WordPress end-to-end test when changing runtime, class, or transpiler behavior. Run the build/type check after source changes.
- Do not revert or stage unrelated work in a dirty worktree.
