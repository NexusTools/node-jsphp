#!/usr/bin/env node
require('source-map-support').install();

const { runCLI } = require("../src/cli/php");

runCLI(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
