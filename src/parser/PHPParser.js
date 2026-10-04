import engineParser from "php-parser";
export class PHPParser {
    engine;
    constructor() {
        this.engine = new (engineParser.Engine || engineParser)({
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
    parse(code, filename = "eval") {
        // Standardize PHP tag prefix if missing
        let source = code;
        if (!source.trim().startsWith("<?")) {
            source = "<?php " + source;
        }
        try {
            return this.engine.parseCode(source, filename);
        }
        catch (err) {
            // Fallback parsing for short inline tags or custom fragments
            return this.engine.parseEval(code);
        }
    }
}
//# sourceMappingURL=PHPParser.js.map