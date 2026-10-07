#!/usr/bin/env node
import sourceMapSupport from "source-map-support";
import { runPhpToJS } from "../src/cli/php-to-js.js";

sourceMapSupport.install();

runPhpToJS(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
