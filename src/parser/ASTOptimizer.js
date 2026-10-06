export class ASTOptimizer {
    static optimize(ast, engine) {
        if (!ast || typeof ast !== "object")
            return ast;
        if (Array.isArray(ast)) {
            const optimizedArray = [];
            for (const item of ast) {
                const opt = ASTOptimizer.optimize(item, engine);
                if (opt !== null && opt !== undefined) {
                    if (Array.isArray(opt) && opt.__unwrapped) {
                        optimizedArray.push(...opt);
                    }
                    else {
                        optimizedArray.push(opt);
                    }
                }
            }
            return optimizedArray;
        }
        // Process child nodes first
        if (ast.children)
            ast.children = ASTOptimizer.optimize(ast.children, engine);
        if (ast.body)
            ast.body = ASTOptimizer.optimize(ast.body, engine);
        if (ast.alternate)
            ast.alternate = ASTOptimizer.optimize(ast.alternate, engine);
        if (ast.test)
            ast.test = ASTOptimizer.optimize(ast.test, engine);
        if (ast.expr)
            ast.expr = ASTOptimizer.optimize(ast.expr, engine);
        if (ast.left)
            ast.left = ASTOptimizer.optimize(ast.left, engine);
        if (ast.right)
            ast.right = ASTOptimizer.optimize(ast.right, engine);
        if (ast.what)
            ast.what = ASTOptimizer.optimize(ast.what, engine);
        if (ast.arguments)
            ast.arguments = ASTOptimizer.optimize(ast.arguments, engine);
        if (ast.items)
            ast.items = ASTOptimizer.optimize(ast.items, engine);
        if (ast.value && typeof ast.value === "object")
            ast.value = ASTOptimizer.optimize(ast.value, engine);
        if (ast.key && typeof ast.key === "object")
            ast.key = ASTOptimizer.optimize(ast.key, engine);
        // 1. Optimize Call expressions on compile-time immutable values
        if (ast.kind === "call" && ast.what) {
            const funcName = (ast.what.name || ast.what.value || "").toString().toLowerCase();
            if (ast.arguments && ast.arguments.length === 1 && ast.arguments[0].kind === "string") {
                const name = String(ast.arguments[0].value);
                if (funcName === "extension_loaded") {
                    return { kind: "boolean", value: engine.extensions.has(name.toLowerCase()), loc: ast.loc };
                }
            }
            // strlen("literal_string")
            if (funcName === "strlen" && ast.arguments && ast.arguments.length === 1) {
                const arg = ast.arguments[0];
                if (arg.kind === "string") {
                    return { kind: "number", value: String(arg.value.length), loc: ast.loc };
                }
            }
            // Type checks on literals
            if (ast.arguments && ast.arguments.length === 1) {
                const arg = ast.arguments[0];
                if (funcName === "is_string") {
                    if (arg.kind === "string")
                        return { kind: "boolean", value: true, loc: ast.loc };
                }
                else if (funcName === "is_int" || funcName === "is_integer") {
                    if (arg.kind === "number" && !arg.value.includes("."))
                        return { kind: "boolean", value: true, loc: ast.loc };
                }
                else if (funcName === "is_bool") {
                    if (arg.kind === "boolean")
                        return { kind: "boolean", value: true, loc: ast.loc };
                }
                else if (funcName === "is_array") {
                    if (arg.kind === "array")
                        return { kind: "boolean", value: true, loc: ast.loc };
                }
            }
        }
        // 2. Optimize If statements on literal booleans
        if (ast.kind === "if") {
            const cond = ast.test;
            if (cond && cond.kind === "boolean" && cond.value === true) {
                const bodyStatements = ASTOptimizer.extractStatements(ast.body);
                bodyStatements.__unwrapped = true;
                return bodyStatements;
            }
            if (cond && cond.kind === "boolean" && cond.value === false) {
                if (ast.alternate) {
                    const altStatements = ASTOptimizer.extractStatements(ast.alternate);
                    altStatements.__unwrapped = true;
                    return altStatements;
                }
                return null;
            }
        }
        // 3. Optimize unary boolean NOT !
        if (ast.kind === "unary" && ast.type === "!") {
            if (ast.what && ast.what.kind === "boolean") {
                return { kind: "boolean", value: !ast.what.value, loc: ast.loc };
            }
        }
        // 4. Optimize binary boolean expressions &&, ||
        if (ast.kind === "binary") {
            if (ast.type === "&&") {
                if (ast.left.kind === "boolean" && ast.right.kind === "boolean") {
                    return { kind: "boolean", value: ast.left.value && ast.right.value, loc: ast.loc };
                }
            }
            else if (ast.type === "||") {
                if (ast.left.kind === "boolean" && ast.right.kind === "boolean") {
                    return { kind: "boolean", value: ast.left.value || ast.right.value, loc: ast.loc };
                }
            }
        }
        return ast;
    }
    static extractStatements(bodyNode) {
        if (!bodyNode)
            return [];
        if (bodyNode.kind === "block") {
            return bodyNode.children || [];
        }
        if (Array.isArray(bodyNode)) {
            return bodyNode;
        }
        return [bodyNode];
    }
}
//# sourceMappingURL=ASTOptimizer.js.map