import { PHPEngine } from "../../index.js";

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
    expect(ctx.getVar("properties")).toEqual({ visible: 42, dynamic: "value" });
    expect(ctx.getVar("callback_is_object")).toBe(true);
    expect(ctx.getVar("callback_properties")).toEqual({});
    expect(ctx.getVar("exception_properties")).toEqual({});
    await expect(ctx.callFunction("get_object_vars", [null])).rejects.toThrow("must be of type object");
  });

  test("serialize produces PHP-compatible scalar, array, and object data", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      $capabilities = serialize(array('ssl' => true));
      $list = serialize(array(1, 'two'));
      class SerializableValue { public $value = 42; }
      $object = serialize(new SerializableValue());
    `);
    expect(ctx.getVar("capabilities")).toBe('a:1:{s:3:"ssl";b:1;}');
    expect(ctx.getVar("list")).toBe('a:2:{i:0;i:1;i:1;s:3:"two";}');
    expect(ctx.getVar("object")).toBe('O:17:"SerializableValue":1:{s:5:"value";i:42;}');
    expect(await ctx.callFunction("serialize", [null])).toBe("N;");
    const text = String.fromCharCode(233);
    expect(await ctx.callFunction("serialize", [text])).toBe(`s:2:"${text}";`);
  });
});
