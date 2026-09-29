# AST Optimizer & Transpiler

## Optimization Pipeline

1. **`PHPParser`**: Parses PHP source code into AST.
2. **`ASTOptimizer`**:
   - Replaces `extension_loaded("ext")` calls with `true` or `false` based on engine configuration.
   - Replaces `defined("CONST")` with `true` or `false`.
   - Prunes `if (false)` branches.
   - Unwraps `if (true)` blocks.
3. **`JSTranspiler`**:
   - Generates async JavaScript code using `ctx.getVar()`, `ctx.setVar()`, `ctx.echo()`, and `await ctx.callFunction()`.
   - Generates source maps (`.js.map`).
   - Writes compiled outputs to disk cache at `${process.env.JSPHP_CACHE}/${EngineSHA1}/${FilePathSHA1}.js`.
