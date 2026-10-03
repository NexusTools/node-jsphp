#!/usr/bin/env node
require('source-map-support').install();

const { runHTTPServerCLI } = require("../src/cli/php-http-server");

runHTTPServerCLI(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
