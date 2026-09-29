"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHPParser = void 0;
const Engine = require("php-parser");
class PHPParser {
    engine;
    constructor() {
        this.engine = new Engine({
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
exports.PHPParser = PHPParser;
//# sourceMappingURL=PHPParser.js.map