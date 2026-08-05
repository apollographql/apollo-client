import type { ArgumentNode } from "graphql";
import { Kind, visit } from "graphql";

// eslint-disable-next-line local-rules/import-from-inside-other-export
import { DocumentTransform } from "../graphql/DocumentTransform.js";

const RESERVED_PREFIX = "ac_";

export const addDeferFragmentLabels = new DocumentTransform((document) => {
  let count = 0;

  return visit(document, {
    Directive(node) {
      if (node.name.value !== "defer") return;

      const args = node.arguments ?? [];
      const index = args.findIndex((arg) => arg.name.value === "label");
      const labelValue = getLabelValue(args[index]);

      // Keep user defined labels
      if (labelValue && !labelValue.startsWith(RESERVED_PREFIX)) return;

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

function getLabelValue(labelArg: ArgumentNode) {
  if (labelArg?.value.kind === Kind.STRING) {
    return labelArg.value.value;
  }
}
