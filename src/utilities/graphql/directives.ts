import { invariant } from "../globals/index.js";

// Provides the methods that allow QueryManager to handle the `skip` and
// `include` directives within GraphQL.
import type {
  SelectionNode,
  VariableNode,
  BooleanValueNode,
  DirectiveNode,
  DocumentNode,
  ArgumentNode,
  ValueNode,
  ASTNode,
} from "graphql";
import { visit, BREAK } from "graphql";

export type DirectiveInfo = {
  [fieldName: string]: { [argName: string]: any };
};

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

export function getDirectiveNames(root: ASTNode) {
  const names: string[] = [];

  visit(root, {
    Directive(node: DirectiveNode) {
      names.push(node.name.value);
    },
  });

  return names;
}

export const hasAnyDirectives = (names: string[], root: ASTNode) =>
  hasDirectives(names, root, false);

export const hasAllDirectives = (names: string[], root: ASTNode) =>
  hasDirectives(names, root, true);

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

export type InclusionDirectives = Array<{
  directive: DirectiveNode;
  ifArgument: ArgumentNode;
}>;

function isInclusionDirective({ name: { value } }: DirectiveNode): boolean {
  return value === "skip" || value === "include";
}

export function getInclusionDirectives(
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

export function isUnmaskedDocument(document: DocumentNode) {
  let unmasked = false;
  let operationName: string | undefined;

  visit(document, {
    OperationDefinition(node) {
      operationName = node.name?.value;

      if (node.directives) {
        unmasked = node.directives.some(
          (directive) => directive.name.value === "unmask"
        );
      }

      if (__DEV__) {
        // Allow us to continue traversal in development to warn if we detect
        // the unmask directive anywhere else in the document.
        return;
      }

      return BREAK;
    },
    Directive(node, _, __, ___, ancestors) {
      if (__DEV__) {
        if (node.name.value !== "unmask") {
          return;
        }

        const parent = ancestors[ancestors.length - 1];

        // Make sure we aren't checking the `unmask` directive defined on
        // the operation, which we don't want to warn on.
        if (
          Array.isArray(parent) ||
          (parent as ASTNode).kind !== "OperationDefinition"
        ) {
          invariant.warn(
            "@unmask directive used in %s is provided in a location other than the document root which is ignored.",
            operationName ? `'${operationName}': ` : "anonymous operation"
          );

          // We only want to warn once if we detect misused of @unmask so we
          // immediately stop traversal.
          return BREAK;
        }
      }
    },
  });

  return unmasked;
}
