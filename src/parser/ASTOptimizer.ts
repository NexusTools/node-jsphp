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

    // 1. Optimize constant references (name & constref) based on PHPEngine constants
    if (ast.kind === "name" || ast.kind === "constref") {
      let constName = "";
      if (typeof ast.name === "string") {
        constName = ast.name;
      } else if (ast.name && typeof ast.name === "object") {
        constName = (ast.name.name || ast.name.value || "").toString();
      } else if (typeof ast.value === "string") {
        constName = ast.value;
      }
      if (constName && engine) {
        if (engine.constants.has(constName)) {
          return ASTOptimizer.literalNode(engine.constants.get(constName), ast.loc);
        }
        if (engine.constants.has(constName.toUpperCase())) {
          return ASTOptimizer.literalNode(engine.constants.get(constName.toUpperCase()), ast.loc);
        }
      }
    }

    // Process child nodes
    for (const key of Object.keys(ast)) {
      if (key !== "kind" && key !== "loc" && typeof ast[key] === "object") {
        ast[key] = ASTOptimizer.optimize(ast[key], engine);
      }
    }

    // 2. Optimize Call expressions based on PHPEngine configuration
    if (ast.kind === "call" && ast.what) {
      const funcName = (ast.what.name || ast.what.value || "").toString().toLowerCase();

      // extension_loaded("ext")
      if (funcName === "extension_loaded" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string" && engine) {
          const extName = arg.value.toLowerCase();
          const isLoaded = engine.extensions.has(extName);
          return { kind: "boolean", value: isLoaded, loc: ast.loc };
        }
      }

      // class_exists("class_name")
      if (funcName === "class_exists" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string" && engine) {
          const clsName = arg.value.toLowerCase();
          if (engine.classes.has(clsName)) {
            return { kind: "boolean", value: true, loc: ast.loc };
          }
        }
      }

      // function_exists("func_name")
      if (funcName === "function_exists" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string" && engine) {
          const fnName = arg.value.toLowerCase();
          if (engine.functions.has(fnName)) {
            return { kind: "boolean", value: true, loc: ast.loc };
          }
        }
      }

      // defined("CONST_NAME")
      if (funcName === "defined" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string" && engine) {
          const constName = arg.value;
          const isDefined = engine.constants.has(constName) || engine.constants.has(constName.toUpperCase()) || constName === "PHP_VERSION" || constName === "PHP_ENGINE";
          return { kind: "boolean", value: isDefined, loc: ast.loc };
        }
      }

      // constant("CONST_NAME")
      if (funcName === "constant" && ast.arguments && ast.arguments.length === 1) {
        const arg = ast.arguments[0];
        if (arg.kind === "string" && engine) {
          const cName = arg.value;
          if (engine.constants.has(cName)) {
            return ASTOptimizer.literalNode(engine.constants.get(cName), ast.loc);
          }
          if (engine.constants.has(cName.toUpperCase())) {
            return ASTOptimizer.literalNode(engine.constants.get(cName.toUpperCase()), ast.loc);
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

    // 3. Optimize If statements
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

    // 4. Optimize unary boolean NOT !
    if (ast.kind === "unary" && ast.type === "!") {
      if (ast.what && ast.what.kind === "boolean") {
        return { kind: "boolean", value: !ast.what.value, loc: ast.loc };
      }
    }

    // 5. Optimize binary boolean expressions &&, ||
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
