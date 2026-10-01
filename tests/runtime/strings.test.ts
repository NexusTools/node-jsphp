import { PHPEngine } from "../../index";

describe("Strings Runtime Tests", () => {
  let engine: PHPEngine;

  beforeEach(() => {
    engine = new PHPEngine({ watch: false });
  });

  afterEach(() => {
    engine.close();
  });

  test("String functions: strlen, substr, strpos, stripos, strrpos, strripos, strstr", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo strlen('hello') . ';';
      echo substr('hello', 1, 3) . ';';
      echo strpos('hello', 'e') . ';';
      echo stripos('HELLO', 'E') . ';';
      echo strrpos('hello world', 'o') . ';';
      echo strripos('HELLO WORLD', 'O') . ';';
      echo strstr('hello world', 'world') . ';';
    `);
    expect(out).toBe("5;ell;1;1;7;7;world;");
  });

  test("String functions: str_replace, str_ireplace, explode, implode, trim, ltrim, rtrim", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo str_replace('world', 'JSPHP', 'hello world') . ';';
      echo str_ireplace('WORLD', 'JSPHP', 'hello world') . ';';
      $parts = explode(',', 'a,b,c');
      echo implode('-', $parts) . ';';
      echo trim('  hello  ') . ';';
      echo ltrim('  hello  ') . ';';
      echo rtrim('  hello  ') . ';';
    `);
    expect(out).toBe("hello JSPHP;hello JSPHP;a-b-c;hello;hello  ;  hello;");
  });

  test("substr_replace handles replacement, insertion, negative ranges, and arrays", async () => {
    const ctx = engine.createContext();
    await ctx.eval(`
      echo substr_replace('en_US.mo', '.l10n.php', -3) . ';';
      echo substr_replace('abcdef', 'X', 2, 2) . ';';
      echo substr_replace('abcdef', 'X', 2, 0) . ';';
      echo substr_replace('abcdef', 'X', 1, -1) . ';';
      echo substr_replace('abc', 'X', 20) . ';';
      $replaced = substr_replace(array('abc', 'def'), array('X', 'Y'), array(1, 0), array(1, 2));
    `);
    expect(ctx.outputText).toBe("en_US.l10n.php;abXef;abXcdef;aXf;abcX;");
    expect(ctx.getVar("replaced")).toEqual(["aXc", "Yf"]);
  });

  test("String functions: strtolower, strtoupper, ucfirst, lcfirst, ucwords, addslashes, stripslashes, htmlspecialchars", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo strtolower('HELLO') . ';';
      echo strtoupper('hello') . ';';
      echo ucfirst('hello') . ';';
      echo lcfirst('Hello') . ';';
      echo ucwords('hello world') . ';';
      echo addslashes("o'reilly") . ';';
      echo stripslashes("o\\'reilly") . ';';
      echo htmlspecialchars("<a href='test'>Test</a>") . ';';
    `);
    expect(out).toContain("hello;HELLO;Hello;hello;Hello World;o\\'reilly;o'reilly;");
  });

  test("String functions: nl2br, str_repeat, str_pad, str_split, strrev, chr, ord, bin2hex, hex2bin", async () => {
    let out = "";
    const ctx = engine.createContext({ stdout: (d) => { out += d; } });
    await ctx.eval(`
      echo nl2br("a\\nb") . ';';
      echo str_repeat('a', 3) . ';';
      echo str_pad('1', 3, '0', 0) . ';';
      echo strrev('abc') . ';';
      echo chr(65) . ';';
      echo ord('A') . ';';
      echo bin2hex('A') . ';';
      echo hex2bin('41') . ';';
    `);
    expect(out).toContain("aaa;001;cba;A;65;41;A;");
  });
});
