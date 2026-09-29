"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSTranspiler = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const source_map_1 = require("source-map");
const PHPParser_1 = require("./PHPParser");
const ASTOptimizer_1 = require("./ASTOptimizer");
class JSTranspiler {
    parser;
    constructor() {
        this.parser = new PHPParser_1.PHPParser();
    }
    transpile(sourceCode, filepath, options) {
        const resolvedPath = path.isAbsolute(filepath) ? path.resolve(filepath) : filepath;
        const pathSHA1 = crypto.createHash("sha1").update(resolvedPath).digest("hex");
        const cacheBase = (filepath === "eval") ? undefined : (options.cacheDir || process.env.JSPHP_CACHE);
        let cacheJSPath = "";
        let cacheMapPath = "";
        if (cacheBase) {
            const targetDir = path.join(cacheBase, options.engineSHA1);
            cacheJSPath = path.join(targetDir, `${pathSHA1}.js`);
            cacheMapPath = path.join(targetDir, `${pathSHA1}.js.map`);
            if (fs.existsSync(cacheJSPath) && fs.existsSync(cacheMapPath)) {
                try {
                    const cachedCode = fs.readFileSync(cacheJSPath, "utf8");
                    const cachedMap = fs.readFileSync(cacheMapPath, "utf8");
                    return { code: cachedCode, map: cachedMap, cached: true };
                }
                catch (e) {
                    // Recompile on read error
                }
            }
        }
        const rawAst = this.parser.parse(sourceCode, filepath);
        const optimizedAst = ASTOptimizer_1.ASTOptimizer.optimize(rawAst, options.optimizerCtx);
        const mapGen = new source_map_1.SourceMapGenerator({ file: `${path.basename(filepath)}.js` });
        mapGen.setSourceContent(filepath, sourceCode);
        const jsLines = [];
        jsLines.push(`// Transpiled from PHP: ${filepath}`);
        jsLines.push(`module.exports = async function(ctx) {`);
        this.transpileNodeList(optimizedAst.children || optimizedAst, jsLines, mapGen, filepath, 1);
        jsLines.push(`};`);
        let generatedCode = jsLines.join("\n");
        const mapString = mapGen.toString();
        const base64Map = Buffer.from(mapString, "utf8").toString("base64");
        generatedCode += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map}\n`;
        if (cacheJSPath) {
            try {
                const dir = path.dirname(cacheJSPath);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(cacheJSPath, generatedCode, "utf8");
                fs.writeFileSync(cacheMapPath, mapString, "utf8");
            }
            catch (e) {
                // Non-fatal
            }
        }
        return { code: generatedCode, map: mapString, cached: false };
    }
    transpileNodeList(nodes, lines, mapGen, filepath, indent) {
        if (!nodes)
            return;
        const nodeList = Array.isArray(nodes) ? nodes : [nodes];
        const pad = "  ".repeat(indent);
        for (const node of nodeList) {
            if (!node)
                continue;
            if (mapGen && node.loc?.start) {
                mapGen.addMapping({
                    generated: {
                        line: lines.length + 1,
                        column: pad.length,
                    },
                    source: filepath,
                    original: {
                        line: node.loc.start.line,
                        column: node.loc.start.column || 0,
                    },
                });
            }
            const stmt = this.transpileNode(node, filepath, pad, mapGen);
            if (stmt) {
                lines.push(stmt);
            }
        }
    }
    transpileNode(node, filepath, pad, mapGen) {
        if (!node || typeof node !== "object")
            return "";
        switch (node.kind) {
            case "echo":
            case "print": {
                const exprs = node.expressions || node.arguments || [node.expression];
                const args = exprs.filter(Boolean).map((a) => this.transpileExpr(a, filepath));
                return `${pad}await ctx.echo(${args.join(" + ")});`;
            }
            case "inline": {
                const escaped = JSON.stringify(node.value || "");
                return `${pad}await ctx.echo(${escaped});`;
            }
            case "expressionstatement": {
                const expr = this.transpileExpr(node.expression, filepath);
                return expr ? `${pad}${expr};` : "";
            }
            case "assign": {
                const target = this.transpileTarget(node.left);
                const value = this.transpileExpr(node.right, filepath);
                return `${pad}${target} = ${value};`;
            }
            case "global": {
                const vars = (node.items || []).map((v) => {
                    const name = JSON.stringify(v.name?.name || v.name);
                    return `ctx.vars[${name}] = ctx.getVar(${name});`;
                });
                return `${pad}${vars.join("\n" + pad)}`;
            }
            case "if": {
                const cond = this.transpileExpr(node.test, filepath);
                let code = `${pad}if (${cond}) {\n`;
                const bodyLines = [];
                this.transpileNodeList(node.body?.children || node.body, bodyLines, mapGen, filepath, 1);
                code += bodyLines.map((l) => pad + "  " + l).join("\n") + `\n${pad}}`;
                if (node.alternate) {
                    code += ` else {\n`;
                    const altLines = [];
                    this.transpileNodeList(node.alternate?.children || node.alternate, altLines, mapGen, filepath, 1);
                    code += altLines.map((l) => pad + "  " + l).join("\n") + `\n${pad}}`;
                }
                return code;
            }
            case "while": {
                const cond = this.transpileExpr(node.test, filepath);
                let code = `${pad}while (${cond}) {\n`;
                const bodyLines = [];
                this.transpileNodeList(node.body?.children || node.body, bodyLines, mapGen, filepath, 1);
                code += bodyLines.map((l) => pad + "  " + l).join("\n") + `\n${pad}}`;
                return code;
            }
            case "foreach": {
                const target = this.transpileExpr(node.source, filepath);
                const valueVar = JSON.stringify(node.value?.name?.name || node.value?.name || "val");
                const keyVar = node.key ? JSON.stringify(node.key.name?.name || node.key.name) : null;
                let code = `${pad}for (const [__k, __v] of Object.entries(${target} || {})) {\n`;
                if (keyVar)
                    code += `${pad}  ctx.setVar(${keyVar}, __k);\n`;
                code += `${pad}  ctx.setVar(${valueVar}, __v);\n`;
                const bodyLines = [];
                this.transpileNodeList(node.body?.children || node.body, bodyLines, mapGen, filepath, 1);
                code += bodyLines.map((l) => pad + "  " + l).join("\n") + `\n${pad}}`;
                return code;
            }
            case "try": {
                let code = `${pad}try {\n`;
                const bodyLines = [];
                this.transpileNodeList(node.body?.children || node.body, bodyLines, mapGen, filepath, 1);
                code += bodyLines.map((l) => pad + "  " + l).join("\n") + `\n${pad}} catch (__err) {\n`;
                if (node.catches && node.catches.length > 0) {
                    const catchVar = node.catches[0].variable?.name?.name || node.catches[0].variable?.name || node.catches[0].variable || "e";
                    code += `${pad}  ctx.setVar(${JSON.stringify(catchVar)}, __err);\n`;
                    const catchBody = [];
                    this.transpileNodeList(node.catches[0].body?.children || node.catches[0].body, catchBody, mapGen, filepath, 1);
                    code += catchBody.map((l) => pad + "  " + l).join("\n") + `\n${pad}}`;
                }
                else {
                    code += `${pad}}`;
                }
                return code;
            }
            case "throw": {
                const expr = this.transpileExpr(node.what || node.expression || node.expr, filepath);
                return `${pad}throw ${expr};`;
            }
            case "return": {
                const expr = node.expr ? this.transpileExpr(node.expr, filepath) : "undefined";
                return `${pad}return ${expr};`;
            }
            case "function": {
                const funcName = (node.name?.name || node.name || "").toString().toLowerCase();
                const visibility = (node.visibility || "public").toString();
                const params = (node.arguments || []).map((a, idx) => {
                    const pName = (a.name?.name || a.name || "p").toString();
                    const hasDefault = Boolean(a.value);
                    const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
                    return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
                });
                const requiredCount = params.filter((p) => !p.hasDefault).length;
                const bodyLines = [];
                this.transpileNodeList(node.body?.children || node.body, bodyLines, mapGen, filepath, 2);
                const paramSetup = params.map((p, idx) => {
                    return `ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`;
                }).join("\n" + pad + "  ");
                const bodyCode = bodyLines.map((l) => pad + "  " + l).join("\n");
                return `${pad}const __fn_${funcName} = async function(ctx, ...args) {\n${pad}  ${paramSetup}\n${bodyCode}\n${pad}};\n` +
                    `${pad}__fn_${funcName}.phpMeta = { name: ${JSON.stringify(funcName)}, visibility: ${JSON.stringify(visibility)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)} };\n` +
                    `${pad}ctx.engine.functions.set(${JSON.stringify(funcName)}, __fn_${funcName});`;
            }
            case "class": {
                const className = (node.name?.name || node.name || "AnonymousClass").toString();
                return `${pad}ctx.engine.classes.set(${JSON.stringify(className.toLowerCase())}, new (require("./src/runtime/objects/PHPObject").PHPClass)(${JSON.stringify(className)}));`;
            }
            default: {
                const expr = this.transpileExpr(node, filepath);
                return expr ? `${pad}${expr};` : "";
            }
        }
    }
    getConstName(node) {
        if (!node)
            return "";
        if (typeof node === "string")
            return node;
        if (typeof node.name === "string")
            return node.name;
        if (typeof node.value === "string")
            return node.value;
        if (node.name && typeof node.name === "object")
            return this.getConstName(node.name);
        return String(node);
    }
    transpileExpr(node, filepath = "eval") {
        if (!node || typeof node !== "object")
            return "undefined";
        switch (node.kind) {
            case "string":
                return JSON.stringify(node.value);
            case "number":
                return String(node.value);
            case "boolean":
                return String(node.value);
            case "null":
                return "null";
            case "magic": {
                const m = String(node.value || "").toUpperCase();
                if (m === "__DIR__")
                    return JSON.stringify(path.dirname(filepath));
                if (m === "__FILE__")
                    return JSON.stringify(filepath);
                if (m === "__LINE__")
                    return String(node.loc?.start?.line || 1);
                return JSON.stringify(m);
            }
            case "name":
            case "constref": {
                const constName = this.getConstName(node.name || node);
                return `(ctx.getConstant(${JSON.stringify(constName)}) ?? ${JSON.stringify(constName)})`;
            }
            case "closure":
            case "arrowfunc": {
                const params = (node.arguments || []).map((a, idx) => {
                    const pName = (a.name?.name || a.name || "p").toString();
                    const hasDefault = Boolean(a.value);
                    const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
                    return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
                });
                const bodyLines = [];
                this.transpileNodeList(node.body?.children || node.body, bodyLines, null, filepath, 2);
                const paramSetup = params.map((p, idx) => {
                    return `ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`;
                }).join("\n  ");
                const bodyCode = bodyLines.map((l) => "  " + l).join("\n");
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
                const isAssoc = items.some((it) => it && it.key);
                if (isAssoc) {
                    const pairs = items.map((it) => {
                        const key = it.key ? this.transpileExpr(it.key, filepath) : JSON.stringify(it);
                        const val = this.transpileExpr(it.value || it, filepath);
                        return `[${key}]: ${val}`;
                    });
                    return `({ ${pairs.join(", ")} })`;
                }
                else {
                    const list = items.map((it) => this.transpileExpr(it.value || it, filepath));
                    return `([ ${list.join(", ")} ])`;
                }
            }
            case "match": {
                const cond = this.transpileExpr(node.cond, filepath);
                const arms = (node.arms || []).map((arm) => {
                    const body = this.transpileExpr(arm.body, filepath);
                    if (!arm.conds || arm.conds.length === 0) {
                        return `return ${body};`;
                    }
                    const conds = arm.conds.map((c) => `__m === (${this.transpileExpr(c, filepath)})`).join(" || ");
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
                const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
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
                return `(${target}${node.type})`;
            }
            case "pre": {
                const target = this.transpileTarget(node.what);
                return `(${node.type}${target})`;
            }
            case "isset": {
                const args = (node.variables || [node.variable]).map((v) => this.transpileExpr(v, filepath));
                return `(${args.map((a) => `${a} !== undefined && ${a} !== null`).join(" && ")})`;
            }
            case "empty": {
                const val = this.transpileExpr(node.variable || node.expr, filepath);
                return `(!${val} || ${val} === "" || ${val} === "0" || ${val} === 0 || (Array.isArray(${val}) && ${val}.length === 0))`;
            }
            case "new": {
                const className = (node.what?.name || node.what?.value || "Object").toString();
                const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
                return `(await ctx.createObject(${JSON.stringify(className)}, [${args.join(", ")}]))`;
            }
            case "bin":
            case "binary": {
                const left = this.transpileExpr(node.left, filepath);
                const right = this.transpileExpr(node.right, filepath);
                const op = node.type === "." ? "+" : node.type;
                return `(${left} ${op} ${right})`;
            }
            case "call": {
                if (node.what?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.what.what, filepath);
                    const method = JSON.stringify(node.what.offset?.name || node.what.offset?.value || node.what.offset || "method");
                    const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
                    return `(await ctx.callMethod(${obj}, ${method}, [${args.join(", ")}]))`;
                }
                if (node.what?.kind === "nullsafepropertylookup") {
                    const obj = this.transpileExpr(node.what.what, filepath);
                    const method = JSON.stringify(node.what.offset?.name || node.what.offset?.value || node.what.offset || "method");
                    const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
                    return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.callMethod(__o, ${method}, [${args.join(", ")}]) : null; })())`;
                }
                const name = (node.what?.name || node.what?.value || "func").toString();
                const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
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
                const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
                return `(await ctx.callMethod(${obj}, ${method}, [${args.join(", ")}]))`;
            }
            default:
                return "undefined";
        }
    }
    transpileTarget(node) {
        if (!node)
            return "tmp";
        if (node.kind === "variable") {
            return `ctx.vars[${JSON.stringify(node.name?.name || node.name)}]`;
        }
        return "tmp";
    }
}
exports.JSTranspiler = JSTranspiler;
//# sourceMappingURL=JSTranspiler.js.map