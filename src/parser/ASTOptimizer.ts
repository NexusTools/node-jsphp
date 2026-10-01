import type { PHPEngine } from "../PHPEngine";

export class ASTOptimizer {
  public static optimize(ast: any, engine: PHPEngine): any {
    if (!ast || typeof ast !== "object") return ast;

    if (Array.isArray(ast)) {
      const optimizedArray: any[] = [];
      for (const item of ast) {
        const opt = ASTOptimizer.optimize(item, engine);
        if (opt !== null && opt !== undefined) {
          if (Array.isArray(opt) && (opt as any).__unwrapped) {
            optimizedArray.push(...opt);
          } else {
            optimizedArray.push(opt);
          }
        }
      }
      return optimizedArray;
    }

    // Process child nodes first
    for (const key of Object.keys(ast)) {
      if (key !== "kind" && key !== "loc" && typeof ast[key] === "object") {
        ast[key] = ASTOptimizer.optimize(ast[key], engine);
      }
    }

    // 1. Optimize Call expressions on compile-time immutable values
    if (ast.kind === "call" && ast.what) {
      const funcName = (ast.what.name || ast.what.value || "").toString().toLowerCase();

      if (ast.arguments && ast.arguments.length === 1 && ast.arguments[0].kind === "string") {
        const name = String(ast.arguments[0].value);
        if (funcName === "extension_loaded") {
          return { kind: "boolean", value: engine.extensions.has(name.toLowerCase()), loc: ast.loc };
        }
        if (funcName === "defined") {
          if (engine.constants.has(name) || engine.constants.has(name.toUpperCase())) {
            return { kind: "boolean", value: true, loc: ast.loc };
          }
        }
        if (funcName === "constant") {
          const value = engine.getConstant(name);
          if (value !== undefined) {
            if (typeof value === "string") return { kind: "string", value, loc: ast.loc };
            if (typeof value === "number") return { kind: "number", value: String(value), loc: ast.loc };
            if (typeof value === "boolean") return { kind: "boolean", value, loc: ast.loc };
          }
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
          if (arg.kind === "string") return { kind: "boolean", value: true, loc: ast.loc };
        } else if (funcName === "is_int" || funcName === "is_integer") {
          if (arg.kind === "number" && !arg.value.includes(".")) return { kind: "boolean", value: true, loc: ast.loc };
        } else if (funcName === "is_bool") {
          if (arg.kind === "boolean") return { kind: "boolean", value: true, loc: ast.loc };
        } else if (funcName === "is_array") {
          if (arg.kind === "array") return { kind: "boolean", value: true, loc: ast.loc };
        }
      }
    }

    // 2. Optimize If statements on literal booleans
    if (ast.kind === "if") {
      const cond = ast.test;

      if (cond && cond.kind === "boolean" && cond.value === true) {
        const bodyStatements = ASTOptimizer.extractStatements(ast.body);
        (bodyStatements as any).__unwrapped = true;
        return bodyStatements;
      }

      if (cond && cond.kind === "boolean" && cond.value === false) {
        if (ast.alternate) {
          const altStatements = ASTOptimizer.extractStatements(ast.alternate);
          (altStatements as any).__unwrapped = true;
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
      } else if (ast.type === "||") {
        if (ast.left.kind === "boolean" && ast.right.kind === "boolean") {
          return { kind: "boolean", value: ast.left.value || ast.right.value, loc: ast.loc };
        }
      }
    }

    return ast;
  }

  private static extractStatements(bodyNode: any): any[] {
    if (!bodyNode) return [];
    if (bodyNode.kind === "block") {
      return bodyNode.children || [];
    }
    if (Array.isArray(bodyNode)) {
      return bodyNode;
    }
    return [bodyNode];
  }
}
