import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { SourceMapGenerator } from "source-map";
import { PHPParser } from "./PHPParser";
import { ASTOptimizer } from "./ASTOptimizer";
import { SourceMapRegistry, PHPLineLocation } from "../runtime/errors/SourceMapRegistry";
import type { PHPEngine } from "../PHPEngine";

export interface TranspilerOptions {
  engineSHA1: string;
  cacheDir?: string;
  engine: PHPEngine;
}

export interface TranspilationResult {
  code: string;
  map: string;
  cached: boolean;
  lineMap: Map<number, PHPLineLocation>;
}

export class JSTranspiler {
  private parser: PHPParser;

  constructor() {
    this.parser = new PHPParser();
  }

  public transpile(
    sourceCode: string,
    filepath: string,
    options: TranspilerOptions
  ): TranspilationResult {
    const resolvedPath = path.isAbsolute(filepath) ? path.resolve(filepath) : filepath;
    const pathSHA1 = crypto.createHash("sha1").update(resolvedPath).digest("hex");

    const cacheBase = (filepath === "eval") ? undefined : (options.cacheDir || process.env.JSPHP_CACHE);
    let cacheJSPath = "";
    let cacheMapPath = "";
    let lockPath = "";
    let acquiredLock = false;

    if (cacheBase) {
      const targetDir = path.join(cacheBase, options.engineSHA1);
      cacheJSPath = path.join(targetDir, `${pathSHA1}.js`);
      cacheMapPath = path.join(targetDir, `${pathSHA1}.js.map`);
      lockPath = path.join(targetDir, `${pathSHA1}.lock`);

      // 1. Try reading existing cache
      if (fs.existsSync(cacheJSPath) && fs.existsSync(cacheMapPath)) {
        try {
          const cachedCode = fs.readFileSync(cacheJSPath, "utf8");
          const cachedMap = fs.readFileSync(cacheMapPath, "utf8");
          const lineMap = new Map<number, PHPLineLocation>();
          SourceMapRegistry.register(filepath, lineMap);
          return { code: cachedCode, map: cachedMap, cached: true, lineMap };
        } catch (e) {
          // Recompile on read error
        }
      }

      // 2. Acquire atomic cluster process lock
      const startTime = Date.now();
      const lockTimeoutMs = 3000;

      while (!acquiredLock && Date.now() - startTime < lockTimeoutMs) {
        try {
          fs.mkdirSync(targetDir, { recursive: true });
          const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
          fs.writeSync(fd, String(process.pid));
          fs.closeSync(fd);
          acquiredLock = true;
        } catch (err: any) {
          if (err.code === "EEXIST") {
            if (fs.existsSync(cacheJSPath) && fs.existsSync(cacheMapPath)) {
              try {
                const cachedCode = fs.readFileSync(cacheJSPath, "utf8");
                const cachedMap = fs.readFileSync(cacheMapPath, "utf8");
                const lineMap = new Map<number, PHPLineLocation>();
                SourceMapRegistry.register(filepath, lineMap);
                return { code: cachedCode, map: cachedMap, cached: true, lineMap };
              } catch (e) {}
            }

            // Remove stale lock if process is dead or timeout exceeded
            try {
              if (fs.existsSync(lockPath)) {
                const pidStr = fs.readFileSync(lockPath, "utf8");
                const pid = parseInt(pidStr, 10);
                if (pid) {
                  try { process.kill(pid, 0); } catch {
                    fs.unlinkSync(lockPath);
                  }
                }
              }
            } catch (e) {
              try { fs.unlinkSync(lockPath); } catch (e) {}
            }

            this.sleepSync(20);
          } else {
            break;
          }
        }
      }
    }

    try {
      const rawAst = this.parser.parse(sourceCode, filepath);
      const optimizedAst = ASTOptimizer.optimize(rawAst, options.engine);

      const mapGen = new SourceMapGenerator({ file: `${path.basename(filepath)}.js` });
      mapGen.setSourceContent(filepath, sourceCode);

      const jsLines: string[] = [];
      const lineMap = new Map<number, PHPLineLocation>();

      const phpObjPath = JSON.stringify(path.resolve(__dirname, "../runtime/objects/PHPObject"));

      jsLines.push(`// Transpiled from PHP: ${filepath}`);
      jsLines.push(`module.exports = async function(ctx) {`);
      jsLines.push(`  const { PHPClass } = require(${phpObjPath});`);

      this.transpileNodeList(optimizedAst.children || optimizedAst, jsLines, lineMap, mapGen, filepath, 1, "{main}");

      jsLines.push(`};`);

      let generatedCode = jsLines.join("\n");
      const mapString = mapGen.toString();

      const base64Map = Buffer.from(mapString, "utf8").toString("base64");
      generatedCode += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map}\n`;

      if (cacheJSPath) {
        try {
          const tmpJSPath = `${cacheJSPath}.${process.pid}.tmp`;
          const tmpMapPath = `${cacheMapPath}.${process.pid}.tmp`;
          fs.writeFileSync(tmpJSPath, generatedCode, "utf8");
          fs.writeFileSync(tmpMapPath, mapString, "utf8");
          fs.renameSync(tmpJSPath, cacheJSPath);
          fs.renameSync(tmpMapPath, cacheMapPath);
        } catch (e) {
          // Non-fatal
        }
      }

      SourceMapRegistry.register(filepath, lineMap);

      return { code: generatedCode, map: mapString, cached: false, lineMap };
    } finally {
      if (acquiredLock && lockPath && fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  private sleepSync(ms: number): void {
    try {
      const buf = new Int32Array(new SharedArrayBuffer(4));
      Atomics.wait(buf, 0, 0, ms);
    } catch {
      const end = Date.now() + ms;
      while (Date.now() < end) {}
    }
  }

  private transpileNodeList(
    nodes: any,
    lines: string[],
    lineMap: Map<number, PHPLineLocation>,
    mapGen: SourceMapGenerator,
    filepath: string,
    indent: number,
    currentFuncName: string = "{main}"
  ) {
    if (!nodes) return;
    const nodeList = Array.isArray(nodes) ? nodes : [nodes];
    const pad = "  ".repeat(indent);

    for (const node of nodeList) {
      if (!node) continue;

      const currentJsLine = lines.length + 1;

      if (node.loc?.start) {
        lineMap.set(currentJsLine, {
          file: filepath,
          line: node.loc.start.line,
          function: currentFuncName,
        });

        if (mapGen) {
          mapGen.addMapping({
            generated: {
              line: currentJsLine,
              column: pad.length,
            },
            source: filepath,
            original: {
              line: node.loc.start.line,
              column: node.loc.start.column || 0,
            },
          });
        }
      }

      this.transpileNode(node, filepath, pad, lines, lineMap, mapGen, currentFuncName);
    }
  }

  private transpileNode(
    node: any,
    filepath: string,
    pad: string,
    lines: string[],
    lineMap: Map<number, PHPLineLocation>,
    mapGen?: SourceMapGenerator,
    currentFuncName: string = "{main}"
  ): void {
    if (!node || typeof node !== "object") return;

    switch (node.kind) {
      case "echo":
      case "print": {
        const exprs = node.expressions || node.arguments || [node.expression];
        const args = exprs.filter(Boolean).map((a: any) => this.transpileExpr(a, filepath));
        lines.push(`${pad}await ctx.echo(${args.join(" + ")});`);
        break;
      }

      case "inline": {
        const escaped = JSON.stringify(node.value || "");
        lines.push(`${pad}await ctx.echo(${escaped});`);
        break;
      }

      case "expressionstatement": {
        const expr = this.transpileExpr(node.expression, filepath);
        if (expr) lines.push(`${pad}${expr};`);
        break;
      }

      case "assign": {
        const target = this.transpileTarget(node.left);
        const value = this.transpileExpr(node.right, filepath);
        lines.push(`${pad}${target} = ${value};`);
        break;
      }

      case "global": {
        const vars = (node.items || []).map((v: any) => {
          const name = JSON.stringify(v.name?.name || v.name);
          return `${pad}ctx.vars[${name}] = ctx.getVar(${name});`;
        });
        vars.forEach((v: string) => lines.push(v));
        break;
      }

      case "if": {
        const cond = this.transpileExpr(node.test, filepath);
        lines.push(`${pad}if (${cond}) {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, currentFuncName);
        lines.push(`${pad}}`);

        if (node.alternate) {
          lines.push(`${pad}else {`);
          this.transpileNodeList(node.alternate?.children || node.alternate, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, currentFuncName);
          lines.push(`${pad}}`);
        }
        break;
      }

      case "while": {
        const cond = this.transpileExpr(node.test, filepath);
        lines.push(`${pad}while (${cond}) {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, currentFuncName);
        lines.push(`${pad}}`);
        break;
      }

      case "foreach": {
        const target = this.transpileExpr(node.source, filepath);
        const valueVar = JSON.stringify(node.value?.name?.name || node.value?.name || "val");
        const keyVar = node.key ? JSON.stringify(node.key.name?.name || node.key.name) : null;
        lines.push(`${pad}for (const [__k, __v] of Object.entries(${target} || {})) {`);
        if (keyVar) lines.push(`${pad}  ctx.setVar(${keyVar}, __k);`);
        lines.push(`${pad}  ctx.setVar(${valueVar}, __v);`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, currentFuncName);
        lines.push(`${pad}}`);
        break;
      }

      case "try": {
        lines.push(`${pad}try {`);
        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, currentFuncName);
        lines.push(`${pad}} catch (__err) {`);
        if (node.catches && node.catches.length > 0) {
          const catchVar = node.catches[0].variable?.name?.name || node.catches[0].variable?.name || node.catches[0].variable || "e";
          lines.push(`${pad}  ctx.setVar(${JSON.stringify(catchVar)}, __err);`);
          this.transpileNodeList(node.catches[0].body?.children || node.catches[0].body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, currentFuncName);
        }
        lines.push(`${pad}}`);
        break;
      }

      case "include": {
        const target = this.transpileExpr(node.target || node.expr || node.what, filepath);
        if (node.once) {
          lines.push(node.require
            ? `${pad}await ctx.requireOnce(${target});`
            : `${pad}await ctx.includeOnce(${target});`);
        } else {
          lines.push(node.require
            ? `${pad}await ctx.require(${target});`
            : `${pad}await ctx.include(${target});`);
        }
        break;
      }

      case "throw": {
        const expr = this.transpileExpr(node.what || node.expression || node.expr, filepath);
        lines.push(`${pad}throw ${expr};`);
        break;
      }

      case "exit": {
        const expr = node.status ? this.transpileExpr(node.status, filepath) : "0";
        const errPath = JSON.stringify(path.resolve(__dirname, "../runtime/errors/PHPError"));
        lines.push(`${pad}throw new (require(${errPath}).PHPExit)(${expr});`);
        break;
      }

      case "return": {
        const expr = node.expr ? this.transpileExpr(node.expr, filepath) : "undefined";
        lines.push(`${pad}return ${expr};`);
        break;
      }

      case "function": {
        const funcName = (node.name?.name || node.name || "").toString().toLowerCase();
        const visibility = (node.visibility || "public").toString();
        const params = (node.arguments || []).map((a: any, idx: number) => {
          const pName = (a.name?.name || a.name || "p").toString();
          const hasDefault = Boolean(a.value);
          const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
          return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
        });

        const requiredCount = params.filter((p: any) => !p.hasDefault).length;

        lines.push(`${pad}var __fn_${funcName} = async function(ctx, ...args) {`);
        params.forEach((p: any, idx: number) => {
          lines.push(`${pad}  ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
        });

        this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 1, funcName);

        lines.push(`${pad}};`);
        lines.push(`${pad}__fn_${funcName}.phpMeta = { name: ${JSON.stringify(funcName)}, visibility: ${JSON.stringify(visibility)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)} };`);
        lines.push(`${pad}ctx.engine.functions.set(${JSON.stringify(funcName)}, __fn_${funcName});`);
        break;
      }

      case "class": {
        const className = (node.name?.name || node.name || "AnonymousClass").toString();

        lines.push(`${pad}var __cls_${className} = new PHPClass(${JSON.stringify(className)});`);

        for (const item of (node.body || node.children || [])) {
          if (item && (item.kind === "method" || item.kind === "function")) {
            const mName = (item.name?.name || item.name || "").toString().toLowerCase();
            const visibility = (item.visibility || "public").toString();
            const isStatic = Boolean(item.isStatic);

            const params = (item.arguments || []).map((a: any, idx: number) => {
              const pName = (a.name?.name || a.name || "p").toString();
              const hasDefault = Boolean(a.value);
              const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
              return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
            });

            const requiredCount = params.filter((p: any) => !p.hasDefault).length;

            lines.push(`${pad}__cls_${className}.methods.set(${JSON.stringify(mName)}, {`);
            lines.push(`${pad}  name: ${JSON.stringify(mName)},`);
            lines.push(`${pad}  visibility: ${JSON.stringify(visibility)},`);
            lines.push(`${pad}  isStatic: ${isStatic},`);
            lines.push(`${pad}  numberOfParameters: ${params.length},`);
            lines.push(`${pad}  numberOfRequiredParameters: ${requiredCount},`);
            lines.push(`${pad}  parameters: ${JSON.stringify(params)},`);
            lines.push(`${pad}  fn: async function(ctx, ...args) {`);
            params.forEach((p: any, idx: number) => {
              lines.push(`${pad}    ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
            });

            this.transpileNodeList(item.body?.children || item.body, lines, lineMap, mapGen!, filepath, indentLevel(pad) + 2, `${className}::${mName}`);

            lines.push(`${pad}  }`);
            lines.push(`${pad}});`);
          }
        }

        lines.push(`${pad}ctx.engine.classes.set(${JSON.stringify(className.toLowerCase())}, __cls_${className});`);
        break;
      }

      default: {
        const expr = this.transpileExpr(node, filepath);
        if (expr) lines.push(`${pad}${expr};`);
        break;
      }
    }
  }

  private getConstName(node: any): string {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (typeof node.name === "string") return node.name;
    if (typeof node.value === "string") return node.value;
    if (node.name && typeof node.name === "object") return this.getConstName(node.name);
    return String(node);
  }

  private transpileExpr(node: any, filepath: string = "eval"): string {
    if (!node || typeof node !== "object") return "undefined";

    switch (node.kind) {
      case "string":
        return JSON.stringify(node.value);
      case "encapsed": {
        const parts = (node.value || node.parts || []).map((p: any) => {
          if (typeof p === "string") return JSON.stringify(p);
          const exprNode = p.expression || p;
          if (exprNode.kind === "string" || exprNode.kind === "inline") return JSON.stringify(exprNode.value || "");
          return `(String(${this.transpileExpr(exprNode, filepath)} ?? ""))`;
        });
        return `(${parts.length > 0 ? parts.join(" + ") : '""'})`;
      }
      case "number":
        return String(node.value);
      case "boolean":
        return String(node.value);
      case "null":
        return "null";
      case "magic": {
        const m = String(node.value || "").toUpperCase();
        if (m === "__DIR__") return JSON.stringify(path.dirname(filepath));
        if (m === "__FILE__") return JSON.stringify(filepath);
        if (m === "__LINE__") return String(node.loc?.start?.line || 1);
        return JSON.stringify(m);
      }
      case "name":
      case "constref": {
        const constName = this.getConstName(node.name || node);
        return `(ctx.getConstant(${JSON.stringify(constName)}) ?? ${JSON.stringify(constName)})`;
      }
      case "closure":
      case "arrowfunc": {
        const params = (node.arguments || []).map((a: any, idx: number) => {
          const pName = (a.name?.name || a.name || "p").toString();
          const hasDefault = Boolean(a.value);
          const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
          return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
        });

        const dummyLines: string[] = [];
        const dummyLineMap = new Map<number, PHPLineLocation>();
        this.transpileNodeList(node.body?.children || node.body, dummyLines, dummyLineMap, null as any, filepath, 2, "{closure}");

        const paramSetup = params.map((p: any, idx: number) => {
          return `ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`;
        }).join("\n  ");

        const bodyCode = dummyLines.join("\n");

        return `(async function(ctx, ...args) {\n  ${paramSetup}\n${bodyCode}\n})`;
      }
      case "variable":
        return `ctx.getVar(${JSON.stringify(node.name?.name || node.name)})`;
      case "assign": {
        const name = JSON.stringify(node.left?.name?.name || node.left?.name || "var");
        const val = this.transpileExpr(node.right, filepath);
        return `ctx.setVar(${name}, ${val})`;
      }
      case "array": {
        const items = node.items || [];
        const isAssoc = items.some((it: any) => it && it.key);
        if (isAssoc) {
          const pairs = items.map((it: any) => {
            const key = it.key ? this.transpileExpr(it.key, filepath) : JSON.stringify(it);
            const val = this.transpileExpr(it.value || it, filepath);
            return `[${key}]: ${val}`;
          });
          return `({ ${pairs.join(", ")} })`;
        } else {
          const list = items.map((it: any) => this.transpileExpr(it.value || it, filepath));
          return `([ ${list.join(", ")} ])`;
        }
      }
      case "match": {
        const cond = this.transpileExpr(node.cond, filepath);
        const arms = (node.arms || []).map((arm: any) => {
          const body = this.transpileExpr(arm.body, filepath);
          if (!arm.conds || arm.conds.length === 0) {
            return `return ${body};`;
          }
          const conds = arm.conds.map((c: any) => `__m === (${this.transpileExpr(c, filepath)})`).join(" || ");
          return `if (${conds}) return ${body};`;
        });
        return `(await (async () => { const __m = ${cond};\n  ${arms.join("\n  ")}\n  throw new Error("UnhandledMatchError");\n})())`;
      }
      case "nullsafepropertylookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const prop = JSON.stringify(node.offset?.name || node.offset?.value || "prop");
        return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.getProperty(__o, ${prop}) : null; })())`;
      }
      case "nullsafemethodcall": {
        const obj = this.transpileExpr(node.what, filepath);
        const method = JSON.stringify(node.name?.name || node.name || "method");
        const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
        return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.callMethod(__o, ${method}, [${args.join(", ")}]) : null; })())`;
      }
      case "offsetlookup": {
        const target = this.transpileExpr(node.what, filepath);
        const key = node.offset ? this.transpileExpr(node.offset, filepath) : "0";
        return `(${target}?.[${key}])`;
      }
      case "retif": {
        const test = this.transpileExpr(node.test, filepath);
        const trueExpr = node.trueExpr ? this.transpileExpr(node.trueExpr, filepath) : test;
        const falseExpr = this.transpileExpr(node.falseExpr, filepath);
        return `(${test} ? ${trueExpr} : ${falseExpr})`;
      }
      case "coalesce": {
        const left = this.transpileExpr(node.left, filepath);
        const right = this.transpileExpr(node.right, filepath);
        return `(${left} ?? ${right})`;
      }
      case "unary": {
        const val = this.transpileExpr(node.what, filepath);
        return `(${node.type}${val})`;
      }
      case "post": {
        const target = this.transpileTarget(node.what);
        const op = (node.type === "-" || node.type === 2 || node.type === "--") ? "--" : "++";
        return `${target}${op}`;
      }
      case "pre": {
        const target = this.transpileTarget(node.what);
        const op = (node.type === "-" || node.type === 2 || node.type === "--") ? "--" : "++";
        return `${op}${target}`;
      }
      case "isset": {
        const args = (node.variables || [node.variable]).map((v: any) => this.transpileExpr(v, filepath));
        return `(${args.map((a: string) => `${a} !== undefined && ${a} !== null`).join(" && ")})`;
      }
      case "empty": {
        const val = this.transpileExpr(node.variable || node.expr, filepath);
        return `(!${val} || ${val} === "" || ${val} === "0" || ${val} === 0 || (Array.isArray(${val}) && ${val}.length === 0))`;
      }
      case "new": {
        const className = (node.what?.name || node.what?.value || "Object").toString();
        const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
        return `(await ctx.createObject(${JSON.stringify(className)}, [${args.join(", ")}]))`;
      }
      case "bin":
      case "binary": {
        const left = this.transpileExpr(node.left, filepath);
        if (node.type === "instanceof") {
          const rightName = this.getConstName(node.right?.name || node.right);
          return `ctx.isInstanceOf(${left}, ${JSON.stringify(rightName)})`;
        }
        const right = this.transpileExpr(node.right, filepath);
        const op = node.type === "." ? "+" : node.type;
        return `(${left} ${op} ${right})`;
      }
      case "include": {
        const target = this.transpileExpr(node.target || node.expr || node.what, filepath);
        if (node.once) {
          return node.require
            ? `(await ctx.requireOnce(${target}))`
            : `(await ctx.includeOnce(${target}))`;
        } else {
          return node.require
            ? `(await ctx.require(${target}))`
            : `(await ctx.include(${target}))`;
        }
      }
      case "call": {
        if (node.what?.kind === "propertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const method = JSON.stringify(node.what.offset?.name || node.what.offset?.value || node.what.offset || "method");
          const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
          return `(await ctx.callMethod(${obj}, ${method}, [${args.join(", ")}]))`;
        }
        if (node.what?.kind === "nullsafepropertylookup") {
          const obj = this.transpileExpr(node.what.what, filepath);
          const method = JSON.stringify(node.what.offset?.name || node.what.offset?.value || node.what.offset || "method");
          const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
          return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.callMethod(__o, ${method}, [${args.join(", ")}]) : null; })())`;
        }

        const name = (node.what?.name || node.what?.value || "func").toString();
        const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));

        if (name.toLowerCase() === "include") {
          return `(await ctx.include(${args.join(", ")}))`;
        }
        if (name.toLowerCase() === "include_once") {
          return `(await ctx.includeOnce(${args.join(", ")}))`;
        }
        if (name.toLowerCase() === "require") {
          return `(await ctx.require(${args.join(", ")}))`;
        }
        if (name.toLowerCase() === "require_once") {
          return `(await ctx.requireOnce(${args.join(", ")}))`;
        }

        return `(await ctx.callFunction(${JSON.stringify(name)}, [${args.join(", ")}]))`;
      }
      case "propertylookup": {
        const obj = this.transpileExpr(node.what, filepath);
        const prop = JSON.stringify(node.offset?.name || node.offset?.value || "prop");
        return `(await ctx.getProperty(${obj}, ${prop}))`;
      }
      case "methodcall": {
        const obj = this.transpileExpr(node.what, filepath);
        const method = JSON.stringify(node.name?.name || node.name || "method");
        const args = (node.arguments || []).map((a: any) => this.transpileExpr(a, filepath));
        return `(await ctx.callMethod(${obj}, ${method}, [${args.join(", ")}]))`;
      }
      default:
        return "undefined";
    }
  }

  private transpileTarget(node: any): string {
    if (!node) return "tmp";
    if (node.kind === "variable") {
      return `ctx.vars[${JSON.stringify(node.name?.name || node.name)}]`;
    }
    return "tmp";
  }
}

function indentLevel(pad: string): number {
  return pad.length / 2;
}
