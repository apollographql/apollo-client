import {
  DocumentNode,
  SelectionSetNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from 'graphql';

import {
  getMainDefinition,
  getFragmentDefinitions,
  createFragmentMap,
  shouldInclude,
  getDirectiveInfoFromField,
  isField,
  isInlineFragment,
  resultKeyNameFromField,
  argumentsObjectFromField,
} from 'apollo-utilities';

import {
  merge,
  Resolver,
  VariableMap,
  ExecContext,
  ExecInfo,
  ExecOptions,
} from './graphql';

/* Based on graphql function from graphql-js:
 *
 * graphql(
 *   schema: GraphQLSchema,
 *   requestString: string,
 *   rootValue?: ?any,
 *   contextValue?: ?any,
 *   variableValues?: ?{[key: string]: any},
 *   operationName?: ?string
 * ): Promise<GraphQLResult>
 *
 * The default export as of graphql-anywhere is sync as of 4.0,
 * but below is an exported alternative that is async.
 * In the 5.0 version, this will be the only export again
 * and it will be async
 */
export function graphql(
  resolver: Resolver,
  document: DocumentNode,
  rootValue?: any,
  contextValue?: any,
  variableValues?: VariableMap,
  execOptions: ExecOptions = {},
): Promise<null | Object> {
  const mainDefinition = getMainDefinition(document);

  const fragments = getFragmentDefinitions(document);
  const fragmentMap = createFragmentMap(fragments);

  const resultMapper = execOptions.resultMapper;

  // Default matcher always matches all fragments
  const fragmentMatcher = execOptions.fragmentMatcher || (() => true);

  const execContext: ExecContext = {
    fragmentMap,
    contextValue,
    variableValues,
    resultMapper,
    resolver,
    fragmentMatcher,
  };

  return executeSelectionSet(
    mainDefinition.selectionSet,
    rootValue,
    execContext,
  );
}

async function executeSelectionSet(
  selectionSet: SelectionSetNode,
  rootValue: any,
  execContext: ExecContext,
) {
  const { fragmentMap, contextValue, variableValues: variables } = execContext;

  const result = {};

  const execute = async selection => {
    if (!shouldInclude(selection, variables)) {
      // Skip this entirely
      return;
    }

    if (isField(selection)) {
      const fieldResult = await executeField(selection, rootValue, execContext);

      const resultFieldKey = resultKeyNameFromField(selection);

      if (fieldResult !== undefined) {
        if (result[resultFieldKey] === undefined) {
          result[resultFieldKey] = fieldResult;
        } else {
          merge(result[resultFieldKey], fieldResult);
        }
      }

      return;
    }

    let fragment: InlineFragmentNode | FragmentDefinitionNode;

    if (isInlineFragment(selection)) {
      fragment = selection;
    } else {
      // This is a named fragment
      fragment = fragmentMap[selection.name.value];

      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}`);
      }
    }

    const typeCondition = fragment.typeCondition.name.value;

    if (execContext.fragmentMatcher(rootValue, typeCondition, contextValue)) {
      const fragmentResult = await executeSelectionSet(
        fragment.selectionSet,
        rootValue,
        execContext,
      );

      merge(result, fragmentResult);
    }
  };

  await Promise.all(selectionSet.selections.map(execute));

  if (execContext.resultMapper) {
    return execContext.resultMapper(result, rootValue);
  }

  return result;
}

async function executeField(
  field: FieldNode,
  rootValue: any,
  execContext: ExecContext,
): Promise<null | Object> {
  const { variableValues: variables, contextValue, resolver } = execContext;

  const fieldName = field.name.value;
  const args = argumentsObjectFromField(field, variables);

  const info: ExecInfo = {
    isLeaf: !field.selectionSet,
    resultKey: resultKeyNameFromField(field),
    directives: getDirectiveInfoFromField(field, variables),
    field,
  };

  const result = await resolver(fieldName, rootValue, args, contextValue, info);

  // Handle all scalar types here
  if (!field.selectionSet) {
    return result;
  }

  // From here down, the field has a selection set, which means it's trying to
  // query a GraphQLObjectType
  if (result == null) {
    // Basically any field in a GraphQL response can be null, or missing
    return result;
  }

  if (Array.isArray(result)) {
    return executeSubSelectedArray(field, result, execContext);
  }

  // Returned value is an object, and the query has a sub-selection. Recurse.
  return executeSelectionSet(field.selectionSet, result, execContext);
}

function executeSubSelectedArray(field, result, execContext) {
  return Promise.all(
    result.map(item => {
      // null value in array
      if (item === null) {
        return null;
      }

      // This is a nested array, recurse
      if (Array.isArray(item)) {
        return executeSubSelectedArray(field, item, execContext);
      }

      // This is an object, run the selection set on it
      return executeSelectionSet(field.selectionSet, item, execContext);
    }),
  );
}
