#!/usr/bin/env node
import sourceMapSupport from "source-map-support";
import { runCLI } from "../src/cli/php.js";

sourceMapSupport.install();

runCLI(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
