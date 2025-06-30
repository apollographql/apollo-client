#!/usr/bin/env node

import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-ignore
const url = import.meta.url;
const fullName = fileURLToPath(url);

process.argv.splice(
  2,
  0,
  "--transform",
  join(dirname(fullName), `index${extname(fullName)}`)
);
const require = createRequire(url);
require("jscodeshift/bin/jscodeshift.js");
