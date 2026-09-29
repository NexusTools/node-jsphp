#!/usr/bin/env node
const { runFPM } = require("../src/cli/php-fpm");

runFPM().catch((err) => {
  console.error(err);
  process.exit(1);
});
