// Provides the methods that allow QueryManager to handle
// the `skip` and `include` directives within GraphQL.
import {
  Selection,
  Variable,
  Directive,
} from 'graphql';

import {
  GraphQLNonNull,
  GraphQLList,
  GraphQLString,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLScalarType,
} from '../util/PseudoGraphQL';

import {
  valueToObjectRepresentation,
} from '../data/storeUtils';

const graphqlSkipDirective = {
  name: 'skip',
  locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGEMENT'],
  args: [
    {
      name: 'if',
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  ],
};

const graphqlIncludeDirective = {
  name: 'include',
  locations: ['FIELD', 'FRAGMENT_SPREAD', 'INLINE_FRAGEMENT'],
  args: [
    {
      name: 'if',
      type: new GraphQLNonNull(GraphQLBoolean),
    },
  ],
};

const apolloFetchMoreDirective = {
  name: 'apolloFetchMore',
  description: 'Directs the Apollo store to treat this field as a paginated list.',
  locations: ['FIELD'],
  args: [
    {
      name: 'name',
      type: GraphQLString,
      description: 'A reference to the paginated field',
    },
    {
      name: 'quiet',
      type: new GraphQLList(GraphQLString),
      description: 'List of field arguments to ignore when writing into the store.',
    },
  ],
};

const DEFAULT_DIRECTIVES: GraphQLDirective[] = [
  apolloFetchMoreDirective,
  graphqlSkipDirective,
  graphqlIncludeDirective,
];

function validateDirective(
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
    const matchedType = matchedArgDef.type instanceof GraphQLNonNull ?
      (matchedArgDef.type as GraphQLNonNull).ofType :
      matchedArgDef.type;
    // TODO: handle more complex input fields
    if (matchedType instanceof GraphQLScalarType && arg.value.kind !== 'Variable') {
      if (matchedType.toString() + 'Value' !== arg.value.kind) {
        throw new Error(
          `Argument ${arg.name.value} for the @${directive.name.value} directive must be a variable or a ${matchedType.toString()} value.`
        );
      }
    } else if (matchedType instanceof GraphQLList && arg.value.kind !== 'Variable') {
      if (arg.value.kind !== 'ListValue') {
        throw new Error(`Argument ${arg.name.value} for the @${directive.name.value} directive must be a variable or a List value.`);
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

export function getDirectiveArgs(
  selection: Selection, directiveName: string, variables: any = {}
): any {
  if (!selection.directives) {
    return null;
  }

  const directive = selection.directives
    .filter(dir => dir.name.value === directiveName)[0] || null;

  if (!directive) {
    return null;
  }

  let args = {};
  directive.arguments.forEach(arg => {
    valueToObjectRepresentation(args, arg.name, arg.value, variables);
  });
  return args;
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
