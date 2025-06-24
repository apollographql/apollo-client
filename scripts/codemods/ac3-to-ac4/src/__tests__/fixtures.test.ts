import { defineTest } from "jscodeshift/dist/testUtils";

defineTest(__dirname, "imports.ts", null, "imports", { parser: "ts" });
