#!/usr/bin/env node
const { runHTTPServer } = require("../src/cli/php-http-server");

const port = parseInt(process.argv[2] || "8080", 10);
const docRoot = process.argv[3] || process.cwd();

runHTTPServer(port, docRoot);
