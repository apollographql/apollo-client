// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  Selection,
  Variable,
  BooleanValue,
} from 'graphql';

// TODO: move all directive validation to a solution using GraphQL-js

export function checkDirectives(selection: Selection, variables: { [name: string]: any }): Error {
  const errors = selection.directives.map((directive) => {
    const directiveName = directive.name.value;
    const directiveArguments = directive.arguments;
    switch (directiveName) {
      case 'skip':
      case 'include':
        if (directiveArguments.length !== 1) {
          return new Error(`Incorrect number of arguments for the @${directiveName} directive.`);
        }
        const ifArgument = directive.arguments[0];
        if (!ifArgument.name || ifArgument.name.value !== 'if') {
          return new Error(`Invalid argument for the @${directiveName} directive.`);
        }
        const ifValue = directive.arguments[0].value;
        if (!ifValue || ifValue.kind !== 'BooleanValue') {
          if (ifValue.kind !== 'Variable') {
            return new Error(`Argument for the @${directiveName} directive must be a variable or a boolean value.`);
          } else {
            if (variables[(ifValue as Variable).name.value] === undefined) {
              return new Error(`Invalid variable referenced in @${directiveName} directive.`);
            }
          }
        }
        return null;
      case 'apolloFetchMore':
        // TODO: define possible parameters and add constraints
        return null;
      default:
        return new Error(`Directive ${directive.name.value} not supported.`);
    }
  });
  return errors.filter(error => !!error)[0] || null;
}

export function shouldInclude(selection: Selection, variables?: { [name: string]: any }): Boolean {
  if (!variables) {
    variables = {};
  }

  if (!selection.directives) {
    return true;
  }

  let err = checkDirectives(selection, variables);
  if (err) {
    throw err;
  }

  let res: Boolean = true;
  selection.directives.forEach((directive) => {
    const directiveName = directive.name.value;
    if (directiveName !== 'skip' && directiveName !== 'include') {
      return;
    }

    const ifValue = directive.arguments[0].value;
    let evaledValue: Boolean = false;
    if (!ifValue || ifValue.kind !== 'BooleanValue') {
      // means it has to be a variable value if this is a valid @skip or @include directive
      if (ifValue.kind === 'Variable') {
        evaledValue = variables[(ifValue as Variable).name.value];
      }
    } else {
      evaledValue = (ifValue as BooleanValue).value;
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
