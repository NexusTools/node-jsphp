# @nexustools/php (`node-jsphp`)

`@nexustools/php` is a high-performance Node.js runtime, CLI, and transpiler engine for **PHP 8.5** written in TypeScript. It parses PHP code into ASTs, optimizes execution through constant folding and dead-code elimination, and transpiles PHP to asynchronous JavaScript source code with source maps (`.js.map`).

`@nexustools/php` enables running PHP scripts, applications (including full **WordPress** sites), and command-line interfaces directly inside Node.js without needing native PHP binaries or socket connections to PHP-FPM.

---

## Features

- **PHP 8.5 Support**: Full support for PHP 8.5 language constructs, functions, and standard library.
- **Asynchronous Execution Model**: All transpiled JavaScript code runs asynchronously via `async/await`, preventing blocking of Node.js event loop while executing PHP synchronously from PHP's perspective.
- **Transparent Stack Trace Virtualization**: JavaScript stack traces are filtered and mapped to PHP file and line locations, displaying internal Node.js frames as `[INTERNAL]`.
- **AST Optimization**: Precalculates constants, eliminates unreachable branches (`if(false)`, `if(extension_loaded(...))`, `defined(...)`), and folds expressions at compile time.
- **On-Disk Transpilation Cache**: Saves compiled JavaScript files and sourcemaps to `process.env.JSPHP_CACHE` under `${JSPHP_CACHE}/${EngineConfigSHA1}/${FilePathSHA1}.js`.
- **Live File Watching**: Uses `chokidar` to automatically invalidate and recompile cached files when PHP source files are updated.
- **Built-in PHP Extensions**: Full implementations of `mysqli` (via `mysql2`), `pdo`, `pdo_mysql`, `gd` (via `sharp`), `pcre`, `mbstring`, `json`, `curl`, `session`, `xml`, `spl`, `hash`, `openssl`, and more.
- **CLI & REPL**: `php` CLI tool supporting `-v`, `-r <code>`, `-a` interactive shell, and script execution.

---

## Installation

```bash
npm install @nexustools/php
```

---

## Usage

### 1. Basic PHP Code Execution

```typescript
import { PHPEngine } from "@nexustools/php";

async function main() {
  const engine = new PHPEngine();
  const ctx = engine.createContext({
    stdout: (data) => process.stdout.write(data),
  });

  await ctx.eval(`
    <?php
    $name = "JSPHP";
    echo "Hello, " . $name . "!\n";
  `);

  engine.close();
}

main();
```

### 2. Running a PHP File

```typescript
import { PHPContext } from "@nexustools/php";

async function run() {
  await PHPContext.runFile("./index.php", {
    stdout: (data) => process.stdout.write(data),
  });
}

run();
```

### 3. Command Line Interface (CLI)

```bash
# Print PHP version
npx php -v

# Evaluate inline code
npx php -r "echo 'Hello from CLI!';"

# Interactive REPL shell
npx php -a

# Run script file
npx php index.php
```

---

## Architecture & Documentation

Detailed documentation can be found in the `docs/` directory:
- [docs/architecture.md](docs/architecture.md): Overview of `PHPEngine`, `PHPContext`, and execution model.
- [docs/transpiler.md](docs/transpiler.md): Details on AST parser, optimizer, sourcemaps, and cache hashing.
- [docs/extensions.md](docs/extensions.md): Creating custom `PHPExtension` classes and registering functions/classes.

---

## Running Tests

```bash
# Run unit tests
npm test

# Run WordPress integration tests (requires local MySQL instance)
MYSQL_ROOT_PASSWORD="DNESB*GJ*W(E$GYB$UW#gt78wg" npm test
```

---

## License

[MIT](LICENSE.md)
