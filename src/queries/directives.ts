// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  Selection,
  Variable,
  BooleanValue,
  Directive,
  GraphQLDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLString,
  GraphQLBoolean,
} from 'graphql';

const apolloFetchMoreDirective = new GraphQLDirective(({
  name: 'apolloFetchMore',
  description: 'Directs the Apollo store to treat this field as a paginated list.',
  locations: ['FIELD'],
  args: {
    name: {
      type: GraphQLString,
      description: 'A reference to the paginated field',
    },
    quiet: {
      type: GraphQLString,
      description: 'Comma-separated list of field arguments to ignore when writing into the store.',
    },
    prepend: {
      type: GraphQLBoolean,
      description: 'When adding new elements, prepend into the list instead of appending.',
    },
    orderBy: {
      type: GraphQLString,
      description: 'Subfield used for reordering alphabetically the results when new arrives.',
    },
    desc: {
      type: GraphQLBoolean,
      description: 'Reverse the order.',
    },
  },
} as any));

const DEFAULT_DIRECTIVES: GraphQLDirective[] = [
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
  GraphQLDeprecatedDirective,
  apolloFetchMoreDirective,
];

export function validateDirective(
  selection: Selection, variables: any, directive: Directive,
  availDirectives: GraphQLDirective[]
) {
  const matchedDirectiveDef = availDirectives
  .filter(dirDef => dirDef.name === directive.name.value)[0] || null;
  if (!matchedDirectiveDef) {
    throw new Error(`Directive ${directive.name.value} not supported.`);
  }
  const presentArgs = directive.arguments.map(arg => {
    const matchedArgDef = matchedDirectiveDef.args
    .filter(argDef => argDef.name === arg.name.value)[0] || null;
    if (!matchedArgDef) {
      throw new Error(`Invalid argument ${arg.name.value} for the @${directive.name.value} directive.`);
    }
    const matchedType = (matchedArgDef.type as GraphQLNonNull).ofType || matchedArgDef.type;
    // TODO: handle more complex input fields
    if (matchedType instanceof GraphQLScalarType && arg.value.kind !== 'Variable') {
      if (matchedType.toString() + 'Value' !== arg.value.kind) {
        throw new Error(`Argument for the @${directive.name.value} directive must be a variable or a ${matchedType.toString()} value.`);
      }
    } else if (arg.value.kind === 'Variable') {
      if (variables[(arg.value as Variable).name.value] === undefined) {
        throw new Error(`Variable ${(arg.value as Variable).name.value}  not found in context.`);
      }
    }
    return arg.name.value;
  });
  matchedDirectiveDef.args.forEach(argDef => {
    if (argDef.type instanceof GraphQLNonNull && presentArgs.indexOf(argDef.name) < 0) {
      throw new Error(`Required argument ${argDef.name} not present in @${directive.name.value} directive.`);
    }
  });
}

export function validateSelectionDirectives(
  selection: Selection, variables: any = {},
  directives: GraphQLDirective[] = DEFAULT_DIRECTIVES
) {
  if (selection.directives) {
    selection.directives.forEach(dir => validateDirective(selection, variables, dir, directives));
  }
}

export function shouldInclude(selection: Selection, variables?: { [name: string]: any }): Boolean {
  if (!variables) {
    variables = {};
  }

  if (!selection.directives) {
    return true;
  }

  validateSelectionDirectives(selection, variables);

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
