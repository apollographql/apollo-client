import type { DocumentNode } from "graphql";
import { visit } from "graphql";

export function removeMaskedFragmentSpreads(document: DocumentNode) {
  return visit(document, {
    FragmentSpread(node) {
      if (!node.directives?.some(({ name }) => name.value === "unmask")) {
        return null;
      }
    },
  });
}
