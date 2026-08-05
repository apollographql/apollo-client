import type { ArgumentNode } from "graphql";
import { Kind, visit } from "graphql";

// eslint-disable-next-line local-rules/import-from-inside-other-export
import { DocumentTransform } from "../graphql/DocumentTransform.js";

import { getDirectiveArgValue } from "./getDirectiveArgValue.js";

const RESERVED_PREFIX = "ac_";

export const addDeferFragmentLabels = new DocumentTransform((document) => {
  let count = 0;

  return visit(document, {
    Directive(node) {
      if (node.name.value !== "defer") return;

      // Keep user defined labels
      const label = getDirectiveArgValue(node, "label", Kind.STRING);
      if (label && !label.startsWith(RESERVED_PREFIX)) return;

      const args = node.arguments ?? [];
      const index = args.findIndex((arg) => arg.name.value === "label");

      const labelArg: ArgumentNode = {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: "label" },
        value: { kind: Kind.STRING, value: RESERVED_PREFIX + count++ },
      };

      return {
        ...node,
        arguments:
          index === -1 ?
            [...args, labelArg]
          : args.map((arg, i) => (i === index ? labelArg : arg)),
      };
    },
  });
});
