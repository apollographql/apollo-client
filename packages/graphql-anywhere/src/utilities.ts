import { DocumentNode, DirectiveNode } from 'graphql';

import { getInclusionDirectives } from 'apollo-utilities';

import { graphql, VariableMap, ExecInfo, ExecContext } from './graphql';

import { invariant } from 'ts-invariant';

const { hasOwnProperty } = Object.prototype;

export function filter<FD = any, D extends FD = any>(
  doc: DocumentNode,
  data: D,
  variableValues: VariableMap = {},
): FD {
  if (data === null) return data;

  const resolver = (
    fieldName: string,
    root: any,
    args: Object,
    context: ExecContext,
    info: ExecInfo,
  ) => {
    return root[info.resultKey];
  };

  return Array.isArray(data)
    ? data.map(dataObj => graphql(resolver, doc, dataObj, null, variableValues))
    : graphql(resolver, doc, data, null, variableValues);
}

// TODO: we should probably make check call propType and then throw,
// rather than the other way round, to avoid constructing stack traces
// for things like oneOf uses in React. At this stage I doubt many people
// are using this like that, but in the future, who knows?
export function check(
  doc: DocumentNode,
  data: any,
  variables: VariableMap = {},
): void {
  const resolver = (
    fieldName: string,
    root: any,
    args: any,
    context: any,
    info: any,
  ) => {
    // When variables is null, fields with @include/skip directives that
    // reference variables are considered optional.
    invariant(
      hasOwnProperty.call(root, info.resultKey) ||
        (!variables && hasVariableInclusions(info.field.directives)),
      `${info.resultKey} missing on ${JSON.stringify(root)}`,
    );
    return root[info.resultKey];
  };

  graphql(resolver, doc, data, {}, variables, {
    fragmentMatcher: () => false,
  });
}

function hasVariableInclusions(
  directives: ReadonlyArray<DirectiveNode>,
): boolean {
  return getInclusionDirectives(directives).some(
    ({ ifArgument }) =>
      ifArgument.value && ifArgument.value.kind === 'Variable',
  );
}

// Lifted/adapted from
//   https://github.com/facebook/react/blob/master/src/isomorphic/classic/types/ReactPropTypes.js
const ANONYMOUS = '<<anonymous>>';
function PropTypeError(message) {
  this.message = message;
  this.stack = '';
}
// Make `instanceof Error` still work for returned errors.
PropTypeError.prototype = Error.prototype;

const reactPropTypeLocationNames = {
  prop: 'prop',
  context: 'context',
  childContext: 'child context',
};

function createChainableTypeChecker(validate) {
  function checkType(
    isRequired,
    props,
    propName,
    componentName,
    location,
    propFullName,
  ) {
    componentName = componentName || ANONYMOUS;
    propFullName = propFullName || propName;
    if (props[propName] == null) {
      const locationName = reactPropTypeLocationNames[location];
      if (isRequired) {
        if (props[propName] === null) {
          return new PropTypeError(
            `The ${locationName} \`${propFullName}\` is marked as required ` +
              `in \`${componentName}\`, but its value is \`null\`.`,
          );
        }
        return new PropTypeError(
          `The ${locationName} \`${propFullName}\` is marked as required in ` +
            `\`${componentName}\`, but its value is \`undefined\`.`,
        );
      }
      return null;
    } else {
      return validate(props, propName, componentName, location, propFullName);
    }
  }

  const chainedCheckType = checkType.bind(null, false);
  chainedCheckType.isRequired = checkType.bind(null, true);

  return chainedCheckType;
}

export function propType(
  doc: DocumentNode,
  mapPropsToVariables = props => null,
) {
  return createChainableTypeChecker((props, propName) => {
    const prop = props[propName];
    try {
      if (!prop.loading) {
        check(doc, prop, mapPropsToVariables(props));
      }
      return null;
    } catch (e) {
      // Need a much better error.
      // Also we aren't checking for extra fields
      return e;
    }
  });
}
