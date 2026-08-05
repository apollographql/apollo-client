import type { ArgumentNode } from "graphql";
import { Kind, visit } from "graphql";

// eslint-disable-next-line local-rules/import-from-inside-other-export
import { DocumentTransform } from "../graphql/DocumentTransform.js";

export const addDeferFragmentLabels = new DocumentTransform((document) => {
  let count = 0;

  return visit(document, {
    Directive(node) {
      if (
        node.name.value !== "defer" ||
        // Keep labels defined by users
        node.arguments?.some((arg) => arg.name.value === "label")
      ) {
        return;
      }

      return {
        ...node,
        arguments: [
          ...(node.arguments ?? []),
          {
            kind: Kind.ARGUMENT,
            name: { kind: Kind.NAME, value: "label" },
            value: { kind: Kind.STRING, value: `ac_${count++}` },
          } satisfies ArgumentNode,
        ],
      };
    },
  });
});
