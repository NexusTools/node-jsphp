#!/usr/bin/env node
require('source-map-support').install();

const { runHTTPServer } = require("../src/cli/php-http-server");

const port = parseInt(process.argv[2] || "8080", 10);
const docRoot = process.argv[3] || process.cwd();
const cacheDir = process.argv[4];

runHTTPServer(port, docRoot, cacheDir);
