import { DocumentNode } from 'graphql';

import { graphql } from './graphql';

export function filter(doc: DocumentNode, data: any): any {
  const resolver = (
    fieldName: string,
    root: any,
    args: any,
    context: any,
    info: any,
  ) => {
    return root[info.resultKey];
  };

  return graphql(resolver, doc, data);
}

// TODO: we should probably make check call propType and then throw,
// rather than the other way round, to avoid constructing stack traces
// for things like oneOf uses in React. At this stage I doubt many people
// are using this like that, but in the future, who knows?
export function check(doc: DocumentNode, data: any): void {
  const resolver = (
    fieldName: string,
    root: any,
    args: any,
    context: any,
    info: any,
  ) => {
    if (!{}.hasOwnProperty.call(root, info.resultKey)) {
      throw new Error(`${info.resultKey} missing on ${root}`);
    }
    return root[info.resultKey];
  };

  graphql(
    resolver,
    doc,
    data,
    {},
    {},
    {
      fragmentMatcher: () => false,
    },
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

export function propType(doc) {
  return createChainableTypeChecker((props, propName) => {
    const prop = props[propName];
    try {
      check(doc, prop);
      return null;
    } catch (e) {
      // Need a much better error.
      // Also we aren't checking for extra fields
      return e;
    }
  });
}
