#!/usr/bin/env node
require('source-map-support').install();

const { runFPM } = require("../src/cli/php-fpm");

const port = parseInt(process.argv[2] || "9000", 10);
const host = process.argv[3] || "127.0.0.1";

runFPM(port, host);
