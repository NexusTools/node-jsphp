import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { SourceMapGenerator } from "source-map";
import { PHPFatalError } from "../runtime/PHPError.js";
import { ASTOptimizer } from "./ASTOptimizer.js";
import engineParser from "php-parser";
export class JSTranspiler {
    parser;
    currentClassName = "";
    currentClassNameOriginal = "";
    currentFuncName = "";
    currentNamespaceName = "";
    currentNamespaceNameOriginal = "";
    classImports = new Map();
    classImportsOriginal = new Map();
    loopLabelCounter = 0;
    switchLabelCounter = 0;
    loopStack = [];
    constructor() {
        this.parser = new (engineParser.Engine || engineParser)({
            parser: {
                extractDoc: false,
                extractTokens: false,
                phpVersion: "8.1",
                suppressErrors: true,
            },
            lexer: {
                all_tokens: false,
                comment: false,
            },
            ast: {
                withPositions: true,
                withSource: false,
            },
        });
    }
    transpile(code, filepath = "eval", options = {}) {
        this.currentNamespaceName = "";
        this.currentNamespaceNameOriginal = "";
        this.currentClassName = "";
        this.currentClassNameOriginal = "";
        this.classImports.clear();
        this.classImportsOriginal.clear();
        const codeHash = crypto.createHash("sha1").update(code).digest("hex");
        const engineHash = options.engineSHA1 || "default";
        const cacheFileName = `${codeHash}_${engineHash}.js`;
        if (options.cacheDir) {
            const cachedFilePath = path.join(options.cacheDir, cacheFileName);
            if (fs.existsSync(cachedFilePath)) {
                try {
                    const cachedCode = fs.readFileSync(cachedFilePath, "utf8");
                    // console.log("CACHE HIT:", path.basename(filepath));
                    return { code: cachedCode };
                }
                catch {
                    // Ignore cache read error
                }
            }
        }
        if (process.env.JSPHP_DEBUG === "1")
            console.log("CACHE MISS:", path.basename(filepath));
        const codeToParse = code.includes("<?") ? code : "<?php\n" + code;
        let ast = this.parser.parseCode(codeToParse, filepath);
        let finalAst = ast;
        if (options.engine) {
            finalAst = ASTOptimizer.optimize(ast, options.engine);
        }
        const mapGen = options.sourceMap ? new SourceMapGenerator({ file: filepath }) : null;
        if (mapGen) {
            mapGen.setSourceContent(filepath, code);
        }
        const lines = [];
        const lineMap = new Map();
        const format = options.format || "cjs";
        if (format === "esm") {
            lines.push("export default async function(ctx) {");
        }
        else {
            lines.push("module.exports = async function(ctx) {");
        }
        lines.push("  if (ctx && typeof ctx.createContext === \"function\") ctx = ctx.createContext();");
        lines.push("  const _syms = ctx?.engine?.symbols || ctx?.symbols || {};");
        lines.push("  const PHPVariable = _syms.PHPVariable || (typeof arguments !== 'undefined' && arguments[2]);");
        lines.push("  const PHPLiteral = _syms.PHPLiteral || (typeof arguments !== 'undefined' && arguments[3]);");
        lines.push("  const PHPFatalError = _syms.PHPFatalError || (typeof arguments !== 'undefined' && arguments[4]);");
        lines.push("  const PHPError = _syms.PHPError || (typeof arguments !== 'undefined' && arguments[5]);");
        lines.push("  const SYMBOL_PHP_NAME = _syms.SYMBOL_PHP_NAME || (typeof arguments !== 'undefined' && arguments[6]);");
        lines.push("  const SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS = _syms.SYMBOL_PHP_CLASS_HAS_MAGIC_METHODS || (typeof arguments !== 'undefined' && arguments[7]);");
        lines.push("  const SYMBOL_PHP_CLASS_INTERFACES = _syms.SYMBOL_PHP_CLASS_INTERFACES || (typeof arguments !== 'undefined' && arguments[8]);");
        lines.push("  const PHPReference = _syms.PHPReference || (typeof arguments !== 'undefined' && arguments[9]);");
        lines.push("  const PHPInterface = _syms.PHPInterface || (typeof arguments !== 'undefined' && arguments[10]);");
        lines.push("  const PHPPropertyReference = _syms.PHPPropertyReference || (typeof arguments !== 'undefined' && arguments[11]);");
        lines.push("  const PHPArrayOffsetReference = _syms.PHPArrayOffsetReference || (typeof arguments !== 'undefined' && arguments[12]);");
        lines.push("  const PROXY_HANDLER = _syms.PROXY_HANDLER || (typeof arguments !== 'undefined' && arguments[13]);");
        lines.push("  try {");
        this.currentClassName = "";
        this.currentNamespaceName = "";
        this.classImports.clear();
        const bodyNodes = finalAst?.children || finalAst?.body || (Array.isArray(finalAst) ? finalAst : [finalAst]);
        for (const node of bodyNodes) {
            if (node?.kind === "use" || node?.kind === "usegroup") {
                for (const item of node.items || []) {
                    const name = this.getConstName(item.name || item);
                    const alias = item.alias ? this.getConstName(item.alias) : name.split("\\").pop() || name;
                    this.classImports.set(alias.toLowerCase(), name.toLowerCase());
                    this.classImportsOriginal.set(alias.toLowerCase(), name);
                }
            }
        }
        const topFuncs = this.collectFunctionsInNodes(bodyNodes);
        const registeredFuncs = new Set();
        for (const funcNode of topFuncs) {
            const funcName = (funcNode.name?.name || funcNode.name || "").toString().toLowerCase();
            if (registeredFuncs.has(funcName))
                continue;
            registeredFuncs.add(funcName);
            this.transpileFunctionNode(funcNode, lines, lineMap, mapGen, filepath, 4);
        }
        const scopeVars = this.collectVariablesInScope(bodyNodes);
        for (const vName of scopeVars) {
            if (vName === "this" || this.isSuperglobal(vName))
                continue;
            const safeId = vName.replace(/[^a-zA-Z0-9_]/g, "_");
            lines.push(`    let $v_${safeId};`);
        }
        this.transpileNodeList(bodyNodes, lines, lineMap, mapGen, filepath, 4, "{main}");
        lines.push("  } catch (err) {");
        lines.push("    throw err;");
        lines.push("  } finally {");
        lines.push("    ctx.outputBuffer.flushAll(ctx);");
        lines.push("  }");
        lines.push("};");
        let mapString;
        let fullCode = lines.join("\n");
        if (options.sourceMap) {
            mapString = mapGen.toString();
            const base64Map = Buffer.from(mapString).toString("base64");
            fullCode += `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map}`;
        }
        ast = null;
        finalAst = null;
        if (options.cacheDir) {
            try {
                fs.mkdirSync(options.cacheDir, { recursive: true });
                fs.writeFileSync(path.join(options.cacheDir, cacheFileName), fullCode, "utf8");
            }
            catch {
                // Ignore cache write error
            }
        }
        return {
            code: fullCode,
            map: mapString,
        };
    }
    collectFunctionsInNodes(nodes, result = []) {
        if (!Array.isArray(nodes))
            return result;
        for (const node of nodes) {
            if (!node || typeof node !== "object")
                continue;
            if (node.kind === "function") {
                result.push(node);
                continue;
            }
            if (node.kind === "class" || node.kind === "interface" || node.kind === "trait") {
                continue;
            }
            if (node.children) {
                this.collectFunctionsInNodes(node.children, result);
            }
            if (node.body) {
                this.collectFunctionsInNodes(Array.isArray(node.body) ? node.body : node.body.children || [node.body], result);
            }
            if (node.alternate) {
                this.collectFunctionsInNodes(Array.isArray(node.alternate) ? node.alternate : node.alternate.children || [node.alternate], result);
            }
        }
        return result;
    }
    transpileFunctionNode(node, lines, lineMap, mapGen, filepath, indent) {
        const pad = " ".repeat(indent);
        const originalFuncName = (node.name?.name || node.name || "").toString();
        const funcName = originalFuncName.toLowerCase();
        const safeFnId = funcName.replace(/[^a-zA-Z0-9_]/g, "_");
        const visibility = (node.visibility || "public").toString();
        const params = (node.arguments || []).map((a, idx) => {
            const pName = this.getConstName(a.name || a);
            const hasDefault = Boolean(a.value);
            const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
            return { name: pName, position: idx, byref: Boolean(a.byref || a.byRef), variadic: Boolean(a.variadic || a.isVariadic), isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
        });
        const requiredCount = params.filter((p) => !p.hasDefault).length;
        const isGen = this.containsYield(node.body?.children || node.body);
        lines.push(`${pad}async function${isGen ? "*" : ""} __fn_${safeFnId}(ctx, ...args) {`);
        lines.push(`${pad}  ctx.pushScope(args);`);
        lines.push(`${pad}  try {`);
        const scopeVars = this.collectVariablesInScope(node.body?.children || node.body);
        for (const p of params)
            scopeVars.add(p.name);
        for (const vName of scopeVars) {
            if (vName === "this" || this.isSuperglobal(vName))
                continue;
            const safeId = vName.replace(/[^a-zA-Z0-9_]/g, "_");
            lines.push(`${pad}    let $v_${safeId};`);
        }
        params.forEach((p, idx) => {
            const safeId = p.name.replace(/[^a-zA-Z0-9_]/g, "_");
            const vRef = `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(p.name)})))`;
            if (p.variadic) {
                lines.push(`${pad}    ${vRef}.set(args.slice(${idx}).map(a => a instanceof PHPReference ? a.get() : a));`);
            }
            else if (p.byref) {
                lines.push(`${pad}    if (args[${idx}] instanceof PHPReference) ${vRef}.bindRef(args[${idx}]); else ${vRef}.set(args[${idx}]);`);
            }
            else {
                lines.push(`${pad}    if (args[${idx}] instanceof PHPReference) ${vRef}.set(args[${idx}].get() !== undefined ? args[${idx}].get() : ${p.defaultValue}); else ${vRef}.set(args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
            }
        });
        const savedLoopStack = this.loopStack;
        const savedFuncName = this.currentFuncName;
        this.currentFuncName = funcName;
        this.loopStack = [];
        try {
            this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, funcName);
        }
        finally {
            this.loopStack = savedLoopStack;
            this.currentFuncName = savedFuncName;
        }
        lines.push(`${pad}  } finally {`);
        lines.push(`${pad}    ctx.popScope();`);
        lines.push(`${pad}  }`);
        lines.push(`${pad}};`);
        lines.push(`${pad}__fn_${safeFnId}.phpMeta = { name: ${JSON.stringify(originalFuncName)}, visibility: ${JSON.stringify(visibility)}, numberOfParameters: ${params.length}, numberOfRequiredParameters: ${requiredCount}, parameters: ${JSON.stringify(params)} };`);
        lines.push(`${pad}ctx.functions[${JSON.stringify(funcName)}] = __fn_${safeFnId};`);
    }
    transpileNodeList(nodes, lines, lineMap, mapGen, filepath, indent, currentFunc) {
        if (!nodes)
            return;
        const nodeList = Array.isArray(nodes) ? nodes : [nodes];
        for (const node of nodeList) {
            if (!node)
                continue;
            const startLine = lines.length + 1;
            this.transpileStmt(node, lines, lineMap, mapGen, filepath, indent);
            const endLine = lines.length;
            const phpLine = node.loc?.start?.line;
            if (phpLine && mapGen) {
                for (let l = startLine; l <= endLine; l++) {
                    mapGen.addMapping({
                        generated: { line: l, column: 0 },
                        original: { line: phpLine, column: 0 },
                        source: filepath,
                        name: currentFunc,
                    });
                }
            }
        }
    }
    transpileStmt(node, lines, lineMap, mapGen, filepath, indent) {
        const pad = " ".repeat(indent);
        if (!node || typeof node !== "object")
            return;
        switch (node.kind) {
            case "inline": {
                lines.push(`${pad}await ctx.echo(${JSON.stringify(node.value || node.raw)});`);
                break;
            }
            case "namespace": {
                this.currentNamespaceNameOriginal = this.getConstName(node.name || node.namespace || "");
                this.currentNamespaceName = this.currentNamespaceNameOriginal.toLowerCase();
                const children = node.children || node.body || [];
                this.transpileNodeList(children, lines, lineMap, mapGen, filepath, indent, "{main}");
                break;
            }
            case "usegroup": {
                for (const item of node.items || []) {
                    const importedName = this.getConstName(item.name || item);
                    const alias = this.getConstName(item.alias) || importedName.split("\\").pop();
                    this.classImports.set(alias.toLowerCase(), importedName.toLowerCase());
                    this.classImportsOriginal.set(alias.toLowerCase(), importedName);
                }
                break;
            }
            case "echo":
            case "print": {
                const expressions = (node.arguments || node.expressions || [node.value || node.expr]).map((e) => this.transpileExpr(e, filepath));
                lines.push(`${pad}await ctx.echo(${expressions.join(" + ")});`);
                break;
            }
            case "if": {
                const cond = this.transpileExpr(node.test, filepath);
                lines.push(`${pad}if (ctx.isTruthy(${cond})) {`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                if (node.alternate) {
                    if (node.alternate.kind === "if") {
                        lines.push(`${pad}} else`);
                        this.transpileStmt(node.alternate, lines, lineMap, mapGen, filepath, indent);
                    }
                    else {
                        lines.push(`${pad}} else {`);
                        this.transpileNodeList(node.alternate?.children || node.alternate, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                        lines.push(`${pad}}`);
                    }
                }
                else {
                    lines.push(`${pad}}`);
                }
                break;
            }
            case "while": {
                const label = `lp_${++this.loopLabelCounter}`;
                this.loopStack.push({ label, type: "loop" });
                try {
                    const cond = this.transpileExpr(node.test, filepath);
                    lines.push(`${pad}${label}: while (ctx.isTruthy(${cond})) {`);
                    lines.push(`${pad}  if (++ctx.tickCount > 2000) await ctx.checkLoop(${JSON.stringify(filepath)}, ${node.loc?.start?.line || 0});`);
                    this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                    lines.push(`${pad}}`);
                }
                finally {
                    this.loopStack.pop();
                }
                break;
            }
            case "do": {
                const label = `lp_${++this.loopLabelCounter}`;
                this.loopStack.push({ label, type: "loop" });
                try {
                    const cond = this.transpileExpr(node.test, filepath);
                    lines.push(`${pad}${label}: do {`);
                    lines.push(`${pad}  if (++ctx.tickCount > 2000) await ctx.checkLoop(${JSON.stringify(filepath)}, ${node.loc?.start?.line || 0});`);
                    this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                    lines.push(`${pad}} while (ctx.isTruthy(${cond}));`);
                }
                finally {
                    this.loopStack.pop();
                }
                break;
            }
            case "for": {
                const label = `lp_${++this.loopLabelCounter}`;
                this.loopStack.push({ label, type: "loop" });
                try {
                    const init = (node.init || []).map((e) => this.transpileExpr(e, filepath)).join(", ");
                    const test = (node.test || []).map((e) => this.transpileExpr(e, filepath)).join(" && ") || "true";
                    const increment = (node.increment || []).map((e) => this.transpileExpr(e, filepath)).join(", ");
                    if (init)
                        lines.push(`${pad}${init};`);
                    lines.push(`${pad}${label}: while (ctx.isTruthy(${test})) {`);
                    lines.push(`${pad}  if (++ctx.tickCount > 2000) await ctx.checkLoop(${JSON.stringify(filepath)}, ${node.loc?.start?.line || 0});`);
                    this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                    if (increment)
                        lines.push(`${pad}  ${increment};`);
                    lines.push(`${pad}}`);
                }
                finally {
                    this.loopStack.pop();
                }
                break;
            }
            case "foreach": {
                const label = `fe_${++this.loopLabelCounter}`;
                this.loopStack.push({ label, type: "loop" });
                try {
                    const source = this.transpileExpr(node.source || node.what || node.expr, filepath);
                    const keyNode = node.key;
                    let valNode = node.value;
                    let isByRefVal = false;
                    if (valNode?.kind === "byref" || valNode?.byref || valNode?.byRef) {
                        isByRefVal = true;
                        valNode = valNode.what || valNode.expr || valNode.value || valNode;
                    }
                    let setKeyLine = "";
                    if (keyNode) {
                        setKeyLine = (this.transpileExpr({ kind: "assign", left: keyNode, right: { kind: "raw", code: "__k" } }, filepath)) + ";";
                    }
                    let setValLine = "";
                    if (valNode) {
                        if (isByRefVal) {
                            setValLine = (this.transpileExpr({ kind: "assignref", left: valNode, right: { kind: "raw", code: `new PHPArrayOffsetReference(__src_val_${label}, __k)` } }, filepath)) + ";";
                        }
                        else {
                            setValLine = (this.transpileExpr({ kind: "assign", left: valNode, right: { kind: "raw", code: "__entry_val" } }, filepath)) + ";";
                        }
                    }
                    lines.push(`${pad}const __src_val_${label} = ${source};`);
                    lines.push(`${pad}const __src_${label} = __src_val_${label} instanceof PHPReference ? __src_val_${label}.get() : __src_val_${label};`);
                    lines.push(`${pad}const __entries_${label} = (typeof __src_${label} === "object" && __src_${label} !== null) ? Object.entries(__src_${label}) : [];`);
                    lines.push(`${pad}${label}: for (const [__raw_k, __entry_val] of __entries_${label}) {`);
                    lines.push(`${pad}  if (++ctx.tickCount > 2000) await ctx.checkLoop(${JSON.stringify(filepath)}, ${node.loc?.start?.line || 0});`);
                    lines.push(`${pad}  const __k = (!isNaN(Number(__raw_k)) && String(Number(__raw_k)) === String(__raw_k)) ? Number(__raw_k) : __raw_k;`);
                    if (setKeyLine)
                        lines.push(`${pad}  ${setKeyLine}`);
                    if (setValLine)
                        lines.push(`${pad}  ${setValLine}`);
                    this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                    lines.push(`${pad}}`);
                }
                finally {
                    this.loopStack.pop();
                }
                break;
            }
            case "switch": {
                const label = `sw_${++this.switchLabelCounter}`;
                this.loopStack.push({ label, type: "switch" });
                try {
                    const test = this.transpileExpr(node.test, filepath);
                    lines.push(`${pad}${label}: {`);
                    lines.push(`${pad}  const __sw = ${test};`);
                    lines.push(`${pad}  let __matched = false;`);
                    const caseNodes = node.body?.children || node.body || node.children || [];
                    for (const caseNode of caseNodes) {
                        if (caseNode.test) {
                            const caseVal = this.transpileExpr(caseNode.test, filepath);
                            lines.push(`${pad}  if (__matched || __sw == ${caseVal}) {`);
                            lines.push(`${pad}    __matched = true;`);
                        }
                        else {
                            lines.push(`${pad}  if (__matched || true) {`);
                            lines.push(`${pad}    __matched = true;`);
                        }
                        this.transpileNodeList(caseNode.body?.children || caseNode.body || caseNode.children || [], lines, lineMap, mapGen, filepath, indent + 4, "{main}");
                        lines.push(`${pad}  }`);
                    }
                    lines.push(`${pad}}`);
                }
                finally {
                    this.loopStack.pop();
                }
                break;
            }
            case "return": {
                const value = node.expr ? this.transpileExpr(node.expr, filepath) : "undefined";
                lines.push(`${pad}return ${value};`);
                break;
            }
            case "global": {
                for (const v of node.items || []) {
                    const varName = this.getConstName(v.name || v);
                    lines.push(`${pad}ctx.bindGlobal(${JSON.stringify(varName)});`);
                }
                break;
            }
            case "static": {
                const scopeKey = this.currentClassName ? `${this.currentClassName}::${this.currentFuncName}` : (this.currentFuncName || "{main}");
                for (const v of node.result || node.items || node.variables || []) {
                    const varName = this.getConstName(v.variable?.name || v.variable || v.name || v);
                    const valueNode = v.defaultValue || v.value;
                    const value = valueNode ? this.transpileExpr(valueNode, filepath) : "undefined";
                    lines.push(`${pad}ctx.initStaticVar(${JSON.stringify(scopeKey)}, ${JSON.stringify(varName)}, ${value});`);
                }
                break;
            }
            case "unset": {
                for (const v of node.variables || node.expressions || []) {
                    if (v.kind === "variable") {
                        const varName = this.getConstName(v.name || v);
                        const safeId = varName.replace(/[^a-zA-Z0-9_]/g, "_");
                        lines.push(`${pad}($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(varName)}))).set(undefined);`);
                    }
                    else if (v.kind === "offsetlookup") {
                        const offsets = [];
                        let current = v;
                        while (current?.kind === "offsetlookup") {
                            offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
                            current = current.what;
                        }
                        if (current?.kind === "propertylookup") {
                            const obj = this.transpileExpr(current.what, filepath);
                            const prop = this.transpilePropertyOffset(current.offset, filepath);
                            lines.push(`${pad}await ctx.unsetPropertyOffsets(${obj}, ${prop}, [${offsets.join(", ")}]);`);
                        }
                        else {
                            const varName = this.getConstName(current);
                            if (varName && typeof varName === "string") {
                                lines.push(`${pad}ctx.unsetVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]);`);
                            }
                            else {
                                const obj = this.transpileExpr(current, filepath);
                                lines.push(`${pad}if ((${obj}) !== undefined && (${obj}) !== null) { let __t = ${obj}; for (let i = 0; i < ${offsets.length} - 1; i++) { __t = __t[ [${offsets.join(", ")}][i] ]; if (!__t) break; } if (__t) delete __t[ [${offsets.join(", ")}][${offsets.length - 1}] ]; }`);
                            }
                        }
                    }
                }
                break;
            }
            case "try": {
                lines.push(`${pad}try {`);
                this.transpileNodeList(node.body?.children || node.body, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                lines.push(`${pad}} catch (__err) {`);
                lines.push(`${pad}  const __php_err = PHPError.wrapJSError(__err);`);
                for (const catchNode of node.catches || []) {
                    const catchVar = this.getConstName(catchNode.variable) || "e";
                    lines.push(`${pad}  ctx.setVar(${JSON.stringify(catchVar)}, __php_err);`);
                    this.transpileNodeList(catchNode.body?.children || catchNode.body, lines, lineMap, mapGen, filepath, indent + 4, "{main}");
                }
                if (node.always) {
                    lines.push(`${pad}} finally {`);
                    this.transpileNodeList(node.always?.children || node.always, lines, lineMap, mapGen, filepath, indent + 2, "{main}");
                }
                lines.push(`${pad}}`);
                break;
            }
            case "throw": {
                const expr = (node.expr || node.what) ? this.transpileExpr(node.expr || node.what, filepath) : "undefined";
                lines.push(`${pad}throw ${expr};`);
                break;
            }
            case "expressionstatement": {
                const expr = this.transpileExpr(node.expression || node.expr, filepath);
                lines.push(`${pad}${expr};`);
                break;
            }
            case "break": {
                let level = 1;
                if (node.level) {
                    const lvlVal = this.getConstName(node.level?.value || node.level);
                    if (lvlVal)
                        level = Number(lvlVal) || 1;
                }
                const target = this.loopStack[this.loopStack.length - level];
                if (target) {
                    lines.push(`${pad}break ${target.label};`);
                }
                else {
                    lines.push(`${pad}break;`);
                }
                break;
            }
            case "continue": {
                let level = 1;
                if (node.level) {
                    const lvlVal = this.getConstName(node.level?.value || node.level);
                    if (lvlVal)
                        level = Number(lvlVal) || 1;
                }
                let targetLabel;
                let count = 0;
                for (let i = this.loopStack.length - 1; i >= 0; i--) {
                    count++;
                    if (count === level) {
                        targetLabel = this.loopStack[i].label;
                        break;
                    }
                }
                if (targetLabel) {
                    lines.push(`${pad}continue ${targetLabel};`);
                }
                else {
                    lines.push(`${pad}continue;`);
                }
                break;
            }
            case "exit":
            case "die": {
                const statusNode = node.expression || node.status || node.expr || node.value;
                const status = statusNode ? this.transpileExpr(statusNode, filepath) : "0";
                lines.push(`${pad}await ctx.callFunction("exit", [${status}]);`);
                break;
            }
            case "label": {
                const labelName = this.getConstName(node.name || node.label) || "lbl";
                lines.push(`${pad}${labelName}: ;`);
                break;
            }
            case "goto": {
                const labelName = this.getConstName(node.label || node.name) || "lbl";
                lines.push(`${pad}/* goto ${labelName} */`);
                break;
            }
            case "declare":
            case "noop":
                break;
            case "usegroup":
            case "use": {
                for (const item of node.items || []) {
                    const name = this.getConstName(item.name || item);
                    const alias = item.alias ? this.getConstName(item.alias) : name.split("\\").pop() || name;
                    this.classImports.set(alias.toLowerCase(), name.toLowerCase());
                }
                break;
            }
            case "trait": {
                const name = (node.name?.name || node.name || "").toString();
                const safeId = name.replace(/[^a-zA-Z0-9_]/g, "_");
                const originalName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${name}` : (this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name);
                const qualifiedName = originalName.toLowerCase();
                lines.push(`${pad}if (Object.hasOwn(ctx.classes, ${JSON.stringify(qualifiedName)})) throw new PHPFatalError(\`Cannot declare trait ${originalName}, because the name is already in use\`);`);
                break;
            }
            case "interface": {
                const name = (node.name?.name || node.name || "").toString();
                const safeId = name.replace(/[^a-zA-Z0-9_]/g, "_");
                const originalName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${name}` : (this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name);
                const qualifiedName = originalName.toLowerCase();
                const previousClassName = this.currentClassName;
                const previousClassNameOriginal = this.currentClassNameOriginal;
                this.currentClassName = qualifiedName;
                this.currentClassNameOriginal = originalName;
                try {
                    lines.push(`${pad}if (Object.hasOwn(ctx.classes, ${JSON.stringify(qualifiedName)}) || Object.hasOwn(ctx.interfaces, ${JSON.stringify(qualifiedName)})) throw new PHPFatalError(\`Cannot declare interface ${originalName}, because the name is already in use\`);`);
                    const extendsList = Array.isArray(node.extends) ? node.extends : (node.extends ? [node.extends] : []);
                    const parentIfaces = extendsList.map((ext) => {
                        const extName = this.transpileClassReferenceLower(ext, filepath);
                        const extOrig = this.transpileClassReferenceOriginal(ext, filepath);
                        return `(ctx.interfaces[${extName}] || ctx.classes[${extName}] || (await ctx.resolveMissingClass(${extName}, ${extOrig})))`;
                    });
                    const bodyItems = Array.isArray(node.body)
                        ? node.body
                        : Array.isArray(node.body?.children)
                            ? node.body.children
                            : Array.isArray(node.body?.body)
                                ? node.body.body
                                : Array.isArray(node.children)
                                    ? node.children
                                    : (node.body ? [node.body] : []);
                    lines.push(`${pad}var __iface_${safeId} = new PHPInterface(${JSON.stringify(originalName)}, [${parentIfaces.join(", ")}]);`);
                    lines.push(`${pad}ctx.interfaces[${JSON.stringify(qualifiedName)}] = __iface_${safeId};`);
                    lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedName)}] = __iface_${safeId};`);
                    lines.push(`${pad}__iface_${safeId}.__php_constants = new Map();`);
                    for (const constant of this.orderClassConstants(bodyItems, qualifiedName, filepath)) {
                        const name = this.getConstName(constant.name).toLowerCase();
                        const val = this.transpileExpr(constant.value, filepath);
                        lines.push(`${pad}__iface_${safeId}.__php_constants.set(${JSON.stringify(name)}, ${val});`);
                    }
                }
                finally {
                    this.currentClassName = previousClassName;
                    this.currentClassNameOriginal = previousClassNameOriginal;
                }
                break;
            }
            case "function": {
                break;
            }
            case "class": {
                const className = (node.name?.name || node.name || "AnonymousClass").toString();
                const safeClassId = className.replace(/[^a-zA-Z0-9_]/g, "_");
                const originalClassName = this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${className}` : (this.currentNamespaceName ? `${this.currentNamespaceName}\\${className}` : className);
                const qualifiedClassName = originalClassName.toLowerCase();
                const previousClassName = this.currentClassName;
                const previousClassNameOriginal = this.currentClassNameOriginal;
                this.currentClassName = qualifiedClassName;
                this.currentClassNameOriginal = originalClassName;
                const parentClass = node.extends ? `(await ctx.resolveClass(${this.transpileClassReferenceLower(node.extends, filepath)}, ${this.transpileClassReferenceOriginal(node.extends, filepath)}))` : "undefined";
                lines.push(`${pad}if (Object.hasOwn(ctx.classes, ${JSON.stringify(qualifiedClassName)})) throw new PHPFatalError(\`Cannot declare class ${originalClassName}, because the name is already in use\`);`);
                const bodyItems = Array.isArray(node.body)
                    ? node.body
                    : Array.isArray(node.body?.children)
                        ? node.body.children
                        : Array.isArray(node.body?.body)
                            ? node.body.body
                            : Array.isArray(node.children)
                                ? node.children
                                : (node.body ? [node.body] : []);
                const isChildClass = node.extends;
                if (isChildClass) {
                    lines.push(`${pad}const __parent_${safeClassId} = ${parentClass};`);
                    lines.push(`${pad}class __cls_${safeClassId} extends __parent_${safeClassId} {`);
                }
                else {
                    lines.push(`${pad}class __cls_${safeClassId} {`);
                }
                let hasConstruct = false;
                const hasExplicitConstruct = bodyItems.some((item) => item?.kind === "method" && (item.name?.name || item.name || "").toString().toLowerCase() === "__construct");
                for (const item of bodyItems) {
                    if (item?.kind === "classconstant")
                        continue;
                    if (item?.kind === "propertystatement") {
                        for (const property of item.properties || []) {
                            const rawName = property.name?.name || property.name;
                            const propName = rawName.startsWith("$") ? rawName : "$" + rawName;
                            if (item.isStatic) {
                                lines.push(`${pad}  static ${propName};`);
                            }
                            else {
                                lines.push(`${pad}  ${propName};`);
                            }
                        }
                    }
                    else if (item?.kind === "method") {
                        const mName = (item.name?.name || item.name || "").toString();
                        const safeMId = mName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
                        const isStatic = Boolean(item.isStatic);
                        const isGen = this.containsYield(item.body?.children || item.body);
                        const isConstructName = mName.toLowerCase() === "__construct" || (!hasExplicitConstruct && mName.toLowerCase() === className.toLowerCase());
                        if (isConstructName) {
                            hasConstruct = true;
                            lines.push(`${pad}  ${isStatic ? "static " : ""}async ${isGen ? "*" : ""}__construct(ctx, ...args) {`);
                        }
                        else {
                            lines.push(`${pad}  ${isStatic ? "static " : ""}async ${isGen ? "*" : ""}${safeMId}(ctx, ...args) {`);
                        }
                        lines.push(`${pad}    ctx.pushScope(args);`);
                        lines.push(`${pad}    try {`);
                        const params = (item.arguments || []).map((a, idx) => {
                            const pName = this.getConstName(a.name || a);
                            const hasDefault = Boolean(a.value);
                            const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
                            return { name: pName, position: idx, byref: Boolean(a.byref || a.byRef), variadic: Boolean(a.variadic || a.isVariadic), isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
                        });
                        const scopeVars = this.collectVariablesInScope(item.body?.children || item.body);
                        for (const p of params)
                            scopeVars.add(p.name);
                        for (const vName of scopeVars) {
                            if (vName === "this" || this.isSuperglobal(vName))
                                continue;
                            const safeId = vName.replace(/[^a-zA-Z0-9_]/g, "_");
                            lines.push(`${pad}      let $v_${safeId};`);
                        }
                        params.forEach((p, idx) => {
                            const safeId = p.name.replace(/[^a-zA-Z0-9_]/g, "_");
                            const vRef = `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(p.name)})))`;
                            if (p.variadic) {
                                lines.push(`${pad}      ${vRef}.set(args.slice(${idx}).map(a => a instanceof PHPReference ? a.get() : a));`);
                            }
                            else if (p.byref) {
                                lines.push(`${pad}      if (args[${idx}] instanceof PHPReference) ${vRef}.bindRef(args[${idx}]); else ${vRef}.set(args[${idx}]);`);
                            }
                            else {
                                lines.push(`${pad}      if (args[${idx}] instanceof PHPReference) ${vRef}.set(args[${idx}].get() !== undefined ? args[${idx}].get() : ${p.defaultValue}); else ${vRef}.set(args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`);
                            }
                        });
                        const savedLoopStack = this.loopStack;
                        const savedFuncName = this.currentFuncName;
                        this.currentFuncName = `${this.currentClassName}::${mName}`;
                        this.loopStack = [];
                        try {
                            this.transpileNodeList(item.body?.children || item.body, lines, lineMap, mapGen, filepath, indent + 6, mName);
                        }
                        finally {
                            this.loopStack = savedLoopStack;
                            this.currentFuncName = savedFuncName;
                        }
                        lines.push(`${pad}    } finally {`);
                        lines.push(`${pad}      ctx.popScope();`);
                        lines.push(`${pad}    }`);
                        lines.push(`${pad}  }`);
                    }
                }
                const selfHasMagic = bodyItems.some((item) => {
                    if (item?.kind !== "method")
                        return false;
                    const m = (item.name?.name || item.name || "").toString().toLowerCase();
                    return m === "__get" || m === "__set" || m === "__call";
                });
                lines.push(`${pad}  static async __$$__new(ctx, ...args) {`);
                lines.push(`${pad}    const instance = Object.create(this.prototype);`);
                lines.push(`${pad}    Object.defineProperty(instance, "__ctx", { value: ctx, writable: true, configurable: true, enumerable: false });`);
                lines.push(`${pad}    await this.__$$__init(ctx, instance);`);
                lines.push(`${pad}    if (this.prototype[SYMBOL_PHP_HAS_MAGIC_METHODS]) {`);
                lines.push(`${pad}      const proxy = new Proxy(instance, PROXY_HANDLER);`);
                lines.push(`${pad}      if (typeof instance.__construct === "function") await instance.__construct(ctx, ...args);`);
                lines.push(`${pad}      return proxy;`);
                lines.push(`${pad}    }`);
                lines.push(`${pad}    if (typeof instance.__construct === "function") await instance.__construct(ctx, ...args);`);
                lines.push(`${pad}    return instance;`);
                lines.push(`${pad}  }`);
                lines.push(`${pad}  static async __$$__init(ctx, obj) {`);
                if (isChildClass) {
                    lines.push(`${pad}    if (typeof __parent_${safeClassId}.__$$__init === "function") await __parent_${safeClassId}.__$$__init(ctx, obj);`);
                }
                for (const item of bodyItems) {
                    if (item?.kind === "propertystatement" && !item.isStatic) {
                        for (const property of item.properties || []) {
                            const rawName = property.name?.name || property.name;
                            const propName = rawName.startsWith("$") ? rawName : "$" + rawName;
                            const value = property.value ? this.transpileExpr(property.value, filepath) : "undefined";
                            lines.push(`${pad}    obj[${JSON.stringify(propName)}] = new PHPVariable(${value});`);
                        }
                    }
                }
                lines.push(`${pad}  }`);
                lines.push(`${pad}}`);
                lines.push(`${pad}__cls_${safeClassId}[SYMBOL_PHP_NAME] = ${JSON.stringify(originalClassName)};`);
                lines.push(`${pad}__cls_${safeClassId}.prototype[SYMBOL_PHP_NAME] = ${JSON.stringify(originalClassName)};`);
                lines.push(`${pad}__cls_${safeClassId}.__php_parent = ${isChildClass ? `__parent_${safeClassId}` : "null"};`);
                lines.push(`${pad}__cls_${safeClassId}.__php_properties = new Map();`);
                for (const item of bodyItems) {
                    if (item?.kind === "propertystatement") {
                        const vis = item.visibility || "public";
                        const isStat = Boolean(item.isStatic);
                        for (const property of item.properties || []) {
                            const rawName = property.name?.name || property.name;
                            const propName = rawName.startsWith("$") ? rawName.slice(1) : rawName;
                            lines.push(`${pad}__cls_${safeClassId}.__php_properties.set(${JSON.stringify(propName)}, { visibility: ${JSON.stringify(vis)}, isStatic: ${isStat} });`);
                        }
                    }
                }
                if (selfHasMagic) {
                    lines.push(`${pad}__cls_${safeClassId}.prototype[SYMBOL_PHP_HAS_MAGIC_METHODS] = true;`);
                }
                lines.push(`${pad}ctx.classes[${JSON.stringify(qualifiedClassName)}] = __cls_${safeClassId};`);
                const implList = Array.isArray(node.implements) ? node.implements : (node.implements ? [node.implements] : []);
                if (implList.length > 0) {
                    const implIfaces = implList.map((impl) => {
                        const implName = this.transpileClassReferenceLower(impl, filepath);
                        const implOrig = this.transpileClassReferenceOriginal(impl, filepath);
                        return `(ctx.interfaces[${implName}] || ctx.classes[${implName}] || (await ctx.resolveMissingClass(${implName}, ${implOrig})))`;
                    });
                    lines.push(`${pad}__cls_${safeClassId}[SYMBOL_PHP_CLASS_INTERFACES] = [${implIfaces.join(", ")}];`);
                    lines.push(`${pad}__cls_${safeClassId}.prototype[SYMBOL_PHP_CLASS_INTERFACES] = __cls_${safeClassId}[SYMBOL_PHP_CLASS_INTERFACES];`);
                }
                // Initialize constants
                lines.push(`${pad}__cls_${safeClassId}.__php_constants = new Map();`);
                for (const constant of this.orderClassConstants(bodyItems, qualifiedClassName, filepath)) {
                    const name = this.getConstName(constant.name).toLowerCase();
                    lines.push(`${pad}__cls_${safeClassId}.__php_constants.set(${JSON.stringify(name)}, ${this.transpileExpr(constant.value, filepath)});`);
                }
                // Initialize static properties
                for (const item of bodyItems) {
                    if (item?.kind === "propertystatement" && item.isStatic) {
                        for (const property of item.properties || []) {
                            const rawName = property.name?.name || property.name;
                            const propName = rawName.startsWith("$") ? rawName : "$" + rawName;
                            const value = property.value ? this.transpileExpr(property.value, filepath) : "undefined";
                            lines.push(`${pad}__cls_${safeClassId}[${JSON.stringify(propName)}] = new PHPVariable(${value});`);
                        }
                    }
                }
                this.currentClassName = previousClassName;
                break;
            }
            default: {
                const expr = this.transpileExpr(node, filepath);
                lines.push(`${pad}${expr};`);
                break;
            }
        }
    }
    containsYield(node) {
        if (!node || typeof node !== "object")
            return false;
        if (node.kind === "yield" || node.kind === "yieldfrom")
            return true;
        if (node.kind === "function" || node.kind === "closure" || node.kind === "arrowfunc")
            return false;
        for (const key of Object.keys(node)) {
            if (key === "loc" || key === "comments" || key === "parent")
                continue;
            const child = node[key];
            if (Array.isArray(child)) {
                for (const c of child)
                    if (this.containsYield(c))
                        return true;
            }
            else if (child && typeof child === "object") {
                if (this.containsYield(child))
                    return true;
            }
        }
        return false;
    }
    orderClassConstants(body, className, filepath) {
        const constants = new Map();
        for (const item of body) {
            if (item?.kind !== "classconstant")
                continue;
            for (const constant of item.constants || [])
                constants.set(this.getConstName(constant.name).toLowerCase(), constant);
        }
        const visited = new Set();
        const pending = new Set();
        const ordered = [];
        const visit = (name) => {
            if (visited.has(name) || !constants.has(name))
                return;
            if (pending.has(name))
                throw new PHPFatalError(`Cannot declare constant ${className}::${name} with self-referencing constant`);
            pending.add(name);
            const constant = constants.get(name);
            const visitValue = (value) => {
                if (!value || typeof value !== "object")
                    return;
                if (value.kind === "staticlookup" && value.offset && this.transpileClassReference(value.what, filepath) === JSON.stringify(className)) {
                    visit(this.getConstName(value.offset).toLowerCase());
                }
                for (const key of Object.keys(value)) {
                    if (key !== "loc" && typeof value[key] === "object")
                        visitValue(value[key]);
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
    transpileCallArgs(args, filepath) {
        return (args || []).map((a) => {
            let inner = a;
            while (inner?.kind === "parenthesis" || inner?.kind === "parentheses")
                inner = inner.inner || inner.expr;
            if (inner?.kind === "variadic" || a?.kind === "variadic") {
                const innerNode = inner?.what || inner?.value || inner?.expr || a?.what || a?.value || a?.expr;
                const val = innerNode ? this.transpileExpr(innerNode, filepath) : "[]";
                return `...(${val} || [])`;
            }
            if (inner?.kind === "variable") {
                const vName = this.getConstName(inner.name || inner);
                if (!this.isSuperglobal(vName) && vName !== "this") {
                    const safeId = vName.replace(/[^a-zA-Z0-9_]/g, "_");
                    return `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(vName)})))`;
                }
            }
            if (inner?.kind === "propertylookup") {
                return `new PHPPropertyReference(ctx, ${this.transpileExpr(inner.what, filepath)}, ${this.transpilePropertyOffset(inner.offset, filepath)})`;
            }
            const expr = this.transpileExpr(a, filepath);
            return `((${expr}) instanceof PHPReference ? (${expr}) : new PHPLiteral(${expr}))`;
        });
    }
    collectVariablesInScope(nodes) {
        const vars = new Set();
        if (!nodes)
            return vars;
        const list = Array.isArray(nodes) ? nodes : [nodes];
        const visit = (node) => {
            if (!node || typeof node !== "object")
                return;
            if (node.kind === "variable") {
                const vName = this.getConstName(node.name || node);
                if (vName && typeof vName === "string")
                    vars.add(vName);
            }
            if (node.kind === "function" || node.kind === "method" || node.kind === "closure" || node.kind === "arrowfunc" || node.kind === "class")
                return;
            if (node.children)
                visit(node.children);
            if (node.body)
                visit(node.body);
            if (node.expr)
                visit(node.expr);
            if (node.expression)
                visit(node.expression);
            if (node.expressions)
                visit(node.expressions);
            if (node.what)
                visit(node.what);
            if (node.offset)
                visit(node.offset);
            if (node.left)
                visit(node.left);
            if (node.right)
                visit(node.right);
            if (node.test)
                visit(node.test);
            if (node.init)
                visit(node.init);
            if (node.increment)
                visit(node.increment);
            if (node.alternate)
                visit(node.alternate);
            if (node.source)
                visit(node.source);
            if (node.value)
                visit(node.value);
            if (node.key)
                visit(node.key);
            if (node.arguments)
                visit(node.arguments);
            if (node.items)
                visit(node.items);
            if (node.catches)
                visit(node.catches);
            if (node.always)
                visit(node.always);
            if (Array.isArray(node)) {
                for (const item of node)
                    visit(item);
            }
        };
        for (const item of list)
            visit(item);
        return vars;
    }
    static SUPERGLOBALS = new Set(["GLOBALS", "_GET", "_POST", "_SERVER", "_COOKIE", "_FILES", "_ENV", "_REQUEST", "_SESSION"]);
    isSuperglobal(name) {
        return JSTranspiler.SUPERGLOBALS.has(name);
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
    transpilePropertyOffset(offset, filepath) {
        if (!offset)
            return '"prop"';
        if (offset.kind === "variable" || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref")) {
            return `(String(${this.transpileExpr(offset, filepath)}).startsWith("$") ? String(${this.transpileExpr(offset, filepath)}) : "$" + String(${this.transpileExpr(offset, filepath)}))`;
        }
        const propName = this.getConstName(offset);
        if (propName.startsWith("$"))
            return JSON.stringify(propName);
        return JSON.stringify("$" + propName);
    }
    transpileListAssignItem(targetNode, valExpr, filepath) {
        if (!targetNode || targetNode.kind === "noop")
            return "";
        let node = targetNode;
        while (node?.kind === "parenthesis" || node?.kind === "parentheses") {
            node = node.inner || node.expr || node.value || node.what;
        }
        if (!node || node.kind === "noop")
            return "";
        if (node.kind === "variable") {
            const varName = this.getConstName(node.name || node);
            if (this.isSuperglobal(varName)) {
                return `await ctx.setVar(${JSON.stringify(varName)}, ${valExpr})`;
            }
            const safeId = varName.replace(/[^a-zA-Z0-9_]/g, "_");
            return `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(varName)}))).set(${valExpr})`;
        }
        if (node.kind === "propertylookup") {
            const obj = this.transpileExpr(node.what, filepath);
            const prop = this.transpilePropertyOffset(node.offset, filepath);
            return `await ctx.setProperty(${obj}, ${prop}, ${valExpr})`;
        }
        if (node.kind === "offsetlookup") {
            const arr = this.transpileExpr(node.what, filepath);
            const offset = node.offset ? this.transpileExpr(node.offset, filepath) : "null";
            return `await ctx.setArrayElement(${arr}, ${offset}, ${valExpr})`;
        }
        if (node.kind === "list" || node.kind === "array") {
            return this.transpileListAssign(node, valExpr, filepath);
        }
        return "";
    }
    transpileListAssign(listNode, rightValExpr, filepath) {
        const items = listNode.items || listNode.arguments || listNode.value || [];
        const assigns = items.map((item, idx) => {
            if (!item || item.kind === "noop")
                return "";
            let keyExpr = String(idx);
            let targetNode = item;
            if (item.kind === "entry") {
                targetNode = item.value;
                if (item.key) {
                    keyExpr = this.transpileExpr(item.key, filepath);
                }
            }
            if (!targetNode || targetNode.kind === "noop")
                return "";
            const itemValExpr = `(__list !== null && __list !== undefined ? (Array.isArray(__list) ? __list[${keyExpr}] : (typeof __list === "object" ? __list[${keyExpr}] : undefined)) : undefined) ?? null`;
            return this.transpileListAssignItem(targetNode, itemValExpr, filepath);
        }).filter(Boolean);
        return `(await (async () => { const __list = ${rightValExpr}; ${assigns.join("; ")}; return __list; })())`;
    }
    transpileMethodOffset(offset, filepath) {
        if (!offset)
            return '"method"';
        if (offset.kind === "variable" || (typeof offset === "object" && offset.kind && offset.kind !== "identifier" && offset.kind !== "constref")) {
            return `String(${this.transpileExpr(offset, filepath)}).toLowerCase()`;
        }
        return JSON.stringify(this.getConstName(offset).toLowerCase());
    }
    transpileClassReferenceLower(node, filepath) {
        if (node?.kind === "variable")
            return `String(${this.transpileExpr(node, filepath)}).toLowerCase()`;
        const name = this.getConstName(node);
        if (node?.kind === "selfreference" || name.toLowerCase() === "self")
            return JSON.stringify(this.currentClassName.toLowerCase());
        if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
            return `(this?.[SYMBOL_PHP_NAME] || this?.constructor?.[SYMBOL_PHP_NAME] || ${JSON.stringify(this.currentClassName.toLowerCase())}).toLowerCase()`;
        }
        if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
            return `((await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).__php_parent?.[SYMBOL_PHP_NAME] || (await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).__php_parent?.name || "Object").toLowerCase()`;
        }
        if (name.startsWith("\\") || node?.resolution === "fqn")
            return JSON.stringify(name.replace(/^\\/, "").toLowerCase());
        const parts = name.split("\\");
        const importedName = this.classImports.get(parts[0].toLowerCase());
        if (importedName)
            return JSON.stringify([importedName, ...parts.slice(1)].join("\\").toLowerCase());
        return JSON.stringify((this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name).toLowerCase());
    }
    transpileClassReferenceOriginal(node, filepath) {
        if (node?.kind === "variable")
            return `String(${this.transpileExpr(node, filepath)})`;
        const name = this.getConstName(node);
        if (node?.kind === "selfreference" || name.toLowerCase() === "self")
            return JSON.stringify(this.currentClassNameOriginal || this.currentClassName);
        if (node?.kind === "staticreference" || name.toLowerCase() === "static") {
            return `(this?.[SYMBOL_PHP_NAME] || this?.constructor?.[SYMBOL_PHP_NAME] || ${JSON.stringify(this.currentClassNameOriginal || this.currentClassName)})`;
        }
        if (node?.kind === "parentreference" || name.toLowerCase() === "parent") {
            return `((await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).__php_parent?.[SYMBOL_PHP_NAME] || (await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).__php_parent?.name || "Object")`;
        }
        if (name.startsWith("\\") || node?.resolution === "fqn")
            return JSON.stringify(name.replace(/^\\/, ""));
        const parts = name.split("\\");
        const importedName = this.classImportsOriginal.get(parts[0].toLowerCase()) || this.classImports.get(parts[0].toLowerCase());
        if (importedName)
            return JSON.stringify([importedName, ...parts.slice(1)].join("\\"));
        return JSON.stringify(this.currentNamespaceNameOriginal ? `${this.currentNamespaceNameOriginal}\\${name}` : (this.currentNamespaceName ? `${this.currentNamespaceName}\\${name}` : name));
    }
    transpileClassReference(node, filepath) {
        return this.transpileClassReferenceLower(node, filepath);
    }
    transpileExpr(node, filepath = "eval") {
        if (!node || typeof node !== "object")
            return "undefined";
        switch (node.kind) {
            case "string":
                return JSON.stringify(node.value);
            case "number": {
                const raw = String(node.value ?? "0");
                if (/^0[0-7]+$/.test(raw))
                    return "0o" + raw.slice(1);
                return raw;
            }
            case "boolean":
                return String(node.value);
            case "null":
            case "nil":
                return "null";
            case "magic": {
                const m = (node.value || node.name || "").toString().toUpperCase();
                if (m === "__DIR__")
                    return JSON.stringify(path.dirname(filepath));
                if (m === "__FILE__")
                    return JSON.stringify(filepath);
                if (m === "__LINE__")
                    return String(node.loc?.start?.line || 1);
                if (m === "__CLASS__")
                    return JSON.stringify(this.currentClassNameOriginal);
                if (m === "__METHOD__")
                    return JSON.stringify(this.currentClassNameOriginal ? `${this.currentClassNameOriginal}::${this.currentFuncName}` : this.currentFuncName);
                if (m === "__FUNCTION__")
                    return JSON.stringify(this.currentFuncName);
                if (m === "__NAMESPACE__")
                    return JSON.stringify(this.currentNamespaceNameOriginal);
                return JSON.stringify(m);
            }
            case "name":
            case "constref": {
                const rawName = this.getConstName(node.name || node);
                const upper = rawName.toUpperCase();
                if (upper === "TRUE")
                    return "true";
                if (upper === "FALSE")
                    return "false";
                if (upper === "NULL")
                    return "null";
                if (upper === "__DIR__")
                    return JSON.stringify(path.dirname(filepath));
                if (upper === "__FILE__")
                    return JSON.stringify(filepath);
                if (upper === "SELF" || upper === "STATIC")
                    return `(ctx.currentClassName || ${JSON.stringify(this.currentClassName ? this.currentClassName.toLowerCase() : "")})`;
                if (upper === "PARENT")
                    return `ctx.currentParentClassName`;
                if (upper === "__LINE__")
                    return String(node.loc?.start?.line || 1);
                if (upper === "__CLASS__")
                    return JSON.stringify(this.currentClassNameOriginal);
                if (upper === "__METHOD__")
                    return JSON.stringify(this.currentClassNameOriginal ? `${this.currentClassNameOriginal}::${this.currentFuncName}` : this.currentFuncName);
                if (upper === "__FUNCTION__")
                    return JSON.stringify(this.currentFuncName);
                if (upper === "__NAMESPACE__")
                    return JSON.stringify(this.currentNamespaceNameOriginal);
                const constName = rawName.toLowerCase();
                return `(ctx.constants[${JSON.stringify(constName)}] ?? ${JSON.stringify(rawName)})`;
            }
            case "closure":
            case "arrowfunc": {
                const params = (node.arguments || []).map((a, idx) => {
                    const pName = this.getConstName(a.name || a);
                    const hasDefault = Boolean(a.value);
                    const defaultVal = a.value ? this.transpileExpr(a.value, filepath) : "undefined";
                    const byref = Boolean(a.byref || a.byRef);
                    const variadic = Boolean(a.variadic || a.isVariadic);
                    return { name: pName, position: idx, byref, variadic, isOptional: hasDefault, hasDefault, defaultValue: defaultVal };
                });
                const scopeVars = this.collectVariablesInScope(node.body?.children || node.body);
                for (const p of params)
                    scopeVars.add(p.name);
                for (const useItem of node.uses || []) {
                    const uName = (useItem.name?.name || useItem.name || "").toString();
                    if (uName)
                        scopeVars.add(uName);
                }
                const varDeclLines = [];
                for (const vName of scopeVars) {
                    if (vName === "this" || this.isSuperglobal(vName))
                        continue;
                    const safeId = vName.replace(/[^a-zA-Z0-9_]/g, "_");
                    varDeclLines.push(`let $v_${safeId};`);
                }
                const paramBindLines = params.map((p, idx) => {
                    const safeId = p.name.replace(/[^a-zA-Z0-9_]/g, "_");
                    const vRef = `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(p.name)})))`;
                    if (p.variadic) {
                        return `${vRef}.set(args.slice(${idx}).map(a => a instanceof PHPReference ? a.get() : a));`;
                    }
                    if (p.byref) {
                        return `if (args[${idx}] instanceof PHPReference) ${vRef}.bindRef(args[${idx}]); else ${vRef}.set(args[${idx}]);`;
                    }
                    return `if (args[${idx}] instanceof PHPReference) ${vRef}.set(args[${idx}].get()); else ${vRef}.set(args[${idx}] !== undefined ? args[${idx}] : ${p.defaultValue});`;
                });
                const dummyLines = [];
                const dummyLineMap = new Map();
                const savedLoopStack = this.loopStack;
                this.loopStack = [];
                try {
                    this.transpileNodeList(node.body?.children || node.body, dummyLines, dummyLineMap, null, filepath, 12, "closure");
                }
                finally {
                    this.loopStack = savedLoopStack;
                }
                const isGen = this.containsYield(node.body?.children || node.body);
                return `(async function${isGen ? "*" : ""} (ctx, ...args) {
          ctx.pushScope(args);
          try {
            ${varDeclLines.join("\n            ")}
            ${paramBindLines.join("\n            ")}
${dummyLines.join("\n")}
          } finally {
            ctx.popScope();
          }
        })`;
            }
            case "variable": {
                const varName = this.getConstName(node.name || node);
                if (varName === "this")
                    return "this";
                if (this.isSuperglobal(varName))
                    return `ctx.getVar(${JSON.stringify(varName)})`;
                const safeId = varName.replace(/[^a-zA-Z0-9_]/g, "_");
                return `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(varName)}))).get()`;
            }
            case "assignref":
            case "assign": {
                let leftNode = node.left;
                while (leftNode?.kind === "parenthesis" || leftNode?.kind === "parentheses") {
                    leftNode = leftNode.inner || leftNode.expr || leftNode.value || leftNode.what;
                }
                if (leftNode?.kind === "list" || (leftNode?.kind === "array" && node.operator === "=")) {
                    const rightVal = this.transpileExpr(node.right, filepath);
                    return this.transpileListAssign(leftNode, rightVal, filepath);
                }
                const val = this.transpileExpr(node.right, filepath);
                const op = node.operator || "=";
                const isByRef = node.kind === "assignref" || node.byRef || node.byref || node.right?.kind === "byref";
                if (leftNode?.kind === "variable") {
                    const varName = this.getConstName(leftNode.name || leftNode);
                    if (this.isSuperglobal(varName)) {
                        if (op === "+=")
                            return `ctx.setVar(${JSON.stringify(varName)}, (Number(ctx.getVar(${JSON.stringify(varName)})) || 0) + Number(${val}))`;
                        if (op === "-=")
                            return `ctx.setVar(${JSON.stringify(varName)}, (Number(ctx.getVar(${JSON.stringify(varName)})) || 0) - Number(${val}))`;
                        if (op === ".=")
                            return `ctx.setVar(${JSON.stringify(varName)}, ctx.str(ctx.getVar(${JSON.stringify(varName)})) + ctx.str(${val}))`;
                        return `ctx.setVar(${JSON.stringify(varName)}, ${val})`;
                    }
                    const safeId = varName.replace(/[^a-zA-Z0-9_]/g, "_");
                    const vRef = `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(varName)})))`;
                    if (isByRef) {
                        let rightNode = node.right;
                        while (rightNode?.kind === "byref" || rightNode?.kind === "parenthesis" || rightNode?.kind === "parentheses") {
                            rightNode = rightNode.what || rightNode.inner || rightNode.expr;
                        }
                        if (rightNode?.kind === "variable") {
                            const rightName = this.getConstName(rightNode.name || rightNode);
                            const rightSafe = rightName.replace(/[^a-zA-Z0-9_]/g, "_");
                            const rightRef = `($v_${rightSafe} || ($v_${rightSafe} = ctx.getPHPVar(${JSON.stringify(rightName)})))`;
                            return `(await (async () => { const __r = ${rightRef}; return ${vRef}.bindRef(__r); })())`;
                        }
                    }
                    if (op === "+=")
                        return `(await (async () => { const __v = ${val}; return ${vRef}.set((Number(${vRef}.get()) || 0) + Number(__v)); })())`;
                    if (op === "-=")
                        return `(await (async () => { const __v = ${val}; return ${vRef}.set((Number(${vRef}.get()) || 0) - Number(__v)); })())`;
                    if (op === ".=")
                        return `(await (async () => { const __v = ${val}; return ${vRef}.set(ctx.str(${vRef}.get()) + ctx.str(__v)); })())`;
                    return `(await (async () => { const __v = ${val}; return ${vRef}.set(__v); })())`;
                }
                if (leftNode?.kind === "propertylookup") {
                    const obj = this.transpileExpr(leftNode.what, filepath);
                    const prop = this.transpilePropertyOffset(leftNode.offset, filepath);
                    if (op === "+=")
                        return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; return await ctx.setProperty(${obj}, ${prop}, __old + Number(${val})); })())`;
                    if (op === "-=")
                        return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; return await ctx.setProperty(${obj}, ${prop}, __old - Number(${val})); })())`;
                    if (op === ".=")
                        return `(await (async () => { const __old = ctx.str(await ctx.getProperty(${obj}, ${prop})); return await ctx.setProperty(${obj}, ${prop}, __old + ctx.str(${val})); })())`;
                    return `(await ctx.setProperty(${obj}, ${prop}, ${val}))`;
                }
                if (leftNode?.kind === "staticlookup") {
                    const className = this.transpileClassReference(leftNode.what, filepath);
                    const propName = this.getConstName(leftNode.offset);
                    if (op === "+=")
                        return `(await (async () => { const __old = Number(await ctx.getStaticProperty(${className}, ${JSON.stringify(propName)})) || 0; return await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, __old + Number(${val})); })())`;
                    if (op === "-=")
                        return `(await (async () => { const __old = Number(await ctx.getStaticProperty(${className}, ${JSON.stringify(propName)})) || 0; return await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, __old - Number(${val})); })())`;
                    if (op === ".=")
                        return `(await (async () => { const __old = ctx.str(await ctx.getStaticProperty(${className}, ${JSON.stringify(propName)})); return await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, __old + ctx.str(${val})); })())`;
                    return `(await ctx.setStaticProperty(${className}, ${JSON.stringify(propName)}, ${val}))`;
                }
                if (leftNode?.kind === "offsetlookup") {
                    const offsets = [];
                    let current = leftNode;
                    while (current?.kind === "offsetlookup") {
                        offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
                        current = current.what;
                        while (current?.kind === "parenthesis" || current?.kind === "parentheses") {
                            current = current.inner || current.expr || current.value || current.what;
                        }
                    }
                    let rightVal = val;
                    if (isByRef) {
                        let rightNode = node.right;
                        while (rightNode?.kind === "byref" || rightNode?.kind === "parenthesis" || rightNode?.kind === "parentheses") {
                            rightNode = rightNode.what || rightNode.inner || rightNode.expr;
                        }
                        if (rightNode?.kind === "variable") {
                            const rightName = this.getConstName(rightNode.name || rightNode);
                            const rightSafe = rightName.replace(/[^a-zA-Z0-9_]/g, "_");
                            rightVal = `($v_${rightSafe} || ($v_${rightSafe} = ctx.getPHPVar(${JSON.stringify(rightName)})))`;
                        }
                    }
                    if (current?.kind === "propertylookup") {
                        const obj = this.transpileExpr(current.what, filepath);
                        const prop = this.transpilePropertyOffset(current.offset, filepath);
                        return `(await ctx.setPropertyOffsets(${obj}, ${prop}, [${offsets.join(", ")}], ${rightVal}))`;
                    }
                    if (current?.kind === "staticlookup") {
                        const className = this.transpileClassReference(current.what, filepath);
                        const propName = this.getConstName(current.offset);
                        return `(await ctx.setStaticPropertyOffsets(${className}, ${JSON.stringify(propName)}, [${offsets.join(", ")}], ${rightVal}))`;
                    }
                    const varName = this.getConstName(current);
                    if (varName) {
                        if (this.isSuperglobal(varName) && varName === "GLOBALS") {
                            const offsetsStr = `[${offsets.join(", ")}]`;
                            if (op === "+=")
                                return `(await (async () => { const __old = Number(ctx.getVarOffsets(String((${offsetsStr})[0]), (${offsetsStr}).slice(1))) || 0; return ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), __old + Number(${val})); })())`;
                            if (op === "-=")
                                return `(await (async () => { const __old = Number(ctx.getVarOffsets(String((${offsetsStr})[0]), (${offsetsStr}).slice(1))) || 0; return ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), __old - Number(${val})); })())`;
                            if (op === ".=")
                                return `(await (async () => { const __old = String(ctx.getVarOffsets(String((${offsetsStr})[0]), (${offsetsStr}).slice(1))) ?? ""; return ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), __old + String(${val})); })())`;
                            if (node.byRef || node.byref || node.right?.kind === "byref") {
                                return `(await (async () => { const __r = ${rightVal}; const __os = [${offsets.join(", ")}]; ctx.bindGlobal(String(__os[0])); return (ctx.getPHPVar(String(__os[0]))).bindRef(__r, __os.slice(1)); })())`;
                            }
                            return `ctx.setGlobalVar(String((${offsetsStr})[0]), (${offsetsStr}).slice(1), ${rightVal})`;
                        }
                        if (node.byRef || node.byref || node.right?.kind === "byref") {
                            const safeId = varName.replace(/[^a-zA-Z0-9_]/g, "_");
                            return `(await (async () => { const __r = ${rightVal}; return ($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(varName)}))).bindRef(__r, [${offsets.join(", ")}]); })())`;
                        }
                        if (op === "+=")
                            return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + Number(${val})); })())`;
                        if (op === "-=")
                            return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old - Number(${val})); })())`;
                        if (op === ".=")
                            return `(await (async () => { const __old = String(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}]) ?? ""); return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + String(${val})); })())`;
                        return `ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], ${rightVal})`;
                    }
                }
                console.error("ASSIGN_UNMATCHED_LEFT_NODE:", JSON.stringify(leftNode));
                return `ctx.setVar("tmp", ${val})`;
            }
            case "array": {
                const items = node.items || [];
                const isAssoc = items.some((item) => item?.key !== null && item?.key !== undefined);
                if (isAssoc) {
                    const pairs = items.map((item) => {
                        const k = item.key ? this.transpileExpr(item.key, filepath) : "null";
                        const v = this.transpileExpr(item.value, filepath);
                        return `[${k}, ${v}]`;
                    });
                    return `Object.fromEntries([${pairs.join(", ")}])`;
                }
                const vals = items.map((item) => this.transpileExpr(item.value || item, filepath));
                return `[${vals.join(", ")}]`;
            }
            case "offsetlookup": {
                const obj = this.transpileExpr(node.what, filepath);
                const offset = node.offset ? this.transpileExpr(node.offset, filepath) : "undefined";
                return `(${obj})?.[${offset}]`;
            }
            case "propertylookup": {
                const obj = this.transpileExpr(node.what, filepath);
                const prop = this.transpilePropertyOffset(node.offset, filepath);
                return `(await ctx.getProperty(${obj}, ${prop}))`;
            }
            case "nullsafepropertylookup": {
                const obj = this.transpileExpr(node.what, filepath);
                const prop = this.transpilePropertyOffset(node.offset, filepath);
                return `(await (async () => { const __o = ${obj}; return (__o !== null && __o !== undefined) ? await ctx.getProperty(__o, ${prop}) : null; })())`;
            }
            case "encapsed": {
                const parts = (node.value || []).map((part) => {
                    if (typeof part === "string")
                        return JSON.stringify(part);
                    if (part.kind === "string" || part.kind === "number")
                        return JSON.stringify(String(part.value));
                    return `String((${this.transpileExpr(part, filepath)}) ?? "")`;
                });
                return `(${parts.join(" + ")})`;
            }
            case "encapsedpart": {
                if (node.expression || node.value || node.curly || node.what) {
                    const inner = node.expression || node.value || node.curly || node.what;
                    if (typeof inner === "string")
                        return JSON.stringify(inner);
                    return `String((${this.transpileExpr(inner, filepath)}) ?? "")`;
                }
                return '""';
            }
            case "pre":
            case "post": {
                const isInc = node.type === "+" || node.type === "++";
                const delta = isInc ? 1 : -1;
                if (node.what?.kind === "variable") {
                    const varName = this.getConstName(node.what.name || node.what);
                    if (this.isSuperglobal(varName)) {
                        if (node.kind === "pre") {
                            return `ctx.setVar(${JSON.stringify(varName)}, (Number(ctx.getVar(${JSON.stringify(varName)})) || 0) + ${delta})`;
                        }
                        return `((() => { const __old = Number(ctx.getVar(${JSON.stringify(varName)})) || 0; ctx.setVar(${JSON.stringify(varName)}, __old + ${delta}); return __old; })())`;
                    }
                    const safeId = varName.replace(/[^a-zA-Z0-9_]/g, "_");
                    const vRef = `($v_${safeId} || ($v_${safeId} = ctx.getPHPVar(${JSON.stringify(varName)})))`;
                    if (node.kind === "pre") {
                        return `${vRef}.set((Number(${vRef}.get()) || 0) + ${delta})`;
                    }
                    return `((() => { const __old = Number(${vRef}.get()) || 0; ${vRef}.set(__old + ${delta}); return __old; })())`;
                }
                if (node.what?.kind === "offsetlookup") {
                    const offsets = [];
                    let current = node.what;
                    while (current?.kind === "offsetlookup") {
                        offsets.unshift(current.offset ? this.transpileExpr(current.offset, filepath) : "null");
                        current = current.what;
                    }
                    if (current?.kind === "variable") {
                        const varName = this.getConstName(current.name || current);
                        if (node.kind === "pre") {
                            return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; return ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + ${delta}); })())`;
                        }
                        return `(await (async () => { const __old = Number(ctx.getVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}])) || 0; ctx.setVarOffsets(${JSON.stringify(varName)}, [${offsets.join(", ")}], __old + ${delta}); return __old; })())`;
                    }
                }
                if (node.what?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.what.what, filepath);
                    const prop = this.transpilePropertyOffset(node.what.offset, filepath);
                    if (node.kind === "pre") {
                        return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; await ctx.setProperty(${obj}, ${prop}, __old + ${delta}); return __old + ${delta}; })())`;
                    }
                    return `(await (async () => { const __old = Number(await ctx.getProperty(${obj}, ${prop})) || 0; await ctx.setProperty(${obj}, ${prop}, __old + ${delta}); return __old; })())`;
                }
                return "0";
            }
            case "unary": {
                const val = this.transpileExpr(node.what, filepath);
                if (node.type === "!")
                    return `(!ctx.isTruthy(${val}))`;
                if (node.type === "+")
                    return `(+${val})`;
                if (node.type === "-")
                    return `(-${val})`;
                return `${node.type}${val}`;
            }
            case "isset": {
                const argsList = node.variables || node.arguments || [node.variable || node.expr || node.expression || node.value].filter(Boolean);
                const args = (Array.isArray(argsList) ? argsList : [argsList]).map((v) => this.transpileExpr(v, filepath));
                return `(${args.map((a) => `(${a} !== undefined && ${a} !== null)`).join(" && ") || "true"})`;
            }
            case "empty": {
                const exprNode = node.expr || node.expression || node.variable || node.value || (node.arguments && node.arguments[0]);
                const val = exprNode ? this.transpileExpr(exprNode, filepath) : "null";
                return `(!ctx.isTruthy(${val}))`;
            }
            case "new": {
                const className = this.transpileClassReferenceLower(node.what, filepath);
                const origClassName = this.transpileClassReferenceOriginal(node.what, filepath);
                const rawArgs = this.transpileCallArgs(node.arguments, filepath);
                return `(await (ctx.classes[${className}] ?? (await ctx.resolveMissingClass(${className}, ${origClassName}))).__$$__new(ctx, ${rawArgs.join(", ")}))`;
            }
            case "bin":
            case "binary": {
                const op = node.type || node.operator || "=";
                if (op === "=" || op === "+=" || op === "-=" || op === ".=" || op === "*=" || op === "/=") {
                    return this.transpileExpr({ ...node, kind: "assign", operator: op }, filepath);
                }
                const left = this.transpileExpr(node.left, filepath);
                if (op === "<=>") {
                    const right = this.transpileExpr(node.right, filepath);
                    return `((${left} < ${right}) ? -1 : ((${left} > ${right}) ? 1 : 0))`;
                }
                if (op === "instanceof") {
                    const rightName = this.getConstName(node.right?.name || node.right).toLowerCase();
                    return `ctx.isInstanceOf(${left}, ${JSON.stringify(rightName)})`;
                }
                const right = this.transpileExpr(node.right, filepath);
                if (op === "xor")
                    return `((ctx.isTruthy(${left}) ? 1 : 0) !== (ctx.isTruthy(${right}) ? 1 : 0))`;
                if (op === "and" || op === "&&")
                    return `(ctx.isTruthy(${left}) && ctx.isTruthy(${right}))`;
                if (op === "or" || op === "||")
                    return `(ctx.isTruthy(${left}) || ctx.isTruthy(${right}))`;
                if (op === ".")
                    return `(ctx.str(${left}) + ctx.str(${right}))`;
                return `(${left} ${op} ${right})`;
            }
            case "include": {
                const target = this.transpileExpr(node.target || node.expr || node.what, filepath);
                if (node.once) {
                    return node.require
                        ? `(await ctx.requireOnce(${target}))`
                        : `(await ctx.includeOnce(${target}))`;
                }
                return node.require
                    ? `(await ctx.require(${target}))`
                    : `(await ctx.include(${target}))`;
            }
            case "ternary": {
                const test = this.transpileExpr(node.test, filepath);
                const iftrue = node.trueExpr ? this.transpileExpr(node.trueExpr, filepath) : test;
                const iffalse = this.transpileExpr(node.falseExpr, filepath);
                return `(ctx.isTruthy(${test}) ? ${iftrue} : ${iffalse})`;
            }
            case "call": {
                const name = this.getConstName(node.what).toLowerCase() || "func";
                if (name === "include" || name === "include_once" || name === "require" || name === "require_once") {
                    const fileArg = this.transpileExpr((node.arguments || [])[0], filepath);
                    if (name === "include")
                        return `(await ctx.include(${fileArg}))`;
                    if (name === "include_once")
                        return `(await ctx.includeOnce(${fileArg}))`;
                    if (name === "require")
                        return `(await ctx.require(${fileArg}))`;
                    if (name === "require_once")
                        return `(await ctx.requireOnce(${fileArg}))`;
                }
                const rawArgs = this.transpileCallArgs(node.arguments, filepath);
                if (node.what?.kind === "staticlookup") {
                    const isParent = node.what.what?.kind === "parentreference" || this.getConstName(node.what.what).toLowerCase() === "parent";
                    const method = JSON.stringify(this.getConstName(node.what.offset));
                    const methodLower = JSON.stringify(this.getConstName(node.what.offset).toLowerCase());
                    if (isParent) {
                        return `(await (async () => { const __parentCls = (await ctx.resolveClass(${JSON.stringify(this.currentClassName.toLowerCase())})).__php_parent; if (!__parentCls) throw new PHPFatalError("Cannot access parent:: when current class has no parent"); return typeof __parentCls.prototype?.[${method}] === "function" ? await __parentCls.prototype[${method}].call(this, ctx, ${rawArgs.join(", ")}) : typeof __parentCls[${method}] === "function" ? await __parentCls[${method}](ctx, ${rawArgs.join(", ")}) : typeof __parentCls.prototype?.[${methodLower}] === "function" ? await __parentCls.prototype[${methodLower}].call(this, ctx, ${rawArgs.join(", ")}) : typeof __parentCls[${methodLower}] === "function" ? await __parentCls[${methodLower}](ctx, ${rawArgs.join(", ")}) : ctx.methodMissing(__parentCls, ${methodLower}); })())`;
                    }
                    const className = this.transpileClassReferenceLower(node.what.what, filepath);
                    const origClassName = this.transpileClassReferenceOriginal(node.what.what, filepath);
                    return `(await (async () => { const __cls = await ctx.resolveClass(${className}, ${origClassName}); if (!__cls) throw new PHPFatalError("Class " + ${origClassName} + " not found"); return typeof __cls[${method}] === "function" ? await __cls[${method}](ctx, ${rawArgs.join(", ")}) : typeof __cls.prototype?.[${method}] === "function" ? await __cls.prototype[${method}].call(this && this.constructor === __cls ? this : __cls, ctx, ${rawArgs.join(", ")}) : typeof __cls[${methodLower}] === "function" ? await __cls[${methodLower}](ctx, ${rawArgs.join(", ")}) : typeof __cls.prototype?.[${methodLower}] === "function" ? await __cls.prototype[${methodLower}].call(this && this.constructor === __cls ? this : __cls, ctx, ${rawArgs.join(", ")}) : typeof __cls.__callStatic === "function" ? await __cls.__callStatic(ctx, new PHPLiteral(${methodLower}), new PHPLiteral([${rawArgs.join(", ")}])) : ctx.methodMissing(__cls, ${methodLower}); })())`;
                }
                if (node.what?.kind === "propertylookup") {
                    const obj = this.transpileExpr(node.what.what, filepath);
                    const method = this.transpileMethodOffset(node.what.offset, filepath);
                    return `(await (async () => { const __o = ${obj}; const __m = ${method}; return typeof __o[__m] === "function" ? await __o[__m](ctx, ${rawArgs.join(", ")}) : ctx.methodMissing(__o, __m); })())`;
                }
                if (node.what?.kind === "nullsafepropertylookup") {
                    const obj = this.transpileExpr(node.what.what, filepath);
                    const method = this.transpileMethodOffset(node.what.offset, filepath);
                    return `(await (async () => { const __o = ${obj}; if (__o === null || __o === undefined) return null; const __m = ${method}; return typeof __o[__m] === "function" ? await __o[__m](ctx, ${rawArgs.join(", ")}) : ctx.methodMissing(__o, __m); })())`;
                }
                if (node.what?.kind === "variable") {
                    const fnExpr = this.transpileExpr(node.what, filepath);
                    return `(await (ctx.functions[${JSON.stringify(fnExpr.toLowerCase())}] || (typeof ${fnExpr} === "function" ? ${fnExpr} : ctx.functionMissing(${fnExpr})))(ctx, ${rawArgs.join(", ")}))`;
                }
                return `(await (ctx.functions[${JSON.stringify(name)}] || ctx.functionMissing(${JSON.stringify(name)}))(ctx, ${rawArgs.join(", ")}))`;
            }
            case "staticlookup": {
                const className = this.transpileClassReferenceLower(node.what, filepath);
                const origClassName = this.transpileClassReferenceOriginal(node.what, filepath);
                const member = this.getConstName(node.offset);
                const isStaticProp = node.offset?.kind === "variable" || node.offset?.kind === "property" || member.startsWith("$");
                if (member.toLowerCase() === "class" && !isStaticProp)
                    return `((await ctx.resolveClass(${className}, ${origClassName}))?.[SYMBOL_PHP_NAME] || ${origClassName})`;
                const cleanMember = member.startsWith("$") ? member.slice(1) : member;
                if (isStaticProp) {
                    return `(await ctx.getStaticProperty(${className}, ${JSON.stringify(cleanMember.toLowerCase())}, ${origClassName}))`;
                }
                return `(await ctx.getClassConstant(${className}, ${JSON.stringify(cleanMember.toLowerCase())}, ${origClassName}))`;
            }
            case "parenthesis":
            case "parentheses": {
                const inner = node.inner || node.expr || node.value || node.what;
                return inner ? `(${this.transpileExpr(inner, filepath)})` : "undefined";
            }
            case "null":
            case "nil":
            case "nullkeyword":
                return "null";
            case "exit":
            case "die": {
                const statusNode = node.expression || node.status || node.expr || node.value;
                const status = statusNode ? this.transpileExpr(statusNode, filepath) : "0";
                return `(await (ctx.functions["exit"] || ctx.functionMissing("exit"))(ctx, new PHPLiteral(${status})))`;
            }
            case "retif":
            case "ternary": {
                const test = this.transpileExpr(node.test || node.cond, filepath);
                const iftrue = (node.trueExpr || node.true || node.value) ? this.transpileExpr(node.trueExpr || node.true || node.value, filepath) : test;
                const iffalse = this.transpileExpr(node.falseExpr || node.false || node.alternate, filepath);
                return `(ctx.isTruthy(${test}) ? ${iftrue} : ${iffalse})`;
            }
            case "cast": {
                const val = this.transpileExpr(node.expr || node.what || node.value, filepath);
                const type = (node.type || node.raw || "").toLowerCase();
                if (type === "bool" || type === "boolean")
                    return `ctx.isTruthy(${val})`;
                if (type === "int" || type === "integer")
                    return `(Number(parseInt(String(${val}), 10)) || 0)`;
                if (type === "float" || type === "double" || type === "real")
                    return `(Number(parseFloat(String(${val}))) || 0)`;
                if (type === "string")
                    return `ctx.str(${val})`;
                if (type === "array")
                    return `(Array.isArray(${val}) ? ${val} : (${val} === null || ${val} === undefined) ? [] : (typeof ${val} === "object") ? ${val} : [${val}])`;
                if (type === "object")
                    return `(typeof ${val} === "object" && ${val} !== null ? ${val} : { scalar: ${val} })`;
                return val;
            }
            case "postinc":
                return this.transpileExpr({ ...node, kind: "post", type: "+" }, filepath);
            case "preinc":
                return this.transpileExpr({ ...node, kind: "pre", type: "+" }, filepath);
            case "postdec":
                return this.transpileExpr({ ...node, kind: "post", type: "-" }, filepath);
            case "predec":
                return this.transpileExpr({ ...node, kind: "pre", type: "-" }, filepath);
            case "silent":
            case "silence": {
                const expr = this.transpileExpr(node.expr || node.what || node.inner, filepath);
                return `(await (async () => { const __oldLevel = ctx.errorReportingLevel; ctx.errorReportingLevel = 0; try { return await (${expr}); } finally { ctx.errorReportingLevel = __oldLevel; } })())`;
            }
            case "list": {
                const items = (node.items || node.arguments || node.value || []).map((item) => {
                    if (!item || item.kind === "noop")
                        return "null";
                    const target = item.kind === "entry" ? item.value : item;
                    return target ? this.transpileExpr(target, filepath) : "null";
                });
                return `[${items.join(", ")}]`;
            }
            case "empty": {
                const expr = node.expr || node.value || node.what;
                const val = expr ? this.transpileExpr(expr, filepath) : "undefined";
                return `(!ctx.isTruthy(${val}))`;
            }
            case "isset": {
                const args = (node.variables || node.arguments || node.value || []).map((v) => {
                    const val = this.transpileExpr(v, filepath);
                    return `(${val} !== undefined && ${val} !== null)`;
                });
                return `(${args.join(" && ") || "true"})`;
            }
            case "eval": {
                const code = this.transpileExpr(node.expr || node.value || node.what, filepath);
                return `(await ctx.eval(String(${code} ?? "")))`;
            }
            case "print": {
                const expr = this.transpileExpr(node.expr || node.value || node.what, filepath);
                return `(await (async () => { await ctx.echo(${expr}); return 1; })())`;
            }
            case "clone": {
                const expr = this.transpileExpr(node.expr || node.value || node.what, filepath);
                return `(await (async () => { const __o = ${expr}; if (!__o || typeof __o !== "object") return __o; const __clone = Array.isArray(__o) ? [...__o] : Object.assign(Object.create(Object.getPrototypeOf(__o)), __o); if (typeof __clone.__clone === "function") await __clone.__clone(ctx); return __clone; })())`;
            }
            case "yield": {
                const expr = node.value || node.expr ? this.transpileExpr(node.value || node.expr, filepath) : "null";
                return `(yield ${expr})`;
            }
            case "yieldfrom": {
                const expr = this.transpileExpr(node.value || node.expr, filepath);
                return `(yield* ${expr})`;
            }
            case "goto": {
                throw new Error("GOTO is not implemented");
            }
            case "assignref": {
                return this.transpileExpr({ ...node, kind: "assign" }, filepath);
            }
            case "reference":
            case "byref": {
                const expr = node.what || node.expr || node.value;
                if (expr?.kind === "variable") {
                    const varName = (expr.name?.name || expr.name).toString();
                    return `ctx.getVarRef(${JSON.stringify(varName)})`;
                }
                return expr ? this.transpileExpr(expr, filepath) : "null";
            }
            case "noop":
                return "";
            case "variadic": {
                const expr = node.what || node.value || node.expr || node.argument;
                const val = expr ? this.transpileExpr(expr, filepath) : "[]";
                return `...(${val} || [])`;
            }
            case "identifier": {
                const idName = (node.name || node.value || "").toString();
                return JSON.stringify(idName);
            }
            case "nowdoc": {
                const val = typeof node.value === "string" ? node.value : (node.value?.value || String(node.value || ""));
                return JSON.stringify(val);
            }
            case "heredoc": {
                if (typeof node.value === "string")
                    return JSON.stringify(node.value);
                if (Array.isArray(node.value)) {
                    const parts = node.value.map((part) => {
                        if (typeof part === "string")
                            return JSON.stringify(part);
                        if (part.kind === "string" || part.kind === "number")
                            return JSON.stringify(String(part.value));
                        if (part.kind === "variable")
                            return `String(ctx.getVar(${JSON.stringify(part.name?.name || part.name)}) ?? "")`;
                        return `String(${this.transpileExpr(part, filepath)} ?? "")`;
                    });
                    return `(${parts.join(" + ")})`;
                }
                return JSON.stringify(String(node.value || ""));
            }
            case "raw":
                return node.code || "";
            default:
                throw new Error(`Not Implemented expression kind: ${node?.kind}`);
        }
    }
}
//# sourceMappingURL=JSTranspiler.js.map