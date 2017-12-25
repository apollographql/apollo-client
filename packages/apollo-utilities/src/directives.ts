// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  FieldNode,
  OperationDefinitionNode,
  SelectionNode,
  VariableNode,
  BooleanValueNode,
  DirectiveNode,
  DocumentNode,
} from 'graphql';

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
    if (directiveArguments.length !== 1) {
      throw new Error(
        `Incorrect number of arguments for the @${directiveName} directive.`,
      );
    }

    const ifArgument = directiveArguments[0];
    if (!ifArgument.name || ifArgument.name.value !== 'if') {
      throw new Error(`Invalid argument for the @${directiveName} directive.`);
    }

    const ifValue = directiveArguments[0].value;
    let evaledValue: boolean = false;
    if (!ifValue || ifValue.kind !== 'BooleanValue') {
      // means it has to be a variable value if this is a valid @skip or @include directive
      if (ifValue.kind !== 'Variable') {
        throw new Error(
          `Argument for the @${directiveName} directive must be a variable or a bool ean value.`,
        );
      } else {
        evaledValue = variables[(ifValue as VariableNode).name.value];
        if (evaledValue === undefined) {
          throw new Error(
            `Invalid variable referenced in @${directiveName} directive.`,
          );
        }
      }
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

export function flattenSelections(selection: SelectionNode): SelectionNode[] {
  if (
    !(selection as FieldNode).selectionSet ||
    !((selection as FieldNode).selectionSet.selections.length > 0)
  )
    return [selection];

  return [selection].concat(
    (selection as FieldNode).selectionSet.selections
      .map(selectionNode =>
        [selectionNode].concat(flattenSelections(selectionNode)),
      )
      .reduce((selections, selected) => selections.concat(selected), []),
  );
}

const added = new Map();
export function getDirectiveNames(doc: DocumentNode) {
  const cached = added.get(doc);
  if (cached) return cached;

  // operation => [names of directives];
  const directives = doc.definitions
    .filter(
      (definition: OperationDefinitionNode) =>
        definition.selectionSet && definition.selectionSet.selections,
    )
    // operation => [[Selection]]
    .map(x => flattenSelections(x as any))
    // [[Selection]] => [Selection]
    .reduce((selections, selected) => selections.concat(selected), [])
    // [Selection] => [Selection with Directives]
    .filter(
      (selection: SelectionNode) =>
        selection.directives && selection.directives.length > 0,
    )
    // [Selection with Directives] => [[Directives]]
    .map((selection: SelectionNode) => selection.directives)
    // [[Directives]] => [Directives]
    .reduce((directives, directive) => directives.concat(directive), [])
    // [Directives] => [Name]
    .map((directive: DirectiveNode) => directive.name.value);

  added.set(doc, directives);
  return directives;
}

export function hasDirectives(names: string[], doc: DocumentNode) {
  return getDirectiveNames(doc).some(
    (name: string) => names.indexOf(name) > -1,
  );
}
