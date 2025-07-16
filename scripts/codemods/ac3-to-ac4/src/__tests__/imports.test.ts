import { defineInlineTest } from "jscodeshift/dist/testUtils";

import imports from "../imports.js";

function ts(code: TemplateStringsArray): string {
  return code[0];
}

defineInlineTest(
  imports,
  {},
  ts`import {useQuery} from '@apollo/client'`,
  ts`import {useQuery} from "@apollo/client/react"`
);
