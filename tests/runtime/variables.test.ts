import { PHPEngine } from "../../index.js";
import { isPHPReference, isPHPVariable, PHPLiteral, PHPReference, PHPVariable } from "../../src/runtime/PHPVariable.js";
import { JSTranspiler } from "../../src/parser/JSTranspiler.js";
import { jest } from "@jest/globals";
import { runInNewContext } from "vm";

describe("Variables & Types Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("Variable functions: is_array, is_bool, is_float, is_int, is_null, is_numeric, is_object, is_scalar, is_string, gettype, intval, floatval, strval, boolval", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo is_array(array()) ? '1;' : '0;';
      echo is_bool(true) ? '1;' : '0;';
      echo is_int(42) ? '1;' : '0;';
      echo is_null(null) ? '1;' : '0;';
      echo is_numeric('123') ? '1;' : '0;';
      echo gettype('test') . ';';
      echo intval('42') . ';';
      echo floatval('3.14') . ';';
      echo strval(100) . ';';
      echo boolval(1) ? '1;' : '0;';
    `);
    expect(out).toBe("1;1;1;1;1;string;42;3.14;100;1;");
  });

  test("get_object_vars returns public properties without exposing runtime internals", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class VisibleProperties {
        public $visible = 42;
        private $hidden = 'private';
        protected $guarded = 'protected';
        public static $shared = 100;
      }
      $instance = new VisibleProperties();
      $instance->dynamic = 'value';
      $properties = get_object_vars($instance);
      $callback = function() {};
      $callback_is_object = is_object($callback);
      $callback_properties = get_object_vars($callback);
      $exception_properties = get_object_vars(new Exception('failure'));
    `);
    expect(await ctx.getVar("properties")).toEqual({ visible: 42, dynamic: "value" });
    expect(await ctx.getVar("callback_is_object")).toBe(true);
    expect(await ctx.getVar("callback_properties")).toEqual({});
    expect(await ctx.getVar("exception_properties")).toEqual({});
    const fnGov = ctx.functions["get_object_vars"] || ctx.functionMissing("get_object_vars");
    await expect(fnGov(ctx, new PHPLiteral(null))).rejects.toThrow("must be of type object");
  });

  test("serialize produces PHP-compatible scalar, array, and object data", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $capabilities = serialize(array('ssl' => true));
      $list = serialize(array(1, 'two'));
      class SerializableValue { public $value = 42; }
      $object = serialize(new SerializableValue());
    `);
    expect(await ctx.getVar("capabilities")).toBe('a:1:{s:3:"ssl";b:1;}');
    expect(await ctx.getVar("list")).toBe('a:2:{i:0;i:1;i:1;s:3:"two";}');
    expect(await ctx.getVar("object")).toBe('O:17:"SerializableValue":1:{s:5:"value";i:42;}');
    const fnSer = ctx.functions["serialize"] || ctx.functionMissing("serialize");
    expect(await fnSer(ctx, new PHPLiteral(null))).toBe("N;");
    const text = String.fromCharCode(233);
    expect(await fnSer(ctx, new PHPLiteral(text))).toBe(`s:2:"${text}";`);
  });

  test("recognizes cross-realm and null-prototype associative arrays", async () => {
    const ctx = engine.createContext();
    const phpArray = Object.assign(Object.create(null), { user_id: 1 });
    const crossRealmArray = runInNewContext("({ user_id: 1, meta_key: 'wp_capabilities' })");
    const isArray = ctx.functions["is_array"] || ctx.functionMissing("is_array");
    const isObject = ctx.functions["is_object"] || ctx.functionMissing("is_object");

    expect(await isArray(ctx, new PHPLiteral(phpArray))).toBe(true);
    expect(await isObject(ctx, new PHPLiteral(phpArray))).toBe(false);
    expect(await isArray(ctx, new PHPLiteral(crossRealmArray))).toBe(true);
    expect(await isObject(ctx, new PHPLiteral(crossRealmArray))).toBe(false);
  });

  test("does not treat magic PHP objects with a get method as references", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      class MagicGetObject {
        public function get($name) { return $name; }
        public function __call($name, $args) { return $name; }
      }
      $object = new MagicGetObject();
      $object_type = is_object($object) ? 'object' : 'not-object';
      $object_truthy = $object ? 'truthy' : 'falsy';
    `);

    expect(await ctx.getVar("object_type")).toBe("object");
    expect(await ctx.getVar("object_truthy")).toBe("truthy");
  });

  test("copies from PHPVariable without awaiting get and preserves PHP array value semantics", async () => {
    const source = new PHPVariable(["original"]);
    const sourceGet = jest.spyOn(source, "get");
    const target = new PHPVariable();

    await target.setFrom(source);

    expect(sourceGet).not.toHaveBeenCalled();
    sourceGet.mockRestore();
    expect(await target.get()).toEqual(["original"]);
    await target.set(["changed"]);
    expect(await source.get()).toEqual(["original"]);
  });

  test("binds explicit parameters by value, by reference, and variadically", async () => {
    const ctx = engine.createContext();
    const phpCode = `
      function copy_parameter($items) { $items[0] = 'changed'; }
      function mutate_parameter(&$item) { $item = 'changed'; }
      function collect_arguments($first, ...$rest) {
        return [func_num_args(), func_get_args(), $rest];
      }
      $items = ['original'];
      copy_parameter($items);
      $after_copy = $items[0];
      $value = 'before';
      mutate_parameter($value);
      $after_reference = $value;
      $arguments = collect_arguments('one', 'two', 'three');
    `;
    await ctx.eval(phpCode);

    expect(await ctx.getVar("after_copy")).toBe("original");
    expect(await ctx.getVar("after_reference")).toBe("changed");
    expect(await ctx.getVar("arguments")).toEqual([3, ["one", "two", "three"], ["two", "three"]]);
  });

  test("caches static function calls per scope and only creates reachable conditional fallbacks", async () => {
    const transpiler = new JSTranspiler();
    const repeatedCalls = (await transpiler.transpile("<?php define('FIRST', 1); define('SECOND', 2);")).code;
    expect(repeatedCalls.match(/const __fn_define =/g)).toHaveLength(1);
    expect(repeatedCalls.match(/ctx\.functionMissing\(\"define\"\)/g)).toHaveLength(1);
    expect(repeatedCalls.match(/ctx\.functions\[\"define\"\]/g)).toHaveLength(1);
    expect(repeatedCalls.match(/await __fn_define\(ctx,/g)).toHaveLength(2);

    const dynamicCalls = (await transpiler.transpile(`
      <?php
      require 'function-definitions.php';
      extension_hook();
      extension_hook();
    `)).code;
    expect(dynamicCalls.match(/let __fn_extension_hook;/g)).toHaveLength(1);
    expect(dynamicCalls.match(/__fn_extension_hook \?\?= \(ctx\.functions\[\"extension_hook\"\]\)/g)).toHaveLength(2);

    const conditionalDeclaration = (await transpiler.transpile(`
      <?php
      if ($condition) {
        function branch_function() { return 'first'; }
      } else {
        function branch_function() { return 'second'; }
      }
      branch_function();
    `)).code;
    expect(conditionalDeclaration.match(/let __fn_branch_function;/g)).toHaveLength(1);
    expect(conditionalDeclaration.match(/__fn_branch_function = async function/g)).toHaveLength(2);
    expect(conditionalDeclaration).not.toContain('functionMissing("branch_function")');

    const conditionalFallback = (await transpiler.transpile(`
      <?php
      if ($condition) {
        function conditional_function() {}
      }
      conditional_function();
    `)).code;
    expect(conditionalFallback).toContain('let __fn_conditional_function = ctx.functionMissing("conditional_function");');
  });

  test("uses direct class bindings for declared classes and caches external class lookups", async () => {
    const transpiler = new JSTranspiler();
    const code = (await transpiler.transpile(`
      <?php
      class LocalClass {}
      $local = new LocalClass();
      $external = new ExternalClass();
      $another = new ExternalClass();
    `)).code;

    expect(code).toContain("const __cls_localclass = class __cls_localclass");
    expect(code).toContain("__cls_localclass[SYMBOL_PHP_NEW](ctx)");
    expect(code.match(/let __class_externalclass_/g)).toHaveLength(1);
    expect(code.match(/__class_externalclass_\d+ \?\?= \(ctx\.classes\[\"externalclass\"\]/g)).toHaveLength(2);

    const conditionalClass = (await transpiler.transpile(`
      <?php
      if ($condition) {
        class BranchClass {}
      } else {
        class BranchClass {}
      }
      $instance = new BranchClass();
    `)).code;
    expect(conditionalClass.match(/let __cls_branchclass;/g)).toHaveLength(1);
    expect(conditionalClass.match(/__cls_branchclass = class __cls_branchclass/g)).toHaveLength(2);
  });

  test("emits function scope frames and parameter bindings only when the method body needs them", async () => {
    const code = (await new JSTranspiler().transpile(`
      <?php
      class ScopeUsage {
        public $stored;
        public function no_context_scope($value) { return $value; }
        public function pass_through_scope($value) { $this->stored = $value; }
        public function argument_scope($value) { return func_get_args(); }
        public function variable_scope($value) { return get_defined_vars(); }
        public function global_scope($value) { global $shared; $shared = $value; }
      }
    `)).code;
    const methodSource = (name: string): string => {
      const start = code.indexOf(`async ${name}(ctx, $arg_value) {`);
      expect(start).toBeGreaterThanOrEqual(0);
      const end = code.indexOf("\n      }", start);
      expect(end).toBeGreaterThan(start);
      return code.slice(start, end);
    };

    const noScope = methodSource("no_context_scope");
    expect(noScope).not.toContain("ctx.pushScope");
    expect(noScope).not.toContain("ctx.popScope");
    expect(noScope).not.toContain("ctx.argPHPVar");
    expect(noScope).not.toContain("$v_value");
    expect(noScope).toContain("ctx.toVal($arg_value)");

    const passThrough = methodSource("pass_through_scope");
    expect(passThrough).not.toContain("ctx.pushScope");
    expect(passThrough).not.toContain("ctx.argPHPVar");
    expect(passThrough).toContain("setFrom($arg_value)");

    const argumentScope = methodSource("argument_scope");
    expect(argumentScope).toContain("ctx.pushScope(arguments, 1)");
    expect(argumentScope).toContain("ctx.popScope()");
    expect(argumentScope).not.toContain("ctx.argPHPVar");

    const globalScope = methodSource("global_scope");
    expect(globalScope).toContain("ctx.pushScope(arguments, 1)");
    expect(globalScope).toContain("ctx.popScope()");
    expect(globalScope).not.toContain("ctx.argPHPVar");

    const variableScope = methodSource("variable_scope");
    expect(variableScope).toContain("ctx.pushScope(arguments, 1)");
    expect(variableScope).toContain("ctx.popScope()");
    expect(variableScope).toContain('ctx.argPHPVar("value", $arg_value');
  });

  test("captures parent parameters in closures from the selected argument binding", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      function capture_parameter($stylesheet_url) {
        $callback = static function($matches) use ($stylesheet_url) {
          return $stylesheet_url;
        };
        return $callback([]);
      }
      function mutate_captured_parameter(&$value) {
        $callback = function() use (&$value) { $value = 'changed'; };
        $callback();
        return $value;
      }
      $captured = capture_parameter('relative.css');
      $mutated = 'before';
      $mutated_result = mutate_captured_parameter($mutated);
    `);

    expect(await ctx.getVar("captured")).toBe("relative.css");
    expect(await ctx.getVar("mutated_result")).toBe("changed");
    expect(await ctx.getVar("mutated")).toBe("changed");
  });

  test("hoists immutable string call arguments into reusable symbol-branded literals", async () => {
    const code = (await new JSTranspiler().transpile(`
      <?php
      echo_string('cached-value');
      echo_string('cached-value');
    `)).code;

    expect(code.match(/const __strlit_cached\$2Dvalue = new BasicLiteral\("cached-value"\);/g)).toHaveLength(1);
    expect(code.match(/__strlit_cached\$2Dvalue/g)).toHaveLength(3);
    expect(code).toContain('Symbol.for("php.reference")');
    expect(code).not.toContain("globalThis");

    const ctx = engine.createContext();
    let capturedLiteral: PHPReference | undefined;
    engine.registerFunction("capture_literal", async (_context, value) => {
      capturedLiteral = value;
      return true;
    });
    await ctx.eval(`
      function echo_string($value) { echo $value; }
      echo_string('cached-value');
      capture_literal('immutable');
    `);
    expect(ctx.outputText).toBe("cached-value");

    expect(capturedLiteral).toBeDefined();
    expect(capturedLiteral instanceof PHPReference).toBe(true);
    expect(isPHPReference(capturedLiteral)).toBe(true);
    expect(isPHPVariable(capturedLiteral)).toBe(false);
    await expect(capturedLiteral!.set("changed")).rejects.toThrow("Literals cannot be changed");
    await expect(capturedLiteral!.unset()).rejects.toThrow("Literals cannot be changed");
  });
});
