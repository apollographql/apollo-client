import type {
  ArgumentNode,
  ASTNode,
  BooleanValueNode,
  DirectiveNode,
  DocumentNode,
  SelectionNode,
  ValueNode,
  VariableNode,
} from "graphql";
import { BREAK, visit } from "graphql";

import { invariant } from "@apollo/client/utilities/invariant";

/** @internal */
export function hasDirectives(names: string[], root: ASTNode, all?: boolean) {
  const nameSet = new Set(names);
  const uniqueCount = nameSet.size;

  visit(root, {
    Directive(node) {
      if (nameSet.delete(node.name.value) && (!all || !nameSet.size)) {
        return BREAK;
      }
    },
  });

  // If we found all the names, nameSet will be empty. If we only care about
  // finding some of them, the < condition is sufficient.
  return all ? !nameSet.size : nameSet.size < uniqueCount;
}

export function hasClientExports(document: DocumentNode) {
  return document && hasDirectives(["client", "export"], document, true);
}

function isInclusionDirective({ name: { value } }: DirectiveNode): boolean {
  return value === "skip" || value === "include";
}

type InclusionDirectives = Array<{
  directive: DirectiveNode;
  ifArgument: ArgumentNode;
}>;

function getInclusionDirectives(
  directives: ReadonlyArray<DirectiveNode>
): InclusionDirectives {
  const result: InclusionDirectives = [];

  if (directives && directives.length) {
    directives.forEach((directive) => {
      if (!isInclusionDirective(directive)) return;

      const directiveArguments = directive.arguments;
      const directiveName = directive.name.value;

      invariant(
        directiveArguments && directiveArguments.length === 1,
        `Incorrect number of arguments for the @%s directive.`,
        directiveName
      );

      const ifArgument = directiveArguments![0];
      invariant(
        ifArgument.name && ifArgument.name.value === "if",
        `Invalid argument for the @%s directive.`,
        directiveName
      );

      const ifValue: ValueNode = ifArgument.value;

      // means it has to be a variable value if this is a valid @skip or @include directive
      invariant(
        ifValue &&
          (ifValue.kind === "Variable" || ifValue.kind === "BooleanValue"),
        `Argument for the @%s directive must be a variable or a boolean value.`,
        directiveName
      );

      result.push({ directive, ifArgument });
    });
  }

  return result;
}

/** @internal */
export function shouldInclude(
  { directives }: SelectionNode,
  variables?: Record<string, any>
): boolean {
  if (!directives || !directives.length) {
    return true;
  }
  return getInclusionDirectives(directives).every(
    ({ directive, ifArgument }) => {
      let evaledValue: boolean = false;
      if (ifArgument.value.kind === "Variable") {
        evaledValue =
          variables && variables[(ifArgument.value as VariableNode).name.value];
        invariant(
          evaledValue !== void 0,
          `Invalid variable referenced in @%s directive.`,
          directive.name.value
        );
      } else {
        evaledValue = (ifArgument.value as BooleanValueNode).value;
      }
      return directive.name.value === "skip" ? !evaledValue : evaledValue;
    }
  );
}
