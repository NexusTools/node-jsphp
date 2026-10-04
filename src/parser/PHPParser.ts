import engineParser from "php-parser";

export interface PHPParserOptions {
  filename?: string;
  debug?: boolean;
}

export class PHPParser {
  private engine: any;

  constructor() {
    this.engine = new ((engineParser as any).Engine || (engineParser as any))({
      parser: {
        extractDoc: true,
        php7: true,
        suppressErrors: true,
      },
      ast: {
        withPositions: true,
        withSource: true,
      },
    });
  }

  public parse(code: string, filename: string = "eval"): any {
    // Standardize PHP tag prefix if missing
    let source = code;
    if (!source.trim().startsWith("<?")) {
      source = "<?php " + source;
    }
    try {
      return this.engine.parseCode(source, filename);
    } catch (err: any) {
      // Fallback parsing for short inline tags or custom fragments
      return this.engine.parseEval(code);
    }
  }
}
