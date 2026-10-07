import * as fs from "fs";
import * as path from "path";
import { JSTranspiler } from "../parser/JSTranspiler.js";
export async function runPhpToJS(rawArgs) {
    if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
        console.log("Usage: php-to-js <php-file> [javascript-output]");
        console.log("\nTranspiles a PHP file into JavaScript.");
        console.log("If javascript-output is omitted, the input file extension is replaced with .js.");
        process.exit(0);
    }
    const args = rawArgs.filter((arg) => !arg.startsWith("-"));
    if (args.length === 0) {
        console.error("Usage: php-to-js <php-file> [javascript-output]");
        process.exit(1);
    }
    const inputFile = args[0];
    const inputPath = path.resolve(inputFile);
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: File not found: ${inputFile}`);
        process.exit(1);
    }
    let outputFile = args[1];
    if (!outputFile) {
        const parsed = path.parse(inputFile);
        outputFile = path.join(parsed.dir, parsed.name + ".js");
    }
    const outputPath = path.resolve(outputFile);
    let phpCode;
    try {
        phpCode = fs.readFileSync(inputPath, "utf8");
    }
    catch (err) {
        console.error(`Error reading file ${inputFile}: ${err.message}`);
        process.exit(1);
    }
    try {
        const transpiler = new JSTranspiler();
        const format = outputPath.endsWith(".cjs") ? "cjs" : "esm";
        const result = transpiler.transpile(phpCode, inputPath, { format });
        const jsCode = result.code;
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, jsCode, "utf8");
        console.log(`Successfully transpiled ${inputFile} -> ${outputFile}`);
    }
    catch (err) {
        console.error(`Transpilation error: ${err.message}`);
        process.exit(1);
    }
}
//# sourceMappingURL=php-to-js.js.map