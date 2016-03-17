import RelayQLTransformer from 'babel-relay-plugin/lib/RelayQLTransformer';
const {utilities_buildClientSchema: {buildClientSchema}} = require('babel-relay-plugin/lib/GraphQL');
import invariant from 'babel-relay-plugin/lib/invariant';
import RelayQLPrinter from 'babel-relay-plugin/lib/RelayQLPrinter';
import { introspectionQuery } from 'graphql/utilities/introspectionQuery';
import Relay from 'react-relay';
import generateHash from 'babel-relay-plugin/lib/generateHash';

function getSchema(schemaProvider: GraphQLSchemaProvider): GraphQLSchema {
  const introspection = typeof schemaProvider === 'function' ?
    schemaProvider() :
    schemaProvider;
  invariant(
    typeof introspection === 'object' && introspection &&
    typeof introspection.__schema === 'object' && introspection.__schema,
    'Invalid introspection data supplied to `getBabelRelayPlugin()`. The ' +
    'resulting schema is not an object with a `__schema` property.'
  );
  return buildClientSchema(introspection);
}

let fragmentIndex = 0;
const fragmentCache = {};

function encodeFragmentIndex(index) {
  return '$$$' + index + '$$$';
}

const t = {
  arrayExpression(array) {
    return array;
  },
  nullLiteral() {
    return null;
  },
  valueToNode(value) {
    return value;
  },
  objectExpression(propertyArray) {
    const obj = {};

    propertyArray.forEach((property) => {
      if (property.value.__identifier) {
        throw new Error("Don't support identifiers yet");
      }

      obj[property.key] = property.value;
    });

    return obj;
  },
  identifier(identifierName) {
    return {
      __identifier: identifierName
    };
  },
  objectProperty(nameIdentifier, value) {
    return {
      key: nameIdentifier.__identifier,
      value: value
    };
  },

  // Only used once, to return a definition object in `print`
  returnStatement(expressionToReturn) {
    return {
      __fakeReturnStatement: expressionToReturn
    };
  },

  // Used twice - for runtime errors, and to return a definition object in `print`
  blockStatement(arrayOfStatements) {
    return {
      __fakeBlockStatement: arrayOfStatements
    };
  },

  functionExpression(name, substitutionIdentifiers, printedDocumentReturnBlockStatement) {
    const query = printedDocumentReturnBlockStatement.__fakeBlockStatement[0].__fakeReturnStatement;

    const querySubstitutionFunction = function () {
      return query;
    }

    return querySubstitutionFunction;
  },

  callExpression(func, args) {
    // Try to hackily identify shallowFlatten
    if (args && args.length === 2) {
      return [].concat.apply([], args[1]);
    }

    if (args && args.length > 0) { throw new Error("Args not implemented lol") }

    return func();
  },

  memberExpression(members) {
    return {
      __fakeMemberExpression: members
    };
  }
};

export function initTemplateStringTransformer(schemaJson) {
  const schema = getSchema(schemaJson);
  const transformer = new RelayQLTransformer(schema, {});

  function templateStringTag(quasis, ...expressions) {
    const processedTemplateLiteral = processTemplateLiteral(quasis, expressions, 'queryName');

    const processedTemplateText = transformer.processTemplateText(processedTemplateLiteral.templateText, {
      documentName: 'queryName',
      propName: 'propName'
    });

    const definition = transformer.processDocumentText(processedTemplateText, {
      documentName: 'queryName',
      propName: 'propName',
      fragmentLocationID: generateHash(JSON.stringify(processedTemplateText)).substring(0, 12)
    });

    const options = {};
    const Printer = RelayQLPrinter(t, options);

    modifyPrinterClass(Printer);

    const printed = new Printer('wtf??', {})
      .print(definition, []);

    return printed;
  }

  return templateStringTag;
}

// Attempted lift from https://github.com/facebook/relay/blob/0be965c3c92c48499b452e953d823837838df962/scripts/babel-relay-plugin/src/RelayQLTransformer.js#L114-L148
// Returns { substitutions, templateText, variableNames }
// Who knows why they are called quasis??
function processTemplateLiteral(quasis, expressions, documentName) {
  const chunks = [];
  const variableNames = {};
  const substitutions = [];

  quasis.forEach((chunk, ii) => {
    chunks.push(chunk);

    if (ii !== quasis.length - 1) {
      const name = 'RQL_' + ii;
      const value = expressions[ii];

      runtime.fragments[name] = value;

      substitutions.push({name, value});

      if (/:\s*$/.test(chunk)) {
        invariant(
          false, // this.options.substituteVariables,
          'You supplied a GraphQL document named `%s` that uses template ' +
          'substitution for an argument value, but variable substitution ' +
          'has not been enabled.',
          documentName
        );
        chunks.push('$' + name);
        variableNames[name] = undefined;
      } else {
        chunks.push('...' + name);
      }
    }
  });

  return {substitutions, templateText: chunks.join('').trim(), variableNames};
}

// Override certain functions on the printer
function modifyPrinterClass(printer) {
  printer.prototype.printFragmentReference = function (fragmentReference) {
    return [].concat.apply([], [Relay.QL.__frag(runtime.getFragment(fragmentReference.getName()))]);
  }
}

const runtime = {
  fragments: {},
  getFragment(name) {
    const frag = this.fragments[name];
    delete this.fragments[name];
    return frag;
  }
}

// Eventually improve this to support old services like GraphiQL does.
export function initTemplateStringTransformerFromUrl(url, callback) {
  graphQLFetcher(url, { query: introspectionQuery }).then(result => {
    const schemaJson = result.data;
    callback(initTemplateStringTransformer(schemaJson));
  });
}

function graphQLFetcher(url, graphQLParams) {
  return fetch(url, {
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(graphQLParams),
    credentials: 'include',
  }).then(function (response) {
    return response.text();
  }).then(function (responseBody) {
    try {
      return JSON.parse(responseBody);
    } catch (error) {
      return responseBody;
    }
  });
}
