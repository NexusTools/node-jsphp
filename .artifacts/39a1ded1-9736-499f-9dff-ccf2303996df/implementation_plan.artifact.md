# Direct Function/Method Execution & JS Error Wrapping Implementation Plan

Remove overhead from `callFunction` and `callMethod` wrappers by calling functions and methods directly from transpiled JavaScript, and wrapping any thrown JavaScript errors into PHP error instances via `PHPError.wrapJSError()`.

## Proposed Changes

### Runtime & Error Handling

#### [MODIFY] [PHPError.ts](file:///G:/My%20Drive/Documents/GitHub/node-jsphp/src/runtime/PHPError.ts)
- Add `PHPError.wrapJSError(err: any): PHPError` helper method.
- If `err` is already a `PHPError` / `PHPThrowable`, return it as-is.
- If `err` is a JavaScript `Error` (e.g., `TypeError`, `ReferenceError`, `RangeError`), wrap its message into a `PHPError` or `PHPTypeError`.

#### [MODIFY] [PHPContext.ts](file:///G:/My%20Drive/Documents/GitHub/node-jsphp/src/PHPContext.ts)
- Add `functionMissing(name: string): Function` to throw `PHPFatalError("Call to undefined function " + name + "()")`.
- Add `methodMissing(obj: any, method: string): any` to throw `PHPFatalError("Call to undefined method " + method + "()")`.
- Remove `callFunction` and `callMethod`.

### Parser & Transpiler

#### [MODIFY] [JSTranspiler.ts](file:///G:/My%20Drive/Documents/GitHub/node-jsphp/src/parser/JSTranspiler.ts)
- Update function calls transpilation: replace `ctx.callFunction(name, args)` with direct invocation:
  `(ctx.functions[<name>] || ctx.engine.functions[<name>] || ctx.functionMissing(<name>))(ctx, ...args)`
- Update method calls transpilation: replace `ctx.callMethod(obj, method, args)` with direct invocation and `__call` fallback:
  `(typeof <obj>.<method> === "function" ? <obj>.<method>(ctx, ...args) : typeof <obj>.__call === "function" ? await <obj>.__call(ctx, new PHPLiteral(<method>), new PHPLiteral([...args])) : ctx.methodMissing(<obj>, <method>))`
- Update static method calls transpilation: direct invocation or `__callStatic` fallback.
- Update `catch` block transpilation to ensure caught JS errors are wrapped using `PHPError.wrapJSError(err)`.

## Verification Plan

### Automated Tests
- Run `npm run build`
- Run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit.test.ts`
- Run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/http_server.test.ts`
- Run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/fpm.test.ts`
- Run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/extensions/nodejs.test.ts`
- Run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/runtime/reflection.test.ts`
