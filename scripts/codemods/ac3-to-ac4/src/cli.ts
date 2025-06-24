import { join } from "node:path";
import { codemods } from "./index.js";
import { parseArgs } from "node:util";
import { createRequire } from "node:module";

const { values: args } = parseArgs({
  options: {
    codemod: {
      type: "string",
      default: Object.keys(codemods),
      multiple: true,
    },
  },
  allowPositionals: true,
  strict: false,
});

process.env.JSCODESHIFT_TRANSFORM = args.codemod!.join(",");

// @ts-ignore
process.argv.push("--transform", join(import.meta.dirname, "index.js"));
// @ts-ignore
const require = createRequire(import.meta.url);
require("jscodeshift/bin/jscodeshift.js");
