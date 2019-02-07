// Provides the methods that allow QueryManager to handle the `skip` and
// `include` directives within GraphQL.
import {
  FieldNode,
  SelectionNode,
  VariableNode,
  BooleanValueNode,
  DirectiveNode,
  DocumentNode,
} from 'graphql';

import { visit } from 'graphql/language/visitor';

import { invariant } from 'ts-invariant';

import { argumentsObjectFromField } from './storeUtils';

export type DirectiveInfo = {
  [fieldName: string]: { [argName: string]: any };
};

export function getDirectiveInfoFromField(
  field: FieldNode,
  variables: Object,
): DirectiveInfo {
  if (field.directives && field.directives.length) {
    const directiveObj: DirectiveInfo = {};
    field.directives.forEach((directive: DirectiveNode) => {
      directiveObj[directive.name.value] = argumentsObjectFromField(
        directive,
        variables,
      );
    });
    return directiveObj;
  }
  return null;
}

export function shouldInclude(
  selection: SelectionNode,
  variables: { [name: string]: any } = {},
): boolean {
  if (!selection.directives) {
    return true;
  }

  let res: boolean = true;
  selection.directives.forEach(directive => {
    // TODO should move this validation to GraphQL validation once that's implemented.
    if (directive.name.value !== 'skip' && directive.name.value !== 'include') {
      // Just don't worry about directives we don't understand
      return;
    }

    //evaluate the "if" argument and skip (i.e. return undefined) if it evaluates to true.
    const directiveArguments = directive.arguments || [];
    const directiveName = directive.name.value;

    invariant(
      directiveArguments.length === 1,
      `Incorrect number of arguments for the @${directiveName} directive.`,
    );

    const ifArgument = directiveArguments[0];
    invariant(
      ifArgument.name && ifArgument.name.value === 'if',
      `Invalid argument for the @${directiveName} directive.`,
    );

    const ifValue = directiveArguments[0].value;
    let evaledValue: boolean = false;
    if (!ifValue || ifValue.kind !== 'BooleanValue') {
      // means it has to be a variable value if this is a valid @skip or @include directive
      invariant(
        ifValue.kind === 'Variable',
        `Argument for the @${directiveName} directive must be a variable or a boolean value.`,
      );
      evaledValue = variables[(ifValue as VariableNode).name.value];
      invariant(
        evaledValue !== void 0,
        `Invalid variable referenced in @${directiveName} directive.`,
      );
    } else {
      evaledValue = (ifValue as BooleanValueNode).value;
    }

    if (directiveName === 'skip') {
      evaledValue = !evaledValue;
    }

    if (!evaledValue) {
      res = false;
    }
  });

  return res;
}

export function getDirectiveNames(doc: DocumentNode) {
  const names: string[] = [];

  visit(doc, {
    Directive(node) {
      names.push(node.name.value);
    },
  });

  return names;
}

export function hasDirectives(names: string[], doc: DocumentNode) {
  return getDirectiveNames(doc).some(
    (name: string) => names.indexOf(name) > -1,
  );
}

export function hasClientExports(document: DocumentNode) {
  return (
    document &&
    hasDirectives(['client'], document) &&
    hasDirectives(['export'], document)
  );
}
