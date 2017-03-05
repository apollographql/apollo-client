// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  SelectionNode,
  VariableNode,
  BooleanValueNode,
} from 'graphql';


export function shouldInclude(selection: SelectionNode, variables: { [name: string]: any } = {}): boolean {
  if (!selection.directives) {
    return true;
  }

  let res: boolean = true;
  selection.directives.forEach((directive) => {
    // TODO should move this validation to GraphQL validation once that's implemented.
    if (directive.name.value !== 'skip' && directive.name.value !== 'include') {
      // Just don't worry about directives we don't understand
      return;
    }

    //evaluate the "if" argument and skip (i.e. return undefined) if it evaluates to true.
    const directiveArguments = directive.arguments || [];
    const directiveName = directive.name.value;
    if (directiveArguments.length !== 1) {
      throw new Error(`Incorrect number of arguments for the @${directiveName} directive.`);
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
        throw new Error(`Argument for the @${directiveName} directive must be a variable or a bool ean value.`);
      } else {
        evaledValue = variables[(ifValue as VariableNode).name.value];
        if (evaledValue === undefined) {
          throw new Error(`Invalid variable referenced in @${directiveName} directive.`);
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
