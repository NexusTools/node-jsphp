#!/usr/bin/env node
import sourceMapSupport from "source-map-support";
import { runHTTPServerCLI } from "../src/cli/php-http-server.js";

sourceMapSupport.install();

runHTTPServerCLI(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
