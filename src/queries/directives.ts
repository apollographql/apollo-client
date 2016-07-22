// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  Selection,
  Directive,
} from 'graphql';

import {
  argsToKeyValueMap,
} from '../data/storeUtils';

import isEqual = require('lodash.isequal');
import isBoolean = require('lodash.isboolean');

function validateDirective(
  selection: Selection,
  variables: Object,
  directive: Directive
) {
  const args = argsToKeyValueMap(directive.arguments, variables);
  const argKeys = Object.keys(args);

  if (directive.name.value === 'skip' || directive.name.value === 'include') {
    if (!isEqual(argKeys, ['if']) || !isBoolean(args['if'])) {
      throw new Error(`Invalid arguments ${JSON.stringify(argKeys)} for the @${directive.name.value} directive.`);
    }
  }
}

export function validateSelectionDirectives(
  selection: Selection,
  variables: Object = {}
) {
  if (selection.directives) {
    selection.directives.forEach(dir => validateDirective(selection, variables, dir));
  }
}

export function getDirectiveArgs(
  selection: Selection,
  directiveName: string,
  variables: any = {}
): any {
  if (!selection.directives) {
    return null;
  }

  const directive = selection.directives
    .filter(dir => dir.name.value === directiveName)[0] || null;

  if (!directive) {
    return null;
  }

  return argsToKeyValueMap(directive.arguments, variables);
}

export function shouldInclude(
  selection: Selection,
  variables: Object = {}
): Boolean {
  validateSelectionDirectives(selection, variables);

  let evaledValue: Boolean = true;

  const skipArgs = getDirectiveArgs(selection, 'skip', variables);
  const includeArgs = getDirectiveArgs(selection, 'include', variables);

  if (includeArgs) {
    evaledValue = includeArgs.if;
  }

  if (skipArgs) {
    evaledValue = !skipArgs.if;
  }

  if (skipArgs && includeArgs) {
    evaledValue = includeArgs.if && !skipArgs.if;
  }

  return evaledValue;
}
