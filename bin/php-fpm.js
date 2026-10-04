#!/usr/bin/env node
import sourceMapSupport from "source-map-support";
import { runFPM } from "../src/cli/php-fpm.js";

sourceMapSupport.install();

const port = parseInt(process.argv[2] || "9000", 10);
const host = process.argv[3] || "127.0.0.1";

runFPM(port, host);
