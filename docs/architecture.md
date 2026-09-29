# Architecture Overview

`jsphp` consists of three core layers:

1. **`PHPEngine`**:
   - Manages loaded extensions, core functions, constants, and classes.
   - Computes configuration SHA1 hash based on active extensions and defines.
   - Manages file watching via `chokidar` and compilation caching.

2. **`PHPContext`**:
   - Manages per-request runtime state, environment variables, working directory, output buffers, and superglobals (`$_GET`, `$_POST`, `$_SERVER`, etc.).
   - Executes compiled JS functions within its isolated scope.

3. **AST Parser, Optimizer & Transpiler**:
   - Parses PHP 8.5 code into an AST representation.
   - Optimizes constant expressions and dead code branches.
   - Transpiles AST nodes into JS functions taking a `PHPContext` argument.
