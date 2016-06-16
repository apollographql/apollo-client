// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  Selection,
  Variable,
  BooleanValue,
  Directive,
} from 'graphql';

export function evaluateSkipInclude(directive: Directive, variables: { [name: string]: any }): Boolean {
  //evaluate the "if" argument and skip (i.e. return undefined) if it evaluates to true.
  const directiveArguments = directive.arguments;
  if (directiveArguments.length !== 1) {
    throw new Error(`Incorrect number of arguments for the @$(directiveName} directive.`);
  }

  const directiveName = directive.name.value;
  const ifArgument = directive.arguments[0];
  if (!ifArgument.name || ifArgument.name.value !== 'if') {
    throw new Error(`Invalid argument for the @${directiveName} directive.`);
  }

  const ifValue = directive.arguments[0].value;
  let evaledValue: Boolean = false;
  if (!ifValue || ifValue.kind !== 'BooleanValue') {
    // means it has to be a variable value if this is a valid @skip or @include directive
    if (ifValue.kind !== 'Variable') {
      throw new Error(`Invalid argument value for the @${directiveName} directive.`);
    } else {
      evaledValue = variables[(ifValue as Variable).name.value];
      if (evaledValue === undefined) {
        throw new Error(`Invalid variable referenced in @${directiveName} directive.`);
      }
    }
  } else {
    evaledValue = (ifValue as BooleanValue).value;
  }

  if (directiveName === 'skip') {
    evaledValue = !evaledValue;
  }

  return evaledValue;
}

export function shouldInclude(selection: Selection, variables?: { [name: string]: any }): Boolean {
  if (!variables) {
    variables = {};
  }

  if (!selection.directives) {
    return true;
  }

  let res: Boolean = true;
  selection.directives.map((directive) => {
    if (directive.name.value !== 'skip' && directive.name.value !== 'include') {
      throw new Error(`Directive ${directive.name.value} not supported.`);
    }
    if (!evaluateSkipInclude(directive, variables)) {
      res = false;
    }
  });
  return res;
}
