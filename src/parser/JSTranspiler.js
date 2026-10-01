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
const SourceMapRegistry_1 = require("../runtime/SourceMapRegistry");
const PHPError_1 = require("../runtime/PHPError");
class JSTranspiler {
    parser;
    currentClassName = "";
    currentNamespaceName = "";
    classImports = new Map();
    constructor() {
        this.parser = new PHPParser_1.PHPParser();
    }
    transpile(sourceCode, filepath, options) {
        this.currentClassName = "";
        this.currentNamespaceName = "";
        this.classImports = new Map();
        const resolvedPath = path.isAbsolute(filepath) ? path.resolve(filepath) : filepath;
        const pathSHA1 = crypto.createHash("sha1").update(resolvedPath).digest("hex");
        const cacheBase = (filepath === "eval" || options.cacheDir === null)
            ? undefined
            : (options.cacheDir || process.env.JSPHP_CACHE);
        let cacheJSPath = "";
        let cacheMapPath = "";
        let lockPath = "";
        let acquiredLock = false;
        if (cacheBase) {
            const targetDir = path.join(cacheBase, options.engineSHA1);
            cacheJSPath = path.join(targetDir, `${pathSHA1}.js`);
            cacheMapPath = path.join(targetDir, `${pathSHA1}.js.map`);
            lockPath = path.join(targetDir, `${pathSHA1}.lock`);
            if (fs.existsSync(cacheJSPath) && fs.existsSync(cacheMapPath)) {
                try {
                    const cachedCode = fs.readFileSync(cacheJSPath, "utf8");
                    const cachedMap = fs.readFileSync(cacheMapPath, "utf8");
                    const lineMap = new Map();
                    SourceMapRegistry_1.SourceMapRegistry.register(filepath, lineMap);
                    return { code: cachedCode, map: cachedMap, cached: true, lineMap };
                }
                catch (e) {
                }
            }
            const startTime = Date.now();
            const lockTimeoutMs = 10000;
            while (!acquiredLock && Date.now() - startTime < lockTimeoutMs) {
                try {
                    fs.mkdirSync(targetDir, { recursive: true });
                    const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
                    fs.writeSync(fd, String(process.pid));
                    fs.closeSync(fd);
                    acquiredLock = true;
                }
                catch (err) {
                    if (err.code === "EEXIST") {
                        if (fs.existsSync(cacheJSPath) && fs.existsSync(cacheMapPath)) {
                            try {
                                const cachedCode = fs.readFileSync(cacheJSPath, "utf8");
                                const cachedMap = fs.readFileSync(cacheMapPath, "utf8");
                                const lineMap = new Map();
                                SourceMapRegistry_1.SourceMapRegistry.register(filepath, lineMap);
                                return { code: cachedCode, map: cachedMap, cached: true, lineMap };
                            }
                            catch (e) {
                            }
                        }
                        try {
                            if (fs.existsSync(lockPath)) {
                                const pidStr = fs.readFileSync(lockPath, "utf8");
                                const pid = parseInt(pidStr, 10);
                                if (pid) {
                                    try {
                                        process.kill(pid, 0);
                                    }
                                    catch {
                                        fs.unlinkSync(lockPath);
                                    }
                                }
                            }
                        }
                        catch (e) {
                            try {
                                fs.unlinkSync(lockPath);
                            }
                            catch (e) { }
                        }
                        this.sleepSync(20);
                    }
                    else {
                        break;
                    }
                }
            }
        }
        try {
            const rawAst = this.parser.parse(sourceCode, filepath);
            const optimizedAst = ASTOptimizer_1.ASTOptimizer.optimize(rawAst, options.engine);
            const mapGen = new source_map_1.SourceMapGenerator({ file: `${path.basename(filepath)}.js` });
            mapGen.setSourceContent(filepath, sourceCode);
            const jsLines = [];
            const lineMap = new Map();
            const phpObjPath = JSON.stringify(path.resolve(__dirname, "../runtime/PHPObject"));
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
                }
                catch (e) {
                }
            }
            SourceMapRegistry_1.SourceMapRegistry.register(filepath, lineMap);
            return { code: generatedCode, map: mapString, cached: false, lineMap };
        }
        finally {
            if (acquiredLock && lockPath && fs.existsSync(lockPath)) {
                try {
                    fs.unlinkSync(lockPath);
                }
                catch (e) {
                }
            }
        }
    }
    sleepSync(ms) {
        try {
            const buf = new Int32Array(new SharedArrayBuffer(4));
            Atomics.wait(buf, 0, 0, ms);
        }
        catch {
            const end = Date.now() + ms;
            while (Date.now() < end) { }
        }
    }
    transpileNodeList(nodes, lines, lineMap, mapGen, filepath, indent, currentFuncName = "{main}") {
        if (!nodes)
            return;
        const rawList = Array.isArray(nodes) ? nodes : [nodes];
        const pad = "  ".repeat(indent);
        let nodeList = rawList;
        if (currentFuncName === "{main}") {
            const imports = rawList.filter((node) => node?.kind === "usegroup");
            const decls = rawList.filter((n) => n && (n.kind === "function" || n.kind === "class" || n.kind === "interface" || n.kind === "trait"));
            const stmts = rawList.filter((n) => !n || (n.kind !== "usegroup" && n.kind !== "function" && n.kind !== "class" && n.kind !== "interface" && n.kind !== "trait"));
            nodeList = [...imports, ...decls, ...stmts];
        }
        for (const node of nodeList) {
            if (!node)
                continue;
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
    transpileNode(node, filepath, pad, lines, lineMap, mapGen, currentFuncName = "{main}") {
        if (!node || typeof node !== "object")
            return;
        switch (node.kind) {
            case "namespace": {
                const previousNamespaceName = this.currentNamespaceName;
                const previousImports = this.classImports;
                this.currentNamespaceName = this.getConstName(node.name || node.namespace || "");
                this.classImports = new Map();
                this.transpileNodeList(node.children || node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad), currentFuncName);
                this.currentNamespaceName = previousNamespaceName;
                this.classImports = previousImports;
                break;
            }
            case "usegroup": {
                for (const item of node.items || []) {
                    if (item.type || node.type)
                        continue;
                    const importedName = [node.name, item.name].filter(Boolean).join("\\").replace(/^\\/, "");
                    const alias = this.getConstName(item.alias) || importedName.split("\\").pop();
                    this.classImports.set(alias.toLowerCase(), importedName);
                }
                break;
            }
            case "echo":
            case "print": {
                const exprs = node.expressions || node.arguments || [node.expression];
                const args = exprs.filter(Boolean).map((a) => this.transpileExpr(a, filepath));
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
                if (expr)
                    lines.push(`${pad}${expr};`);
                break;
            }
            case "assign": {
                const value = this.transpileExpr(node.right, filepath);
                if (node.left?.kind === "offsetlookup" && node.left.what?.kind === "offsetlookup" && node.left.what.what?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.left.what.what.what, filepath);
                    const prop = JSON.stringify(node.left.what.what.offset?.name || node.left.what.what.offset?.value || node.left.what.what.offset || "prop");
                    const keys = [node.left.what.offset, node.left.offset].map((key) => this.transpileExpr(key, filepath));
                    lines.push(`${pad}await ctx.setPropertyOffsets(${obj}, ${prop}, [${keys.join(", ")}], ${value});`);
                    break;
                }
                if (node.left?.kind === "offsetlookup" && node.left.what?.kind === "variable") {
                    const name = JSON.stringify(node.left.what.name?.name || node.left.what.name);
                    const key = node.left.offset ? this.transpileExpr(node.left.offset, filepath) : "null";
                    lines.push(`${pad}await ctx.setVarOffset(${name}, ${key}, ${value});`);
                    break;
                }
                if (node.left?.kind === "offsetlookup" && node.left.what?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.left.what.what, filepath);
                    const prop = JSON.stringify(node.left.what.offset?.name || node.left.what.offset?.value || node.left.what.offset || "prop");
                    const key = node.left.offset ? this.transpileExpr(node.left.offset, filepath) : "null";
                    lines.push(`${pad}await ctx.setPropertyOffset(${obj}, ${prop}, ${key}, ${value});`);
                    break;
                }
                if (node.left?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.left.what, filepath);
                    const prop = JSON.stringify(node.left.offset?.name || node.left.offset?.value || node.left.offset || "prop");
                    lines.push(`${pad}await ctx.setProperty(${obj}, ${prop}, ${value});`);
                    break;
                }
                const target = this.transpileTarget(node.left, filepath);
                if (target.startsWith("ctx.setVar(")) {
                    lines.push(`${pad}${target.replace(")", `, ${value})`)};`);
                }
                else {
                    lines.push(`${pad}${target} = ${value};`);
                }
                break;
            }
            case "global": {
                const vars = (node.items || []).map((v) => {
                    const name = JSON.stringify(v.name?.name || v.name);
                    return `${pad}ctx.bindGlobal(${name});`;
                });
                vars.forEach((v) => lines.push(v));
                break;
            }
            case "static": {
                for (const variable of node.variables || []) {
                    const name = variable.variable?.name?.name || variable.variable?.name || variable.name?.name || variable.name;
                    const valueNode = variable.defaultValue || variable.value;
                    const value = valueNode ? this.transpileExpr(valueNode, filepath) : "undefined";
                    lines.push(`${pad}ctx.initStaticVar(${JSON.stringify(currentFuncName)}, ${JSON.stringify(name)}, ${value});`);
                }
                break;
            }
            case "if": {
                const cond = this.transpileExpr(node.test, filepath);
                lines.push(`${pad}if (ctx.isTruthy(${cond})) {`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
                lines.push(`${pad}}`);
                if (node.alternate) {
                    lines.push(`${pad}else {`);
                    this.transpileNodeList(node.alternate?.children || node.alternate, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
                    lines.push(`${pad}}`);
                }
                break;
            }
            case "while": {
                const cond = this.transpileExpr(node.test, filepath);
                lines.push(`${pad}while (ctx.isTruthy(${cond})) {`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
                lines.push(`${pad}}`);
                break;
            }
            case "switch": {
                lines.push(`${pad}{`);
                lines.push(`${pad}  const switchValue = ${this.transpileExpr(node.test, filepath)};`);
                lines.push(`${pad}  switch (true) {`);
                for (const branch of node.body?.children || []) {
                    lines.push(branch.test
                        ? `${pad}    case (switchValue == ${this.transpileExpr(branch.test, filepath)}):`
                        : `${pad}    default:`);
                    this.transpileNodeList(branch.body?.children || branch.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 3, currentFuncName);
                }
                lines.push(`${pad}  }`);
                lines.push(`${pad}}`);
                break;
            }
            case "for": {
                const init = (node.init || []).map((n) => {
                    if (n.kind === "assign") {
                        const left = this.transpileTarget(n.left, filepath);
                        const right = this.transpileExpr(n.right, filepath);
                        if (left.startsWith("ctx.setVar(")) {
                            return left.replace(")", `, ${right})`);
                        }
                        return `${left} = ${right}`;
                    }
                    return this.transpileExpr(n, filepath);
                }).join(", ");
                const test = (node.test || []).map((n) => this.transpileExpr(n, filepath)).join(", ");
                const inc = (node.increment || []).map((n) => {
                    if (n.kind === "post" || n.kind === "pre") {
                        const target = this.transpileTarget(n.what, filepath);
                        const op = (n.type === "-" || n.type === 2 || n.type === "--") ? "- 1" : "+ 1";
                        if (n.what?.kind === "variable") {
                            const varName = JSON.stringify(n.what.name?.name || n.what.name);
                            return `ctx.setVar(${varName}, (ctx.getVar(${varName}) || 0) ${op})`;
                        }
                        return `${target}${n.kind === "post" ? (op === "- 1" ? "--" : "++") : (op === "- 1" ? "--" : "++")}`;
                    }
                    if (n.kind === "assign") {
                        const left = this.transpileTarget(n.left, filepath);
                        const right = this.transpileExpr(n.right, filepath);
                        if (left.startsWith("ctx.setVar(")) {
                            return left.replace(")", `, ${right})`);
                        }
                        return `${left} = ${right}`;
                    }
                    return this.transpileExpr(n, filepath);
                }).join(", ");
                lines.push(`${pad}for (${init}; ctx.isTruthy(${test}); ${inc}) {`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
                lines.push(`${pad}}`);
                break;
            }
            case "foreach": {
                const target = this.transpileExpr(node.source, filepath);
                const valueVar = JSON.stringify(node.value?.name?.name || node.value?.name || "val");
                const keyVar = node.key ? JSON.stringify(node.key.name?.name || node.key.name) : null;
                lines.push(`${pad}for (const [__k, __v] of Object.entries(${target} || {})) {`);
                if (keyVar)
                    lines.push(`${pad}  ctx.setVar(${keyVar}, __k);`);
                lines.push(`${pad}  ctx.setVar(${valueVar}, __v);`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
                lines.push(`${pad}}`);
                break;
            }
            case "try": {
                lines.push(`${pad}try {`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
                lines.push(`${pad}} catch (__err) {`);
                if (node.catches && node.catches.length > 0) {
                    const catchVar = node.catches[0].variable?.name?.name || node.catches[0].variable?.name || node.catches[0].variable || "e";
                    lines.push(`${pad}  ctx.setVar(${JSON.stringify(catchVar)}, __err);`);
                    this.transpileNodeList(node.catches[0].body?.children || node.catches[0].body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 1, currentFuncName);
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
                }
                else {
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
                lines.push(`${pad}${this.transpileExpr(node, filepath)};`);
                break;
            }
            case "return": {
                const expr = node.expr ? this.transpileExpr(node.expr, filepath) : "undefined";
                lines.push(`${pad}return ${expr};`);
                break;
            }
            case "break": {
                lines.push(`${pad}break;`);
                break;
            }
            case "continue": {
                lines.push(`${pad}continue;`);
                break;
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
                lines.push(`${pad}var __fn_${funcName} = async function(ctx, ...args) {`);
                lines.push(`${pad}  ctx.pushScope();`);
                lines.push(`${pad}  try {`);
                params.forEach((p, idx) => {
                    lines.push(`${pad}    ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
                });
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 2, funcName);
                lines.push(`${pad}  } finally {`);
                lines.push(`${pad}    ctx.popScope();`);
                lines.push(`${pad}  }`);
                lines.push(`${pad}};`);
                lines.push(`${pad}__fn_${funcName}.phpMeta = { name: ${JSON.stringify(funcName)}, visibility: ${JSON.stringify(visibility)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)} };`);
                lines.push(`${pad}ctx.engine.functions.set(${JSON.stringify(funcName)}, __fn_${funcName});`);
                break;
            }
            case "class": {
                const className = (node.name?.name || node.name || "AnonymousClass").toString();
                const qualifiedClassName = this.currentNamespaceName ? `${this.currentNamespaceName}\\${className}` : className;
                const previousClassName = this.currentClassName;
                this.currentClassName = qualifiedClassName;
                const parentClass = node.extends ? `(await ctx.resolveClass(${this.transpileClassReference(node.extends, filepath)}))` : "undefined";
                lines.push(`${pad}var __cls_${className} = new PHPClass(${JSON.stringify(qualifiedClassName)}, ${parentClass});`);
                lines.push(`${pad}ctx.engine.classes.set(${JSON.stringify(qualifiedClassName.toLowerCase())}, __cls_${className});`);
                const bodyItems = Array.isArray(node.body)
                    ? node.body
                    : Array.isArray(node.body?.children)
                        ? node.body.children
                        : Array.isArray(node.children)
                            ? node.children
                            : [];
                for (const constant of this.orderClassConstants(bodyItems, qualifiedClassName, filepath)) {
                    const name = this.getConstName(constant.name);
                    lines.push(`${pad}__cls_${className}.constants.set(${JSON.stringify(name)}, ${this.transpileExpr(constant.value, filepath)});`);
                }
                for (const item of bodyItems) {
                    if (item?.kind === "classconstant")
                        continue;
                    if (item?.kind === "propertystatement") {
                        const visibility = (item.visibility || "public").toString();
                        for (const property of item.properties || []) {
                            const name = property.name?.name || property.name;
                            const value = property.value ? this.transpileExpr(property.value, filepath) : "null";
                            lines.push(`${pad}__cls_${className}.properties.set(${JSON.stringify(name)}, { name: ${JSON.stringify(name)}, visibility: ${JSON.stringify(visibility)}, isStatic: ${Boolean(item.isStatic)}, isReadOnly: ${Boolean(property.readonly)}, defaultValue: ${value} });`);
                            if (item.isStatic)
                                lines.push(`${pad}__cls_${className}.staticProperties.set(${JSON.stringify(name)}, __cls_${className}.properties.get(${JSON.stringify(name)}).defaultValue);`);
                        }
                        continue;
                    }
                    if (item && (item.kind === "method" || item.kind === "function")) {
                        const mName = (item.name?.name || item.name || "").toString().toLowerCase();
                        const visibility = (item.visibility || "public").toString();
                        const isStatic = Boolean(item.isStatic);
                        const params = (item.arguments || []).map((a, idx) => {
                            const pName = (a.name?.name || a.name || "p").toString();
                            const hasDefault = Boolean(a.value);
                            const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
                            return { name: pName, position: idx, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
                        });
                        const requiredCount = params.filter((p) => !p.hasDefault).length;
                        lines.push(`${pad}__cls_${className}.methods.set(${JSON.stringify(mName)}, {`);
                        lines.push(`${pad}  name: ${JSON.stringify(mName)},`);
                        lines.push(`${pad}  visibility: ${JSON.stringify(visibility)},`);
                        lines.push(`${pad}  isStatic: ${isStatic},`);
                        lines.push(`${pad}  numberOfParameters: ${params.length},`);
                        lines.push(`${pad}  numberOfRequiredParameters: ${requiredCount},`);
                        lines.push(`${pad}  parameters: ${JSON.stringify(params)},`);
                        lines.push(`${pad}  fn: async function(ctx, ...args) {`);
                        lines.push(`${pad}    ctx.pushScope();`);
                        lines.push(`${pad}    try {`);
                        params.forEach((p, idx) => {
                            lines.push(`${pad}      ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
                        });
                        this.transpileNodeList(item.body?.children || item.body, lines, lineMap, mapGen, filepath, indentLevel(pad) + 3, `${className}::${mName}`);
                        lines.push(`${pad}    } finally {`);
                        lines.push(`${pad}      ctx.popScope();`);
                        lines.push(`${pad}    }`);
                        lines.push(`${pad}  }`);
                        lines.push(`${pad}});`);
                    }
                }
                lines.push(`${pad}if (!ctx.engine.classes.has(${JSON.stringify(className.toLowerCase())})) ctx.engine.classes.set(${JSON.stringify(className.toLowerCase())}, __cls_${className});`);
                this.currentClassName = previousClassName;
                break;
            }
            default: {
                const expr = this.transpileExpr(node, filepath);
                if (expr)
                    lines.push(`${pad}${expr};`);
                break;
            }
        }
    }
    orderClassConstants(body, className, filepath) {
        const constants = new Map();
        for (const item of body) {
            if (item?.kind === "classconstant") {
                for (const constant of item.constants || [])
                    constants.set(this.getConstName(constant.name), constant);
            }
        }
        const ordered = [];
        const visited = new Set();
        const pending = new Set();
        const visit = (name) => {
            if (visited.has(name))
                return;
            const constant = constants.get(name);
            if (!constant)
                return;
            if (pending.has(name)) {
                throw new PHPError_1.PHPFatalError(`Cannot declare self-referencing constant ${className}::${name}`, 0, filepath, constant.loc?.start?.line || 0);
            }
            pending.add(name);
            const visitValue = (value) => {
                if (!value || typeof value !== "object")
                    return;
                if (value.kind === "staticlookup" && value.offset?.kind !== "variable" &&
                    this.transpileClassReference(value.what, filepath) === JSON.stringify(className)) {
                    visit(this.getConstName(value.offset));
                }
                for (const [key, child] of Object.entries(value)) {
                    if (key !== "loc")
                        visitValue(child);
                }
            };
            visitValue(constant.value);
            pending.delete(name);
            visited.add(name);
            ordered.push(constant);
        };
        for (const name of constants.keys())
            visit(name);
        return ordered;
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
    transpileClassReference(node, filepath) {
        if (node?.kind === "variable")
            return this.transpileExpr(node, filepath);
        const name = this.getConstName(node);
        if (node?.kind === "selfreference" || name === "self")
            return JSON.stringify(this.currentClassName);
        if (node?.kind === "staticreference" || name === "static") {
            return `(this.phpClass?.name || this.name || ${JSON.stringify(this.currentClassName)})`;
        }
        if (node?.kind === "parentreference" || name === "parent") {
            return `(await ctx.resolveClass(${JSON.stringify(this.currentClassName)})).parentClass.name`;
        }
        if (name.startsWith("\\") || node?.resolution === "fqn")
            return JSON.stringify(name.replace(/^\\/, ""));
        const parts = name.split("\\");
        const importedName = this.classImports.get(parts[0].toLowerCase());
        if (importedName)
            return JSON.stringify([importedName, ...parts.slice(1)].join("\\"));
        return JSON.stringify(this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name);
    }
    transpileExpr(node, filepath = "eval") {
        if (!node || typeof node !== "object")
            return "undefined";
        switch (node.kind) {
            case "string":
                return JSON.stringify(node.value);
            case "encapsed": {
                const parts = (node.value || node.parts || []).map((p) => {
                    if (typeof p === "string")
                        return JSON.stringify(p);
                    const exprNode = p.expression || p;
                    if (exprNode.kind === "string" || exprNode.kind === "inline")
                        return JSON.stringify(exprNode.value || "");
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
            case "exit": {
                const status = node.expression || node.status;
                return `(await ctx.callFunction("exit", [${status ? this.transpileExpr(status, filepath) : "0"}]))`;
            }
            case "silent": {
                const expression = this.transpileExpr(node.expr, filepath);
                return `(await (async () => { const previousErrorReporting = ctx.errorReportingLevel; ctx.errorReportingLevel &= 4437; try { return ${expression}; } finally { ctx.errorReportingLevel = previousErrorReporting; } })())`;
            }
            case "cast": {
                const value = this.transpileExpr(node.expr, filepath);
                if (node.type === "bool")
                    return `ctx.isTruthy(${value})`;
                if (node.type === "int")
                    return `(await ctx.callFunction("intval", [${value}]))`;
                if (node.type === "float")
                    return `(await ctx.callFunction("floatval", [${value}]))`;
                if (node.type === "string" || node.type === "binary")
                    return `(await ctx.callFunction("strval", [${value}]))`;
                if (node.type === "array") {
                    return `(await (async () => { const castValue = ${value}; return castValue == null ? [] : (typeof castValue === "object" ? castValue : [castValue]); })())`;
                }
                if (node.type === "object") {
                    return `(await (async () => { const castValue = ${value}; return castValue == null ? {} : (typeof castValue === "object" ? castValue : { scalar: castValue }); })())`;
                }
                return `(${value}, null)`;
            }
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
                const dummyLines = [];
                const dummyLineMap = new Map();
                this.transpileNodeList(node.body?.children || node.body, dummyLines, dummyLineMap, null, filepath, 2, "{closure}");
                const paramSetup = params.map((p, idx) => {
                    return `ctx.setVar(${JSON.stringify(p.name)}, args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`;
                }).join("\n  ");
                const bodyCode = dummyLines.join("\n");
                return `(async function(ctx, ...args) {\n  ${paramSetup}\n${bodyCode}\n})`;
            }
            case "variable":
                if ((node.name?.name || node.name) === "this")
                    return "this";
                return `ctx.getVar(${JSON.stringify(node.name?.name || node.name)})`;
            case "assign": {
                const val = this.transpileExpr(node.right, filepath);
                if (node.left?.kind === "staticlookup") {
                    const className = this.transpileClassReference(node.left.what, filepath);
                    const property = JSON.stringify(this.getConstName(node.left.offset));
                    return `(await ctx.setStaticProperty(${className}, ${property}, ${val}))`;
                }
                if (node.left?.kind === "offsetlookup") {
                    let base = node.left;
                    const keys = [];
                    while (base.kind === "offsetlookup") {
                        keys.unshift(base.offset ? this.transpileExpr(base.offset, filepath) : "null");
                        base = base.what;
                    }
                    if (base.kind === "variable") {
                        return `(ctx.setVarOffsets(${JSON.stringify(base.name?.name || base.name)}, [${keys.join(", ")}], ${val}))`;
                    }
                    if (base.kind === "propertylookup") {
                        const obj = this.transpileExpr(base.what, filepath);
                        const prop = JSON.stringify(base.offset?.name || base.offset?.value || "prop");
                        return `(await ctx.setPropertyOffsets(${obj}, ${prop}, [${keys.join(", ")}], ${val}))`;
                    }
                    if (base.kind === "staticlookup") {
                        const className = this.transpileClassReference(base.what, filepath);
                        const prop = JSON.stringify(this.getConstName(base.offset));
                        return `(await ctx.setStaticPropertyOffsets(${className}, ${prop}, [${keys.join(", ")}], ${val}))`;
                    }
                }
                if (node.left?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.left.what, filepath);
                    const prop = JSON.stringify(node.left.offset?.name || node.left.offset?.value || node.left.offset || "prop");
                    return `(await ctx.setProperty(${obj}, ${prop}, ${val}))`;
                }
                const target = this.transpileTarget(node.left, filepath);
                if (target.startsWith("ctx.setVar(")) {
                    return target.replace(")", `, ${val})`);
                }
                return `(${target} = ${val})`;
            }
            case "assignref": {
                const target = node.left?.kind === "variable"
                    ? JSON.stringify(node.left.name?.name || node.left.name)
                    : JSON.stringify("tmp");
                return `(ctx.setVar(${target}, ${this.transpileExpr(node.right, filepath)}))`;
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
                return `(ctx.isTruthy(${test}) ? ${trueExpr} : ${falseExpr})`;
            }
            case "coalesce": {
                const left = this.transpileExpr(node.left, filepath);
                const right = this.transpileExpr(node.right, filepath);
                return `(${left} ?? ${right})`;
            }
            case "unary": {
                const val = this.transpileExpr(node.what, filepath);
                if (node.type === "!")
                    return `(!ctx.isTruthy(${val}))`;
                return `(${node.type}${val})`;
            }
            case "post": {
                const target = this.transpileTarget(node.what, filepath);
                const op = (node.type === "-" || node.type === 2 || node.type === "--") ? "--" : "++";
                if (node.what?.kind === "variable") {
                    const varName = JSON.stringify(node.what.name?.name || node.what.name);
                    return `((function(){let __t = (ctx.getVar(${varName}) || 0); ctx.setVar(${varName}, __t ${op === "++" ? "+ 1" : "- 1"}); return __t;})())`;
                }
                return `(${target}${op === "++" ? "++" : "--"})`;
            }
            case "pre": {
                const target = this.transpileTarget(node.what, filepath);
                const op = (node.type === "-" || node.type === 2 || node.type === "--") ? "--" : "++";
                if (node.what?.kind === "variable") {
                    const varName = JSON.stringify(node.what.name?.name || node.what.name);
                    return `ctx.setVar(${varName}, (ctx.getVar(${varName}) || 0) ${op === "++" ? "+ 1" : "- 1"})`;
                }
                return `(${op === "++" ? "++" : "--"}${target})`;
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
                const className = this.transpileClassReference(node.what, filepath);
                const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
                return `(await ctx.createObject(${className}, [${args.join(", ")}]))`;
            }
            case "bin":
            case "binary": {
                const left = this.transpileExpr(node.left, filepath);
                if (node.type === "<=>") {
                    const right = this.transpileExpr(node.right, filepath);
                    return `((${left} < ${right}) ? -1 : ((${left} > ${right}) ? 1 : 0))`;
                }
                if (node.type === "instanceof") {
                    const rightName = this.getConstName(node.right?.name || node.right);
                    return `ctx.isInstanceOf(${left}, ${JSON.stringify(rightName)})`;
                }
                const right = this.transpileExpr(node.right, filepath);
                if (node.type === "xor")
                    return `((ctx.isTruthy(${left}) ? 1 : 0) !== (ctx.isTruthy(${right}) ? 1 : 0))`;
                if (node.type === "and")
                    return `(ctx.isTruthy(${left}) && ctx.isTruthy(${right}))`;
                if (node.type === "or")
                    return `(ctx.isTruthy(${left}) || ctx.isTruthy(${right}))`;
                const op = node.type === "." ? "+" : node.type;
                return `(${left} ${op} ${right})`;
            }
            case "include": {
                const target = this.transpileExpr(node.target || node.expr || node.what, filepath);
                if (node.once) {
                    return node.require
                        ? `(await ctx.requireOnce(${target}))`
                        : `(await ctx.includeOnce(${target}))`;
                }
                else {
                    return node.require
                        ? `(await ctx.require(${target}))`
                        : `(await ctx.include(${target}))`;
                }
            }
            case "call": {
                if (node.what?.kind === "staticlookup") {
                    const className = this.transpileClassReference(node.what.what, filepath);
                    const method = JSON.stringify(node.what.offset?.name || node.what.offset?.value || node.what.offset || "method");
                    const args = (node.arguments || []).map((a) => this.transpileExpr(a, filepath));
                    if (node.what.what?.kind === "parentreference") {
                        return `(await ctx.callParentMethod(this, ${JSON.stringify(this.currentClassName)}, ${method}, [${args.join(", ")}]))`;
                    }
                    return `(await ctx.callStaticMethod(${className}, ${method}, [${args.join(", ")}]))`;
                }
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
                if (name.toLowerCase() === "str_replace" && node.arguments?.length >= 4 && node.arguments[3]?.kind === "variable") {
                    const countName = JSON.stringify(node.arguments[3].name?.name || node.arguments[3].name);
                    return `(await (async () => { const __result = await ctx.callFunction("str_replace", [${args.slice(0, 3).join(", ")}]); ctx.setVar(${countName}, ctx.getInternalVar("lastStrReplaceCount") || 0); return __result; })())`;
                }
                if (["preg_match", "preg_match_all"].includes(name.toLowerCase()) && node.arguments?.[2]?.kind === "variable") {
                    const matchesName = JSON.stringify(node.arguments[2].name?.name || node.arguments[2].name);
                    return `(await (async () => { const result = await ctx.callFunction(${JSON.stringify(name)}, [${args.join(", ")}]); ctx.setVar(${matchesName}, ctx.getInternalVar("lastPregMatches") || []); return result; })())`;
                }
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
            case "staticlookup": {
                const className = this.transpileClassReference(node.what, filepath);
                const member = this.getConstName(node.offset);
                if (member === "class" && node.offset?.kind !== "variable")
                    return className;
                const accessor = node.offset?.kind === "variable" ? "getStaticProperty" : "getClassConstant";
                return `(await ctx.${accessor}(${className}, ${JSON.stringify(member)}))`;
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
    transpileTarget(node, filepath) {
        if (!node)
            return "ctx.vars['tmp']";
        if (node.kind === "variable") {
            if ((node.name?.name || node.name) === "this")
                return "this";
            return `ctx.setVar(${JSON.stringify(node.name?.name || node.name)})`;
        }
        if (node.kind === "offsetlookup") {
            const target = this.transpileExpr(node.what, filepath);
            const key = node.offset ? this.transpileExpr(node.offset, filepath) : "0";
            return `${target}[${key}]`;
        }
        if (node.kind === "propertylookup") {
            const obj = this.transpileExpr(node.what, filepath);
            const prop = JSON.stringify(node.offset?.name || node.offset?.value || "prop");
            return `${obj}[${prop}]`;
        }
        return "ctx.vars['tmp']";
    }
}
exports.JSTranspiler = JSTranspiler;
function indentLevel(pad) {
    return pad.length / 2;
}
//# sourceMappingURL=JSTranspiler.js.map