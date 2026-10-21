import { jest } from "@jest/globals";
import { PHPEngine, ASTOptimizer } from "../index.js";
import * as fs from "fs/promises";
import fsSync from "fs";
import * as os from "os";
import * as path from "path";

describe("PHPEngine & AST Unit Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    delete process.env.JSPHP_DEBUG;
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("Does not register WordPress userland functions as PHP built-ins", () => {
    for (const name of ["is_robots", "is_favicon", "is_feed", "is_trackback", "is_embed"]) {
      expect(name in engine.functions).toBe(false);
    }
  });

  test("Does not synchronously write execution traces by default", async () => {
    const previousDebug = process.env.JSPHP_DEBUG;
    delete process.env.JSPHP_DEBUG;
    const appendSpy = jest.spyOn(fsSync, "appendFileSync");
    try {
      await engine.createContext().eval("echo 'ready';");
      expect(appendSpy).not.toHaveBeenCalled();
    } finally {
      appendSpy.mockRestore();
      if (previousDebug === undefined) delete process.env.JSPHP_DEBUG;
      else process.env.JSPHP_DEBUG = previousDebug;
    }
  });

  test.each([null, "cache"])("Caches compiled files in memory with disk cache %s", async (cacheDirectory) => {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "jsphp-memory-cache-"));
    const sourcePath = path.join(temporaryDirectory, "cached.php");
    engine.close();
    engine = new PHPEngine({
      watch: false,
      cacheDir: cacheDirectory === null ? null : path.join(temporaryDirectory, cacheDirectory),
    });
    const compileSpy = jest.spyOn(engine, "compileCode");

    try {
      await fs.writeFile(sourcePath, "<?php return 42;");
      const compiled = await engine.compileFile(sourcePath);
      await fs.unlink(sourcePath);

      expect(await engine.compileFile(sourcePath)).toBe(compiled);
      expect(compileSpy).toHaveBeenCalledTimes(1);
      expect(await compiled(engine.createContext())).toBe(42);
    } finally {
      compileSpy.mockRestore();
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test("Evaluates basic string and math expressions", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval("echo 'Hello ' . 'World! ' . (5 + 5);");
    expect(out).toBe("Hello World! 10");
  });

  test("Defines integer platform constants", async () => {
    const ctx = engine.createContext();
    await ctx.eval("$values = [PHP_INT_SIZE, PHP_INT_MAX, PHP_INT_MIN];");
    expect(await ctx.getVar("values")).toEqual([8, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]);
  });

  test("Keeps runtime constants request-local when reusing compiled code", async () => {
    const configuration = engine.getConfigurationSHA1();
    const compiled = await engine.compileCode("<?php define('REQUEST_VALUE', $seed); echo constant('REQUEST_VALUE');");
    const firstContext = engine.createContext();
    const secondContext = engine.createContext();
    firstContext.setVar("seed", 21);
    secondContext.setVar("seed", 42);

    await compiled(firstContext);
    expect(secondContext.hasConstant("REQUEST_VALUE")).toBe(false);
    await compiled(secondContext);

    expect(firstContext.outputText).toBe("21");
    expect(secondContext.outputText).toBe("42");
    expect(engine.constants["REQUEST_VALUE"]).toBeUndefined();
    expect(engine.getConfigurationSHA1()).toBe(configuration);
  });

  test("Handles variable assignment and retrieval", async () => {
    const ctx = engine.createContext();
    await ctx.eval("$x = 42; $y = 'PHP';");
    expect(await ctx.getVar("x")).toBe(42);
    expect(await ctx.getVar("y")).toBe("PHP");
  });

  test("Rebinds an unset top-level variable when a function recreates it globally", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $shared_value = 'before';
      function restore_shared_value() {
        global $shared_value;
        $shared_value = 'after';
      }
      function discard_argument($argument) { unset($argument); }
      unset($shared_value);
      restore_shared_value();
      discard_argument('discarded');
      echo $shared_value;
    `);

    expect(ctx.outputText).toBe("after");
  });

  test("Unsets dynamic object properties and invokes asynchronous magic unset", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class MagicUnsetTarget {
        public function __unset($name) { $GLOBALS['last_unset'] = $name; }
      }
      $plain = new stdClass();
      $plain->removed = true;
      unset($plain->removed);
      $magic = new MagicUnsetTarget();
      unset($magic->missing);
      echo (property_exists($plain, 'removed') ? 'present' : 'plain') . ':' . $last_unset;
    `);

    expect(ctx.outputText).toBe("plain:missing");
  });

  test("Assigns globals and array appends without evaluating values twice", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $created = 0;
      class SharedValue {
        public function __construct() {
          global $created;
          $created++;
        }
      }
      $saved = ($GLOBALS['shared'] = new SharedValue());
      $values = array();
      array_push($values, 'first');
      array_push($values, 'second');
      function append_global() {
        global $values;
        array_push($values, 'third');
        $GLOBALS['visible'] = 'yes';
      }
      append_global();
    `);
    expect(await ctx.getVar("created")).toBe(1);
    expect(await ctx.getVar("shared")).toBe(await ctx.getVar("saved"));
    expect(await ctx.getVar("values")).toEqual(["first", "second", "third"]);
    expect(await ctx.getVar("visible")).toBe("yes");
    expect(ctx.vars.GLOBALS).toBeUndefined();
  });

  test("Handles conditional if/else blocks", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $val = 10;
      if ($val > 5) {
        echo 'Greater';
      } else {
        echo 'Lesser';
      }
    `);
    expect(out).toBe("Greater");
  });

  test("Creates nested array offsets for variables, globals, and properties", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $features['post']['thumbnail'] = true;
      $rows[]['title'] = 'first';
      $rows[]['title'] = 'second';
      $GLOBALS['registry']['item']['value'] = 7;
      class NestedStorage {
        public $options = array();
        public static $cache = array();
      }
      $storage = new NestedStorage();
      $storage->options['nested']['value'] = 8;
      NestedStorage::$cache['nested']['value'] = 9;
      echo $features['post']['thumbnail'] ? 'yes;' : 'no;';
      echo $rows[0]['title'] . ';' . $rows[1]['title'] . ';';
      echo $registry['item']['value'] . ';' . $storage->options['nested']['value'] . ';' . NestedStorage::$cache['nested']['value'];
    `);
    expect(ctx.outputText).toBe("yes;first;second;7;8;9");
  });

  test("Executes while loops", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $i = 0;
      while ($i < 3) {
        echo $i;
        $i++;
      }
    `);
    expect(out).toBe("012");
  });

  test("Executes foreach loops on arrays", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      $arr = array("a" => 1, "b" => 2);
      foreach ($arr as $k => $v) {
        echo $k . '=' . $v . ';';
      }
    `);
    expect(out).toBe("a=1;b=2;");
  });

  test("Executes PHP function definition and invocation", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      function add($a, $b = 5) {
        return $a + $b;
      }
      echo add(10) . ';' . add(10, 20);
    `);
    expect(out).toBe("15;30");
  });

  test("Propagates by-reference output variables through nested PHP functions", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      function set_output(&$output) { $output = array('value' => 42); }
      function forward_output(&$result) { set_output($result); $result['extra'] = 'yes'; }
      function leave_unchanged($value) { $value = 'local'; }
      forward_output($result);
      $value = 'caller';
      leave_unchanged($value);
      echo $result['value'] . ';' . $result['extra'] . ';' . $value;
    `);
    expect(ctx.outputText).toBe("42;yes;caller");
  });

  test("Executes PHP class instantiation and method invocation", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      class Greeter {
        public function sayHello($name) {
          return 'Hello ' . $name;
        }
      }
      $g = new Greeter();
      echo $g->sayHello('PHP');
    `);
    expect(out).toBe("Hello PHP");
  });

  test("Allows invoking static PHP methods through an instance", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class StaticUtility {
        public static function is_valid($value) { return $value === 'valid'; }
        public function check($value) { return $this->is_valid($value); }
      }
      $instance = new StaticUtility();
      echo $instance->check('valid') ? 'YES' : 'NO';
    `);
    expect(ctx.outputText).toBe("YES");
  });

  test("Resolves dynamic static members from an object class", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class DynamicStaticMember {
        public static $value = 'before';
      }
      $instance = new DynamicStaticMember();
      $instance::$value = 'after';
      echo DynamicStaticMember::$value;
    `);

    expect(ctx.outputText).toBe("after");
  });

  test("Uses PHP array-union semantics for array addition assignment", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $left = ['scheme' => 'http', 'host' => '127.0.0.1'];
      $left += ['host' => '', 'path' => '/'];
      echo $left['host'] . '|' . $left['path'];
    `);
    expect(ctx.outputText).toBe("127.0.0.1|/");
  });

  test("Treats isset on a null property chain as false", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $block_type = null;
      echo isset($block_type->supports['interactivity']['clientNavigation']) ? 'SET' : 'UNSET';
    `);
    expect(ctx.outputText).toBe("UNSET");
  });

  test("Treats empty on a null property chain as true", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $block_type = null;
      echo empty($block_type->supports) ? 'EMPTY' : 'SET';
    `);
    expect(ctx.outputText).toBe("EMPTY");
  });

  test("Preserves the called class when constructing with new static", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class LateStaticBase {
        public static function make() { return new static(); }
      }
      class LateStaticChild extends LateStaticBase {}
      $instance = LateStaticChild::make();
      echo $instance instanceof LateStaticChild ? 'CHILD' : 'BASE';
    `);
    expect(ctx.outputText).toBe("CHILD");
  });

  test("Persists writes to static array offsets", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class StaticArrayHolder { public static $items = []; }
      StaticArrayHolder::$items['key'] = 'value';
      echo StaticArrayHolder::$items['key'];
    `);
    expect(ctx.outputText).toBe("value");
  });

  test("Returns PHP function names from debug_backtrace", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      function trace_layer_3() { return debug_backtrace(); }
      function trace_layer_2() { return trace_layer_3(); }
      function trace_layer_1() { return trace_layer_2(); }
      $trace = trace_layer_1();
      echo $trace[0]['function'] . '|' . $trace[1]['function'] . '|' . $trace[2]['function'];
    `);
    expect(ctx.outputText).toBe("trace_layer_3|trace_layer_2|trace_layer_1");
  });

  test("Does not substitute unrelated or hard-coded static methods", async () => {
    const ctx = engine.createContext();
    await ctx.eval("class ActualOwner { public static function init() { return 'actual'; } } class OtherOwner {} class InputValidator {}");
    const actualCls = await ctx.resolveClass("actualowner");
    expect(await actualCls.init(ctx)).toBe("actual");
    const otherCls = await ctx.resolveClass("otherowner");
    expect(() => ctx.methodMissing(otherCls, "init")).toThrow("undefined method OtherOwner::init");
    const valCls = await ctx.resolveClass("inputvalidator");
    expect(() => ctx.methodMissing(valCls, "is_string_or_stringable")).toThrow("undefined method InputValidator::is_string_or_stringable");
  });

  test("Magic method objects are not assimilated as JavaScript promises", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class MagicDispatch {
        public function __call($method, $arguments) { return $method; }
      }
      $instance = new MagicDispatch();
      echo $instance->missing();
    `);
    expect(ctx.outputText).toBe("missing");
    expect((await ctx.getVar("instance")).then).toBeUndefined();
  }, 1000);

  test("Resolves imported parents, inherited methods, and static members", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      namespace Runtime\\Base {
        class ParentType {
          const LABEL = 'base';
          protected static $cache = 'first';
          public static function init() { return static::class; }
          public static function read() { return self::$cache; }
          public function greet() { return self::LABEL; }
        }
      }
      namespace Runtime\\App {
        use Runtime\\Base\\ParentType as ParentAlias;
        class Child extends ParentAlias {
          public static function update($value) { parent::$cache = $value; }
          public function greet() { return parent::greet() . ':child'; }
        }
        $instance = new Child();
        echo Child::init() . ';' . $instance->greet() . ';';
        Child::update('second');
        echo Child::read();
      }
    `);
    expect(ctx.outputText).toBe("Runtime\\App\\Child;base:child;second");
  });

  test("Supports parent method calls from closures inside class methods", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class ClosureParent {
        public function label($value) { return 'parent:' . $value; }
      }
      class ClosureChild extends ClosureParent {
        public function labelThroughClosure($value) {
          $callback = function($suffix) { return parent::label($suffix); };
          return $callback($value);
        }
      }
      echo (new ClosureChild())->labelThroughClosure('value');
    `);

    expect(ctx.outputText).toBe("parent:value");
  });

  test("Registers namespaced functions and classes with qualified registry keys", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      namespace {
        function fallback_name() { return 'global'; }
      }
      namespace Runtime\\One\\Two {
        function local_name() { return 'local'; }
        class RegistryItem {
          public static function value() { return 'class'; }
        }
        echo local_name() . ':' . fallback_name() . ':' . RegistryItem::value();
        $class_name = 'Runtime\\One\\Two\\RegistryItem';
        $function_name = 'Runtime\\One\\Two\\local_name';
        $dynamic_instance = new $class_name();
        echo ':' . (class_exists($class_name) ? 'class' : 'missing');
        echo ':' . (function_exists($function_name) ? 'function' : 'missing');
        echo ':' . $function_name();
      }
    `);

    const functionKey = "runtime$$one$$two$$local_name";
    const classKey = "runtime$$one$$two$$registryitem";
    expect(ctx.outputText).toBe("local:global:class:class:function:local");
    expect(ctx.functions[functionKey]?.[engine.symbols.SYMBOL_PHP_META]?.name).toBe("Runtime\\One\\Two\\local_name");
    expect(ctx.classes[classKey]?.[engine.symbols.SYMBOL_PHP_NAME]).toBe("Runtime\\One\\Two\\RegistryItem");
  });

  test("Resolves namespaced interface constants and self references", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      namespace Runtime\\Capabilities {
        interface Capability {
          const SSL = 'ssl';
          const ALL = [self::SSL];
        }
        echo Capability::ALL[0];
      }
    `);

    expect(ctx.outputText).toBe("ssl");
    expect(ctx.interfaces["runtime$$capabilities$$capability"]?.[engine.symbols.SYMBOL_PHP_CONSTANTS]?.all[0]).toBe("ssl");
  });

  test("Supports core Exception and native exception inheritance", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class ApplicationException extends Exception {
        public function __construct($message) { parent::__construct($message, 7); }
        public function marker() { return 'marker'; }
      }
      $exception = new ApplicationException('failure');
      echo $exception->getMessage() . ';' . $exception->getCode() . ';' . $exception->marker();
      $is_exception = $exception instanceof Exception;
    `);
    expect(ctx.outputText).toBe("failure;7;marker");
    expect(await ctx.getVar("is_exception")).toBe(true);
    await expect(ctx.eval("throw new ApplicationException('stop');")).rejects.toThrow("stop");
  });

  test("Resolves class constants declared after property defaults", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class DeferredDefaults {
        public $state = self::READY;
        public static $cache = self::READY;
        const READY = 'ready';
      }
      $instance = new DeferredDefaults();
      echo $instance->state . ';' . DeferredDefaults::$cache;
    `);
    expect(ctx.outputText).toBe("ready;ready");
  });

  test("Orders forward class constant dependencies and rejects cycles", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class ConstantDependencies {
        const OPTIONS = array('agent' => 'client/' . self::VERSION);
        const VERSION = self::RELEASE;
        const RELEASE = '1.0';
      }
      echo ConstantDependencies::OPTIONS['agent'];
    `);
    expect(ctx.outputText).toBe("client/1.0");
    await expect(ctx.eval("class ConstantCycle { const FIRST = self::SECOND; const SECOND = self::FIRST; }")).rejects.toThrow("self-referencing constant");
  });

  test("Optimizes extension_loaded and dead code branches at compile time", async () => {
    const ast = {
      kind: "if",
      test: {
        kind: "call",
        what: { name: "extension_loaded" },
        arguments: [{ kind: "string", value: "mysqli" }],
      },
      body: [{ kind: "echo", arguments: [{ kind: "string", value: "Yes" }] }],
      alternate: [{ kind: "echo", arguments: [{ kind: "string", value: "No" }] }],
    };

    const optimized = ASTOptimizer.optimize(ast, engine);
    expect(Array.isArray(optimized)).toBe(true);
    expect(optimized[0].kind).toBe("echo");
    expect(optimized[0].arguments[0].value).toBe("Yes");
  });

  test("Optimizes if(false) away completely", async () => {
    const ast = {
      kind: "if",
      test: { kind: "boolean", value: false },
      body: [{ kind: "echo", arguments: [{ kind: "string", value: "Dead code" }] }],
    };

    const optimized = ASTOptimizer.optimize(ast, engine);
    expect(optimized).toBeNull();
  });

  test("Virtualizes stack traces replacing internal frames", async () => {
    const ctx = engine.createContext();
    try {
      await ctx.eval("throw_non_existent_func();");
    } catch (err: any) {
      expect(err.message).toContain("undefined function");
    }
  });

  test.each(["exit;", "exit(7);", "die(7);", "true && exit(7);"])("Terminates execution for %s", async (statement) => {
    const ctx = engine.createContext();
    const status = await ctx.eval(`echo 'before'; ${statement} echo 'after';`);
    expect(ctx.outputText).toBe("before");
    expect(status).toBe(statement === "exit;" ? 0 : 7);
  });

  test("Evaluates error-suppressed expressions and restores error reporting", async () => {
    const ctx = engine.createContext();
    await ctx.eval("$length = @strlen('hello'); @trigger_error('hidden', E_USER_WARNING); echo $length;");
    expect(ctx.outputText).toBe("5");
    expect(ctx.errorReportingLevel).toBe(32767);

    await expect(ctx.eval("@missing_silenced_function();")).rejects.toThrow("undefined function");
    expect(ctx.errorReportingLevel).toBe(32767);
  });

  test("Converts PHP casts used by installation state and request parameters", async () => {
    const ctx = engine.createContext();
    await ctx.eval("$installing = (bool) true; $disabled = (bool) '0'; $step = (int) '1'; $classes = (array) 'language-chooser'; $empty = (array) null;");
    expect(await ctx.getVar("installing")).toBe(true);
    expect(await ctx.getVar("disabled")).toBe(false);
    expect(await ctx.getVar("step")).toBe(1);
    expect(await ctx.getVar("classes")).toEqual(["language-chooser"]);
    expect(await ctx.getVar("empty")).toEqual([]);
  });

  test.each([["0", "zero"], ["1", "onetwo"], ["2", "two"], ["3", "default"]])("Selects switch step %s with PHP matching and fall-through", async (step, expected) => {
    const ctx = engine.createContext();
    ctx.setVar("step", step);
    await ctx.eval(`
      switch ($step) {
        case 0: echo 'zero'; break;
        case 1: echo 'one';
        case 2: echo 'two'; break;
        default: echo 'default';
      }
    `);
    expect(ctx.outputText).toBe(expected);
  });

  test("Destructures array with list() into properties and variables", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class Dep {
        public $handle;
        public $src;
        public function __construct(...$args) {
          list($this->handle, $this->src) = $args;
        }
      }
      $d = new Dep('install', 'install.css');
      $h = $d->handle;
      $s = $d->src;
      list($x, $y) = ['foo', 'bar'];
    `);
    expect(await ctx.getVar("h")).toBe("install");
    expect(await ctx.getVar("s")).toBe("install.css");
    expect(await ctx.getVar("x")).toBe("foo");
    expect(await ctx.getVar("y")).toBe("bar");
  });

  afterAll(() => {
    const defaultCacheDir = process.env.JSPHP_CACHE || path.join(os.tmpdir(), "jsphp_cache");
    if (fsSync.existsSync(defaultCacheDir)) {
      try { fsSync.rmSync(defaultCacheDir, { recursive: true, force: true }); } catch (e) {}
    }
  });
});
