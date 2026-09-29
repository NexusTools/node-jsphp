export interface OptimizerContext {
  enabledExtensions: Set<string>;
  constants: Map<string, any>;
}

export class ASTOptimizer {
  public static optimize(ast: any, ctx: OptimizerContext): any {
    if (!ast || typeof ast !== "object") return ast;

    if (Array.isArray(ast)) {
      const optimizedArray: any[] = [];
      for (const item of ast) {
        const opt = ASTOptimizer.optimize(item, ctx);
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
        ast[key] = ASTOptimizer.optimize(ast[key], ctx);
      }
    }

    // 1. Optimize Call expressions: extension_loaded & defined & constant
    if (ast.kind === "call" && ast.what) {
      const funcName = (ast.what.name || ast.what.value || "").toString().toLowerCase();

      // extension_loaded("ext")
      if (funcName === "extension_loaded" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string") {
          const extName = arg.value.toLowerCase();
          const isLoaded = ctx.enabledExtensions.has(extName);
          return { kind: "boolean", value: isLoaded, loc: ast.loc };
        }
      }

      // defined("CONST_NAME")
      if (funcName === "defined" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string") {
          const constName = arg.value;
          const isDefined = ctx.constants.has(constName) || constName === "PHP_VERSION" || constName === "PHP_ENGINE";
          return { kind: "boolean", value: isDefined, loc: ast.loc };
        }
      }

      // constant("CONST_NAME")
      if (funcName === "constant" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string" && ctx.constants.has(arg.value)) {
          const val = ctx.constants.get(arg.value);
          return ASTOptimizer.literalNode(val, ast.loc);
        }
      }
    }

    // 2. Optimize If statements
    if (ast.kind === "if") {
      const cond = ast.test;

      // if (true)
      if (cond && cond.kind === "boolean" && cond.value === true) {
        const bodyStatements = ASTOptimizer.extractStatements(ast.body);
        (bodyStatements as any).__unwrapped = true;
        return bodyStatements;
      }

      // if (false)
      if (cond && cond.kind === "boolean" && cond.value === false) {
        if (ast.alternate) {
          const altStatements = ASTOptimizer.extractStatements(ast.alternate);
          (altStatements as any).__unwrapped = true;
          return altStatements;
        }
        // No else branch: remove entire if statement
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

  private static literalNode(value: any, loc: any): any {
    if (typeof value === "boolean") return { kind: "boolean", value, loc };
    if (typeof value === "number") return { kind: "number", value: String(value), loc };
    if (typeof value === "string") return { kind: "string", value, loc };
    if (value === null) return { kind: "null", loc };
    return { kind: "string", value: String(value), loc };
  }
}
