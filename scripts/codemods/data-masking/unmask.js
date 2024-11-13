"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/graphql/version.js
var require_version = __commonJS({
  "node_modules/graphql/version.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.versionInfo = exports2.version = void 0;
    var version = "16.9.0";
    exports2.version = version;
    var versionInfo = Object.freeze({
      major: 16,
      minor: 9,
      patch: 0,
      preReleaseTag: null
    });
    exports2.versionInfo = versionInfo;
  }
});

// node_modules/graphql/jsutils/devAssert.js
var require_devAssert = __commonJS({
  "node_modules/graphql/jsutils/devAssert.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.devAssert = devAssert;
    function devAssert(condition, message) {
      const booleanCondition = Boolean(condition);
      if (!booleanCondition) {
        throw new Error(message);
      }
    }
  }
});

// node_modules/graphql/jsutils/isPromise.js
var require_isPromise = __commonJS({
  "node_modules/graphql/jsutils/isPromise.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.isPromise = isPromise;
    function isPromise(value) {
      return typeof (value === null || value === void 0 ? void 0 : value.then) === "function";
    }
  }
});

// node_modules/graphql/jsutils/isObjectLike.js
var require_isObjectLike = __commonJS({
  "node_modules/graphql/jsutils/isObjectLike.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.isObjectLike = isObjectLike;
    function isObjectLike(value) {
      return typeof value == "object" && value !== null;
    }
  }
});

// node_modules/graphql/jsutils/invariant.js
var require_invariant = __commonJS({
  "node_modules/graphql/jsutils/invariant.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.invariant = invariant;
    function invariant(condition, message) {
      const booleanCondition = Boolean(condition);
      if (!booleanCondition) {
        throw new Error(
          message != null ? message : "Unexpected invariant triggered."
        );
      }
    }
  }
});

// node_modules/graphql/language/location.js
var require_location = __commonJS({
  "node_modules/graphql/language/location.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.getLocation = getLocation;
    var _invariant = require_invariant();
    var LineRegExp = /\r\n|[\n\r]/g;
    function getLocation(source, position) {
      let lastLineStart = 0;
      let line = 1;
      for (const match of source.body.matchAll(LineRegExp)) {
        typeof match.index === "number" || (0, _invariant.invariant)(false);
        if (match.index >= position) {
          break;
        }
        lastLineStart = match.index + match[0].length;
        line += 1;
      }
      return {
        line,
        column: position + 1 - lastLineStart
      };
    }
  }
});

// node_modules/graphql/language/printLocation.js
var require_printLocation = __commonJS({
  "node_modules/graphql/language/printLocation.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.printLocation = printLocation;
    exports2.printSourceLocation = printSourceLocation;
    var _location = require_location();
    function printLocation(location) {
      return printSourceLocation(
        location.source,
        (0, _location.getLocation)(location.source, location.start)
      );
    }
    function printSourceLocation(source, sourceLocation) {
      const firstLineColumnOffset = source.locationOffset.column - 1;
      const body = "".padStart(firstLineColumnOffset) + source.body;
      const lineIndex = sourceLocation.line - 1;
      const lineOffset = source.locationOffset.line - 1;
      const lineNum = sourceLocation.line + lineOffset;
      const columnOffset = sourceLocation.line === 1 ? firstLineColumnOffset : 0;
      const columnNum = sourceLocation.column + columnOffset;
      const locationStr = `${source.name}:${lineNum}:${columnNum}
`;
      const lines = body.split(/\r\n|[\n\r]/g);
      const locationLine = lines[lineIndex];
      if (locationLine.length > 120) {
        const subLineIndex = Math.floor(columnNum / 80);
        const subLineColumnNum = columnNum % 80;
        const subLines = [];
        for (let i = 0; i < locationLine.length; i += 80) {
          subLines.push(locationLine.slice(i, i + 80));
        }
        return locationStr + printPrefixedLines([
          [`${lineNum} |`, subLines[0]],
          ...subLines.slice(1, subLineIndex + 1).map((subLine) => ["|", subLine]),
          ["|", "^".padStart(subLineColumnNum)],
          ["|", subLines[subLineIndex + 1]]
        ]);
      }
      return locationStr + printPrefixedLines([
        // Lines specified like this: ["prefix", "string"],
        [`${lineNum - 1} |`, lines[lineIndex - 1]],
        [`${lineNum} |`, locationLine],
        ["|", "^".padStart(columnNum)],
        [`${lineNum + 1} |`, lines[lineIndex + 1]]
      ]);
    }
    function printPrefixedLines(lines) {
      const existingLines = lines.filter(([_, line]) => line !== void 0);
      const padLen = Math.max(...existingLines.map(([prefix]) => prefix.length));
      return existingLines.map(([prefix, line]) => prefix.padStart(padLen) + (line ? " " + line : "")).join("\n");
    }
  }
});

// node_modules/graphql/error/GraphQLError.js
var require_GraphQLError = __commonJS({
  "node_modules/graphql/error/GraphQLError.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.GraphQLError = void 0;
    exports2.formatError = formatError;
    exports2.printError = printError;
    var _isObjectLike = require_isObjectLike();
    var _location = require_location();
    var _printLocation = require_printLocation();
    function toNormalizedOptions(args) {
      const firstArg = args[0];
      if (firstArg == null || "kind" in firstArg || "length" in firstArg) {
        return {
          nodes: firstArg,
          source: args[1],
          positions: args[2],
          path: args[3],
          originalError: args[4],
          extensions: args[5]
        };
      }
      return firstArg;
    }
    var GraphQLError = class _GraphQLError extends Error {
      /**
       * An array of `{ line, column }` locations within the source GraphQL document
       * which correspond to this error.
       *
       * Errors during validation often contain multiple locations, for example to
       * point out two things with the same name. Errors during execution include a
       * single location, the field which produced the error.
       *
       * Enumerable, and appears in the result of JSON.stringify().
       */
      /**
       * An array describing the JSON-path into the execution response which
       * corresponds to this error. Only included for errors during execution.
       *
       * Enumerable, and appears in the result of JSON.stringify().
       */
      /**
       * An array of GraphQL AST Nodes corresponding to this error.
       */
      /**
       * The source GraphQL document for the first location of this error.
       *
       * Note that if this Error represents more than one node, the source may not
       * represent nodes after the first node.
       */
      /**
       * An array of character offsets within the source GraphQL document
       * which correspond to this error.
       */
      /**
       * The original error thrown from a field resolver during execution.
       */
      /**
       * Extension fields to add to the formatted error.
       */
      /**
       * @deprecated Please use the `GraphQLErrorOptions` constructor overload instead.
       */
      constructor(message, ...rawArgs) {
        var _this$nodes, _nodeLocations$, _ref;
        const { nodes, source, positions, path: path2, originalError, extensions } = toNormalizedOptions(rawArgs);
        super(message);
        this.name = "GraphQLError";
        this.path = path2 !== null && path2 !== void 0 ? path2 : void 0;
        this.originalError = originalError !== null && originalError !== void 0 ? originalError : void 0;
        this.nodes = undefinedIfEmpty(
          Array.isArray(nodes) ? nodes : nodes ? [nodes] : void 0
        );
        const nodeLocations = undefinedIfEmpty(
          (_this$nodes = this.nodes) === null || _this$nodes === void 0 ? void 0 : _this$nodes.map((node) => node.loc).filter((loc) => loc != null)
        );
        this.source = source !== null && source !== void 0 ? source : nodeLocations === null || nodeLocations === void 0 ? void 0 : (_nodeLocations$ = nodeLocations[0]) === null || _nodeLocations$ === void 0 ? void 0 : _nodeLocations$.source;
        this.positions = positions !== null && positions !== void 0 ? positions : nodeLocations === null || nodeLocations === void 0 ? void 0 : nodeLocations.map((loc) => loc.start);
        this.locations = positions && source ? positions.map((pos) => (0, _location.getLocation)(source, pos)) : nodeLocations === null || nodeLocations === void 0 ? void 0 : nodeLocations.map(
          (loc) => (0, _location.getLocation)(loc.source, loc.start)
        );
        const originalExtensions = (0, _isObjectLike.isObjectLike)(
          originalError === null || originalError === void 0 ? void 0 : originalError.extensions
        ) ? originalError === null || originalError === void 0 ? void 0 : originalError.extensions : void 0;
        this.extensions = (_ref = extensions !== null && extensions !== void 0 ? extensions : originalExtensions) !== null && _ref !== void 0 ? _ref : /* @__PURE__ */ Object.create(null);
        Object.defineProperties(this, {
          message: {
            writable: true,
            enumerable: true
          },
          name: {
            enumerable: false
          },
          nodes: {
            enumerable: false
          },
          source: {
            enumerable: false
          },
          positions: {
            enumerable: false
          },
          originalError: {
            enumerable: false
          }
        });
        if (originalError !== null && originalError !== void 0 && originalError.stack) {
          Object.defineProperty(this, "stack", {
            value: originalError.stack,
            writable: true,
            configurable: true
          });
        } else if (Error.captureStackTrace) {
          Error.captureStackTrace(this, _GraphQLError);
        } else {
          Object.defineProperty(this, "stack", {
            value: Error().stack,
            writable: true,
            configurable: true
          });
        }
      }
      get [Symbol.toStringTag]() {
        return "GraphQLError";
      }
      toString() {
        let output = this.message;
        if (this.nodes) {
          for (const node of this.nodes) {
            if (node.loc) {
              output += "\n\n" + (0, _printLocation.printLocation)(node.loc);
            }
          }
        } else if (this.source && this.locations) {
          for (const location of this.locations) {
            output += "\n\n" + (0, _printLocation.printSourceLocation)(this.source, location);
          }
        }
        return output;
      }
      toJSON() {
        const formattedError = {
          message: this.message
        };
        if (this.locations != null) {
          formattedError.locations = this.locations;
        }
        if (this.path != null) {
          formattedError.path = this.path;
        }
        if (this.extensions != null && Object.keys(this.extensions).length > 0) {
          formattedError.extensions = this.extensions;
        }
        return formattedError;
      }
    };
    exports2.GraphQLError = GraphQLError;
    function undefinedIfEmpty(array) {
      return array === void 0 || array.length === 0 ? void 0 : array;
    }
    function printError(error) {
      return error.toString();
    }
    function formatError(error) {
      return error.toJSON();
    }
  }
});

// node_modules/graphql/error/syntaxError.js
var require_syntaxError = __commonJS({
  "node_modules/graphql/error/syntaxError.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.syntaxError = syntaxError;
    var _GraphQLError = require_GraphQLError();
    function syntaxError(source, position, description) {
      return new _GraphQLError.GraphQLError(`Syntax Error: ${description}`, {
        source,
        positions: [position]
      });
    }
  }
});

// node_modules/graphql/language/ast.js
var require_ast = __commonJS({
  "node_modules/graphql/language/ast.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.Token = exports2.QueryDocumentKeys = exports2.OperationTypeNode = exports2.Location = void 0;
    exports2.isNode = isNode;
    var Location = class {
      /**
       * The character offset at which this Node begins.
       */
      /**
       * The character offset at which this Node ends.
       */
      /**
       * The Token at which this Node begins.
       */
      /**
       * The Token at which this Node ends.
       */
      /**
       * The Source document the AST represents.
       */
      constructor(startToken, endToken, source) {
        this.start = startToken.start;
        this.end = endToken.end;
        this.startToken = startToken;
        this.endToken = endToken;
        this.source = source;
      }
      get [Symbol.toStringTag]() {
        return "Location";
      }
      toJSON() {
        return {
          start: this.start,
          end: this.end
        };
      }
    };
    exports2.Location = Location;
    var Token = class {
      /**
       * The kind of Token.
       */
      /**
       * The character offset at which this Node begins.
       */
      /**
       * The character offset at which this Node ends.
       */
      /**
       * The 1-indexed line number on which this Token appears.
       */
      /**
       * The 1-indexed column number at which this Token begins.
       */
      /**
       * For non-punctuation tokens, represents the interpreted value of the token.
       *
       * Note: is undefined for punctuation tokens, but typed as string for
       * convenience in the parser.
       */
      /**
       * Tokens exist as nodes in a double-linked-list amongst all tokens
       * including ignored tokens. <SOF> is always the first node and <EOF>
       * the last.
       */
      constructor(kind, start, end, line, column, value) {
        this.kind = kind;
        this.start = start;
        this.end = end;
        this.line = line;
        this.column = column;
        this.value = value;
        this.prev = null;
        this.next = null;
      }
      get [Symbol.toStringTag]() {
        return "Token";
      }
      toJSON() {
        return {
          kind: this.kind,
          value: this.value,
          line: this.line,
          column: this.column
        };
      }
    };
    exports2.Token = Token;
    var QueryDocumentKeys = {
      Name: [],
      Document: ["definitions"],
      OperationDefinition: [
        "name",
        "variableDefinitions",
        "directives",
        "selectionSet"
      ],
      VariableDefinition: ["variable", "type", "defaultValue", "directives"],
      Variable: ["name"],
      SelectionSet: ["selections"],
      Field: ["alias", "name", "arguments", "directives", "selectionSet"],
      Argument: ["name", "value"],
      FragmentSpread: ["name", "directives"],
      InlineFragment: ["typeCondition", "directives", "selectionSet"],
      FragmentDefinition: [
        "name",
        // Note: fragment variable definitions are deprecated and will removed in v17.0.0
        "variableDefinitions",
        "typeCondition",
        "directives",
        "selectionSet"
      ],
      IntValue: [],
      FloatValue: [],
      StringValue: [],
      BooleanValue: [],
      NullValue: [],
      EnumValue: [],
      ListValue: ["values"],
      ObjectValue: ["fields"],
      ObjectField: ["name", "value"],
      Directive: ["name", "arguments"],
      NamedType: ["name"],
      ListType: ["type"],
      NonNullType: ["type"],
      SchemaDefinition: ["description", "directives", "operationTypes"],
      OperationTypeDefinition: ["type"],
      ScalarTypeDefinition: ["description", "name", "directives"],
      ObjectTypeDefinition: [
        "description",
        "name",
        "interfaces",
        "directives",
        "fields"
      ],
      FieldDefinition: ["description", "name", "arguments", "type", "directives"],
      InputValueDefinition: [
        "description",
        "name",
        "type",
        "defaultValue",
        "directives"
      ],
      InterfaceTypeDefinition: [
        "description",
        "name",
        "interfaces",
        "directives",
        "fields"
      ],
      UnionTypeDefinition: ["description", "name", "directives", "types"],
      EnumTypeDefinition: ["description", "name", "directives", "values"],
      EnumValueDefinition: ["description", "name", "directives"],
      InputObjectTypeDefinition: ["description", "name", "directives", "fields"],
      DirectiveDefinition: ["description", "name", "arguments", "locations"],
      SchemaExtension: ["directives", "operationTypes"],
      ScalarTypeExtension: ["name", "directives"],
      ObjectTypeExtension: ["name", "interfaces", "directives", "fields"],
      InterfaceTypeExtension: ["name", "interfaces", "directives", "fields"],
      UnionTypeExtension: ["name", "directives", "types"],
      EnumTypeExtension: ["name", "directives", "values"],
      InputObjectTypeExtension: ["name", "directives", "fields"]
    };
    exports2.QueryDocumentKeys = QueryDocumentKeys;
    var kindValues = new Set(Object.keys(QueryDocumentKeys));
    function isNode(maybeNode) {
      const maybeKind = maybeNode === null || maybeNode === void 0 ? void 0 : maybeNode.kind;
      return typeof maybeKind === "string" && kindValues.has(maybeKind);
    }
    var OperationTypeNode;
    exports2.OperationTypeNode = OperationTypeNode;
    (function(OperationTypeNode2) {
      OperationTypeNode2["QUERY"] = "query";
      OperationTypeNode2["MUTATION"] = "mutation";
      OperationTypeNode2["SUBSCRIPTION"] = "subscription";
    })(OperationTypeNode || (exports2.OperationTypeNode = OperationTypeNode = {}));
  }
});

// node_modules/graphql/language/directiveLocation.js
var require_directiveLocation = __commonJS({
  "node_modules/graphql/language/directiveLocation.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.DirectiveLocation = void 0;
    var DirectiveLocation;
    exports2.DirectiveLocation = DirectiveLocation;
    (function(DirectiveLocation2) {
      DirectiveLocation2["QUERY"] = "QUERY";
      DirectiveLocation2["MUTATION"] = "MUTATION";
      DirectiveLocation2["SUBSCRIPTION"] = "SUBSCRIPTION";
      DirectiveLocation2["FIELD"] = "FIELD";
      DirectiveLocation2["FRAGMENT_DEFINITION"] = "FRAGMENT_DEFINITION";
      DirectiveLocation2["FRAGMENT_SPREAD"] = "FRAGMENT_SPREAD";
      DirectiveLocation2["INLINE_FRAGMENT"] = "INLINE_FRAGMENT";
      DirectiveLocation2["VARIABLE_DEFINITION"] = "VARIABLE_DEFINITION";
      DirectiveLocation2["SCHEMA"] = "SCHEMA";
      DirectiveLocation2["SCALAR"] = "SCALAR";
      DirectiveLocation2["OBJECT"] = "OBJECT";
      DirectiveLocation2["FIELD_DEFINITION"] = "FIELD_DEFINITION";
      DirectiveLocation2["ARGUMENT_DEFINITION"] = "ARGUMENT_DEFINITION";
      DirectiveLocation2["INTERFACE"] = "INTERFACE";
      DirectiveLocation2["UNION"] = "UNION";
      DirectiveLocation2["ENUM"] = "ENUM";
      DirectiveLocation2["ENUM_VALUE"] = "ENUM_VALUE";
      DirectiveLocation2["INPUT_OBJECT"] = "INPUT_OBJECT";
      DirectiveLocation2["INPUT_FIELD_DEFINITION"] = "INPUT_FIELD_DEFINITION";
    })(DirectiveLocation || (exports2.DirectiveLocation = DirectiveLocation = {}));
  }
});

// node_modules/graphql/language/kinds.js
var require_kinds = __commonJS({
  "node_modules/graphql/language/kinds.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.Kind = void 0;
    var Kind2;
    exports2.Kind = Kind2;
    (function(Kind3) {
      Kind3["NAME"] = "Name";
      Kind3["DOCUMENT"] = "Document";
      Kind3["OPERATION_DEFINITION"] = "OperationDefinition";
      Kind3["VARIABLE_DEFINITION"] = "VariableDefinition";
      Kind3["SELECTION_SET"] = "SelectionSet";
      Kind3["FIELD"] = "Field";
      Kind3["ARGUMENT"] = "Argument";
      Kind3["FRAGMENT_SPREAD"] = "FragmentSpread";
      Kind3["INLINE_FRAGMENT"] = "InlineFragment";
      Kind3["FRAGMENT_DEFINITION"] = "FragmentDefinition";
      Kind3["VARIABLE"] = "Variable";
      Kind3["INT"] = "IntValue";
      Kind3["FLOAT"] = "FloatValue";
      Kind3["STRING"] = "StringValue";
      Kind3["BOOLEAN"] = "BooleanValue";
      Kind3["NULL"] = "NullValue";
      Kind3["ENUM"] = "EnumValue";
      Kind3["LIST"] = "ListValue";
      Kind3["OBJECT"] = "ObjectValue";
      Kind3["OBJECT_FIELD"] = "ObjectField";
      Kind3["DIRECTIVE"] = "Directive";
      Kind3["NAMED_TYPE"] = "NamedType";
      Kind3["LIST_TYPE"] = "ListType";
      Kind3["NON_NULL_TYPE"] = "NonNullType";
      Kind3["SCHEMA_DEFINITION"] = "SchemaDefinition";
      Kind3["OPERATION_TYPE_DEFINITION"] = "OperationTypeDefinition";
      Kind3["SCALAR_TYPE_DEFINITION"] = "ScalarTypeDefinition";
      Kind3["OBJECT_TYPE_DEFINITION"] = "ObjectTypeDefinition";
      Kind3["FIELD_DEFINITION"] = "FieldDefinition";
      Kind3["INPUT_VALUE_DEFINITION"] = "InputValueDefinition";
      Kind3["INTERFACE_TYPE_DEFINITION"] = "InterfaceTypeDefinition";
      Kind3["UNION_TYPE_DEFINITION"] = "UnionTypeDefinition";
      Kind3["ENUM_TYPE_DEFINITION"] = "EnumTypeDefinition";
      Kind3["ENUM_VALUE_DEFINITION"] = "EnumValueDefinition";
      Kind3["INPUT_OBJECT_TYPE_DEFINITION"] = "InputObjectTypeDefinition";
      Kind3["DIRECTIVE_DEFINITION"] = "DirectiveDefinition";
      Kind3["SCHEMA_EXTENSION"] = "SchemaExtension";
      Kind3["SCALAR_TYPE_EXTENSION"] = "ScalarTypeExtension";
      Kind3["OBJECT_TYPE_EXTENSION"] = "ObjectTypeExtension";
      Kind3["INTERFACE_TYPE_EXTENSION"] = "InterfaceTypeExtension";
      Kind3["UNION_TYPE_EXTENSION"] = "UnionTypeExtension";
      Kind3["ENUM_TYPE_EXTENSION"] = "EnumTypeExtension";
      Kind3["INPUT_OBJECT_TYPE_EXTENSION"] = "InputObjectTypeExtension";
    })(Kind2 || (exports2.Kind = Kind2 = {}));
  }
});

// node_modules/graphql/language/characterClasses.js
var require_characterClasses = __commonJS({
  "node_modules/graphql/language/characterClasses.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.isDigit = isDigit;
    exports2.isLetter = isLetter;
    exports2.isNameContinue = isNameContinue;
    exports2.isNameStart = isNameStart;
    exports2.isWhiteSpace = isWhiteSpace;
    function isWhiteSpace(code) {
      return code === 9 || code === 32;
    }
    function isDigit(code) {
      return code >= 48 && code <= 57;
    }
    function isLetter(code) {
      return code >= 97 && code <= 122 || // A-Z
      code >= 65 && code <= 90;
    }
    function isNameStart(code) {
      return isLetter(code) || code === 95;
    }
    function isNameContinue(code) {
      return isLetter(code) || isDigit(code) || code === 95;
    }
  }
});

// node_modules/graphql/language/blockString.js
var require_blockString = __commonJS({
  "node_modules/graphql/language/blockString.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.dedentBlockStringLines = dedentBlockStringLines;
    exports2.isPrintableAsBlockString = isPrintableAsBlockString;
    exports2.printBlockString = printBlockString;
    var _characterClasses = require_characterClasses();
    function dedentBlockStringLines(lines) {
      var _firstNonEmptyLine2;
      let commonIndent = Number.MAX_SAFE_INTEGER;
      let firstNonEmptyLine = null;
      let lastNonEmptyLine = -1;
      for (let i = 0; i < lines.length; ++i) {
        var _firstNonEmptyLine;
        const line = lines[i];
        const indent = leadingWhitespace(line);
        if (indent === line.length) {
          continue;
        }
        firstNonEmptyLine = (_firstNonEmptyLine = firstNonEmptyLine) !== null && _firstNonEmptyLine !== void 0 ? _firstNonEmptyLine : i;
        lastNonEmptyLine = i;
        if (i !== 0 && indent < commonIndent) {
          commonIndent = indent;
        }
      }
      return lines.map((line, i) => i === 0 ? line : line.slice(commonIndent)).slice(
        (_firstNonEmptyLine2 = firstNonEmptyLine) !== null && _firstNonEmptyLine2 !== void 0 ? _firstNonEmptyLine2 : 0,
        lastNonEmptyLine + 1
      );
    }
    function leadingWhitespace(str) {
      let i = 0;
      while (i < str.length && (0, _characterClasses.isWhiteSpace)(str.charCodeAt(i))) {
        ++i;
      }
      return i;
    }
    function isPrintableAsBlockString(value) {
      if (value === "") {
        return true;
      }
      let isEmptyLine = true;
      let hasIndent = false;
      let hasCommonIndent = true;
      let seenNonEmptyLine = false;
      for (let i = 0; i < value.length; ++i) {
        switch (value.codePointAt(i)) {
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 11:
          case 12:
          case 14:
          case 15:
            return false;
          case 13:
            return false;
          case 10:
            if (isEmptyLine && !seenNonEmptyLine) {
              return false;
            }
            seenNonEmptyLine = true;
            isEmptyLine = true;
            hasIndent = false;
            break;
          case 9:
          case 32:
            hasIndent || (hasIndent = isEmptyLine);
            break;
          default:
            hasCommonIndent && (hasCommonIndent = hasIndent);
            isEmptyLine = false;
        }
      }
      if (isEmptyLine) {
        return false;
      }
      if (hasCommonIndent && seenNonEmptyLine) {
        return false;
      }
      return true;
    }
    function printBlockString(value, options) {
      const escapedValue = value.replace(/"""/g, '\\"""');
      const lines = escapedValue.split(/\r\n|[\n\r]/g);
      const isSingleLine = lines.length === 1;
      const forceLeadingNewLine = lines.length > 1 && lines.slice(1).every(
        (line) => line.length === 0 || (0, _characterClasses.isWhiteSpace)(line.charCodeAt(0))
      );
      const hasTrailingTripleQuotes = escapedValue.endsWith('\\"""');
      const hasTrailingQuote = value.endsWith('"') && !hasTrailingTripleQuotes;
      const hasTrailingSlash = value.endsWith("\\");
      const forceTrailingNewline = hasTrailingQuote || hasTrailingSlash;
      const printAsMultipleLines = !(options !== null && options !== void 0 && options.minimize) && // add leading and trailing new lines only if it improves readability
      (!isSingleLine || value.length > 70 || forceTrailingNewline || forceLeadingNewLine || hasTrailingTripleQuotes);
      let result = "";
      const skipLeadingNewLine = isSingleLine && (0, _characterClasses.isWhiteSpace)(value.charCodeAt(0));
      if (printAsMultipleLines && !skipLeadingNewLine || forceLeadingNewLine) {
        result += "\n";
      }
      result += escapedValue;
      if (printAsMultipleLines || forceTrailingNewline) {
        result += "\n";
      }
      return '"""' + result + '"""';
    }
  }
});

// node_modules/graphql/language/tokenKind.js
var require_tokenKind = __commonJS({
  "node_modules/graphql/language/tokenKind.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.TokenKind = void 0;
    var TokenKind;
    exports2.TokenKind = TokenKind;
    (function(TokenKind2) {
      TokenKind2["SOF"] = "<SOF>";
      TokenKind2["EOF"] = "<EOF>";
      TokenKind2["BANG"] = "!";
      TokenKind2["DOLLAR"] = "$";
      TokenKind2["AMP"] = "&";
      TokenKind2["PAREN_L"] = "(";
      TokenKind2["PAREN_R"] = ")";
      TokenKind2["SPREAD"] = "...";
      TokenKind2["COLON"] = ":";
      TokenKind2["EQUALS"] = "=";
      TokenKind2["AT"] = "@";
      TokenKind2["BRACKET_L"] = "[";
      TokenKind2["BRACKET_R"] = "]";
      TokenKind2["BRACE_L"] = "{";
      TokenKind2["PIPE"] = "|";
      TokenKind2["BRACE_R"] = "}";
      TokenKind2["NAME"] = "Name";
      TokenKind2["INT"] = "Int";
      TokenKind2["FLOAT"] = "Float";
      TokenKind2["STRING"] = "String";
      TokenKind2["BLOCK_STRING"] = "BlockString";
      TokenKind2["COMMENT"] = "Comment";
    })(TokenKind || (exports2.TokenKind = TokenKind = {}));
  }
});

// node_modules/graphql/language/lexer.js
var require_lexer = __commonJS({
  "node_modules/graphql/language/lexer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.Lexer = void 0;
    exports2.isPunctuatorTokenKind = isPunctuatorTokenKind;
    var _syntaxError = require_syntaxError();
    var _ast = require_ast();
    var _blockString = require_blockString();
    var _characterClasses = require_characterClasses();
    var _tokenKind = require_tokenKind();
    var Lexer = class {
      /**
       * The previously focused non-ignored token.
       */
      /**
       * The currently focused non-ignored token.
       */
      /**
       * The (1-indexed) line containing the current token.
       */
      /**
       * The character offset at which the current line begins.
       */
      constructor(source) {
        const startOfFileToken = new _ast.Token(
          _tokenKind.TokenKind.SOF,
          0,
          0,
          0,
          0
        );
        this.source = source;
        this.lastToken = startOfFileToken;
        this.token = startOfFileToken;
        this.line = 1;
        this.lineStart = 0;
      }
      get [Symbol.toStringTag]() {
        return "Lexer";
      }
      /**
       * Advances the token stream to the next non-ignored token.
       */
      advance() {
        this.lastToken = this.token;
        const token = this.token = this.lookahead();
        return token;
      }
      /**
       * Looks ahead and returns the next non-ignored token, but does not change
       * the state of Lexer.
       */
      lookahead() {
        let token = this.token;
        if (token.kind !== _tokenKind.TokenKind.EOF) {
          do {
            if (token.next) {
              token = token.next;
            } else {
              const nextToken = readNextToken(this, token.end);
              token.next = nextToken;
              nextToken.prev = token;
              token = nextToken;
            }
          } while (token.kind === _tokenKind.TokenKind.COMMENT);
        }
        return token;
      }
    };
    exports2.Lexer = Lexer;
    function isPunctuatorTokenKind(kind) {
      return kind === _tokenKind.TokenKind.BANG || kind === _tokenKind.TokenKind.DOLLAR || kind === _tokenKind.TokenKind.AMP || kind === _tokenKind.TokenKind.PAREN_L || kind === _tokenKind.TokenKind.PAREN_R || kind === _tokenKind.TokenKind.SPREAD || kind === _tokenKind.TokenKind.COLON || kind === _tokenKind.TokenKind.EQUALS || kind === _tokenKind.TokenKind.AT || kind === _tokenKind.TokenKind.BRACKET_L || kind === _tokenKind.TokenKind.BRACKET_R || kind === _tokenKind.TokenKind.BRACE_L || kind === _tokenKind.TokenKind.PIPE || kind === _tokenKind.TokenKind.BRACE_R;
    }
    function isUnicodeScalarValue(code) {
      return code >= 0 && code <= 55295 || code >= 57344 && code <= 1114111;
    }
    function isSupplementaryCodePoint(body, location) {
      return isLeadingSurrogate(body.charCodeAt(location)) && isTrailingSurrogate(body.charCodeAt(location + 1));
    }
    function isLeadingSurrogate(code) {
      return code >= 55296 && code <= 56319;
    }
    function isTrailingSurrogate(code) {
      return code >= 56320 && code <= 57343;
    }
    function printCodePointAt(lexer, location) {
      const code = lexer.source.body.codePointAt(location);
      if (code === void 0) {
        return _tokenKind.TokenKind.EOF;
      } else if (code >= 32 && code <= 126) {
        const char = String.fromCodePoint(code);
        return char === '"' ? `'"'` : `"${char}"`;
      }
      return "U+" + code.toString(16).toUpperCase().padStart(4, "0");
    }
    function createToken(lexer, kind, start, end, value) {
      const line = lexer.line;
      const col = 1 + start - lexer.lineStart;
      return new _ast.Token(kind, start, end, line, col, value);
    }
    function readNextToken(lexer, start) {
      const body = lexer.source.body;
      const bodyLength = body.length;
      let position = start;
      while (position < bodyLength) {
        const code = body.charCodeAt(position);
        switch (code) {
          case 65279:
          case 9:
          case 32:
          case 44:
            ++position;
            continue;
          case 10:
            ++position;
            ++lexer.line;
            lexer.lineStart = position;
            continue;
          case 13:
            if (body.charCodeAt(position + 1) === 10) {
              position += 2;
            } else {
              ++position;
            }
            ++lexer.line;
            lexer.lineStart = position;
            continue;
          case 35:
            return readComment(lexer, position);
          case 33:
            return createToken(
              lexer,
              _tokenKind.TokenKind.BANG,
              position,
              position + 1
            );
          case 36:
            return createToken(
              lexer,
              _tokenKind.TokenKind.DOLLAR,
              position,
              position + 1
            );
          case 38:
            return createToken(
              lexer,
              _tokenKind.TokenKind.AMP,
              position,
              position + 1
            );
          case 40:
            return createToken(
              lexer,
              _tokenKind.TokenKind.PAREN_L,
              position,
              position + 1
            );
          case 41:
            return createToken(
              lexer,
              _tokenKind.TokenKind.PAREN_R,
              position,
              position + 1
            );
          case 46:
            if (body.charCodeAt(position + 1) === 46 && body.charCodeAt(position + 2) === 46) {
              return createToken(
                lexer,
                _tokenKind.TokenKind.SPREAD,
                position,
                position + 3
              );
            }
            break;
          case 58:
            return createToken(
              lexer,
              _tokenKind.TokenKind.COLON,
              position,
              position + 1
            );
          case 61:
            return createToken(
              lexer,
              _tokenKind.TokenKind.EQUALS,
              position,
              position + 1
            );
          case 64:
            return createToken(
              lexer,
              _tokenKind.TokenKind.AT,
              position,
              position + 1
            );
          case 91:
            return createToken(
              lexer,
              _tokenKind.TokenKind.BRACKET_L,
              position,
              position + 1
            );
          case 93:
            return createToken(
              lexer,
              _tokenKind.TokenKind.BRACKET_R,
              position,
              position + 1
            );
          case 123:
            return createToken(
              lexer,
              _tokenKind.TokenKind.BRACE_L,
              position,
              position + 1
            );
          case 124:
            return createToken(
              lexer,
              _tokenKind.TokenKind.PIPE,
              position,
              position + 1
            );
          case 125:
            return createToken(
              lexer,
              _tokenKind.TokenKind.BRACE_R,
              position,
              position + 1
            );
          case 34:
            if (body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
              return readBlockString(lexer, position);
            }
            return readString(lexer, position);
        }
        if ((0, _characterClasses.isDigit)(code) || code === 45) {
          return readNumber(lexer, position, code);
        }
        if ((0, _characterClasses.isNameStart)(code)) {
          return readName(lexer, position);
        }
        throw (0, _syntaxError.syntaxError)(
          lexer.source,
          position,
          code === 39 ? `Unexpected single quote character ('), did you mean to use a double quote (")?` : isUnicodeScalarValue(code) || isSupplementaryCodePoint(body, position) ? `Unexpected character: ${printCodePointAt(lexer, position)}.` : `Invalid character: ${printCodePointAt(lexer, position)}.`
        );
      }
      return createToken(lexer, _tokenKind.TokenKind.EOF, bodyLength, bodyLength);
    }
    function readComment(lexer, start) {
      const body = lexer.source.body;
      const bodyLength = body.length;
      let position = start + 1;
      while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if (code === 10 || code === 13) {
          break;
        }
        if (isUnicodeScalarValue(code)) {
          ++position;
        } else if (isSupplementaryCodePoint(body, position)) {
          position += 2;
        } else {
          break;
        }
      }
      return createToken(
        lexer,
        _tokenKind.TokenKind.COMMENT,
        start,
        position,
        body.slice(start + 1, position)
      );
    }
    function readNumber(lexer, start, firstCode) {
      const body = lexer.source.body;
      let position = start;
      let code = firstCode;
      let isFloat = false;
      if (code === 45) {
        code = body.charCodeAt(++position);
      }
      if (code === 48) {
        code = body.charCodeAt(++position);
        if ((0, _characterClasses.isDigit)(code)) {
          throw (0, _syntaxError.syntaxError)(
            lexer.source,
            position,
            `Invalid number, unexpected digit after 0: ${printCodePointAt(
              lexer,
              position
            )}.`
          );
        }
      } else {
        position = readDigits(lexer, position, code);
        code = body.charCodeAt(position);
      }
      if (code === 46) {
        isFloat = true;
        code = body.charCodeAt(++position);
        position = readDigits(lexer, position, code);
        code = body.charCodeAt(position);
      }
      if (code === 69 || code === 101) {
        isFloat = true;
        code = body.charCodeAt(++position);
        if (code === 43 || code === 45) {
          code = body.charCodeAt(++position);
        }
        position = readDigits(lexer, position, code);
        code = body.charCodeAt(position);
      }
      if (code === 46 || (0, _characterClasses.isNameStart)(code)) {
        throw (0, _syntaxError.syntaxError)(
          lexer.source,
          position,
          `Invalid number, expected digit but got: ${printCodePointAt(
            lexer,
            position
          )}.`
        );
      }
      return createToken(
        lexer,
        isFloat ? _tokenKind.TokenKind.FLOAT : _tokenKind.TokenKind.INT,
        start,
        position,
        body.slice(start, position)
      );
    }
    function readDigits(lexer, start, firstCode) {
      if (!(0, _characterClasses.isDigit)(firstCode)) {
        throw (0, _syntaxError.syntaxError)(
          lexer.source,
          start,
          `Invalid number, expected digit but got: ${printCodePointAt(
            lexer,
            start
          )}.`
        );
      }
      const body = lexer.source.body;
      let position = start + 1;
      while ((0, _characterClasses.isDigit)(body.charCodeAt(position))) {
        ++position;
      }
      return position;
    }
    function readString(lexer, start) {
      const body = lexer.source.body;
      const bodyLength = body.length;
      let position = start + 1;
      let chunkStart = position;
      let value = "";
      while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if (code === 34) {
          value += body.slice(chunkStart, position);
          return createToken(
            lexer,
            _tokenKind.TokenKind.STRING,
            start,
            position + 1,
            value
          );
        }
        if (code === 92) {
          value += body.slice(chunkStart, position);
          const escape = body.charCodeAt(position + 1) === 117 ? body.charCodeAt(position + 2) === 123 ? readEscapedUnicodeVariableWidth(lexer, position) : readEscapedUnicodeFixedWidth(lexer, position) : readEscapedCharacter(lexer, position);
          value += escape.value;
          position += escape.size;
          chunkStart = position;
          continue;
        }
        if (code === 10 || code === 13) {
          break;
        }
        if (isUnicodeScalarValue(code)) {
          ++position;
        } else if (isSupplementaryCodePoint(body, position)) {
          position += 2;
        } else {
          throw (0, _syntaxError.syntaxError)(
            lexer.source,
            position,
            `Invalid character within String: ${printCodePointAt(
              lexer,
              position
            )}.`
          );
        }
      }
      throw (0, _syntaxError.syntaxError)(
        lexer.source,
        position,
        "Unterminated string."
      );
    }
    function readEscapedUnicodeVariableWidth(lexer, position) {
      const body = lexer.source.body;
      let point = 0;
      let size = 3;
      while (size < 12) {
        const code = body.charCodeAt(position + size++);
        if (code === 125) {
          if (size < 5 || !isUnicodeScalarValue(point)) {
            break;
          }
          return {
            value: String.fromCodePoint(point),
            size
          };
        }
        point = point << 4 | readHexDigit(code);
        if (point < 0) {
          break;
        }
      }
      throw (0, _syntaxError.syntaxError)(
        lexer.source,
        position,
        `Invalid Unicode escape sequence: "${body.slice(
          position,
          position + size
        )}".`
      );
    }
    function readEscapedUnicodeFixedWidth(lexer, position) {
      const body = lexer.source.body;
      const code = read16BitHexCode(body, position + 2);
      if (isUnicodeScalarValue(code)) {
        return {
          value: String.fromCodePoint(code),
          size: 6
        };
      }
      if (isLeadingSurrogate(code)) {
        if (body.charCodeAt(position + 6) === 92 && body.charCodeAt(position + 7) === 117) {
          const trailingCode = read16BitHexCode(body, position + 8);
          if (isTrailingSurrogate(trailingCode)) {
            return {
              value: String.fromCodePoint(code, trailingCode),
              size: 12
            };
          }
        }
      }
      throw (0, _syntaxError.syntaxError)(
        lexer.source,
        position,
        `Invalid Unicode escape sequence: "${body.slice(position, position + 6)}".`
      );
    }
    function read16BitHexCode(body, position) {
      return readHexDigit(body.charCodeAt(position)) << 12 | readHexDigit(body.charCodeAt(position + 1)) << 8 | readHexDigit(body.charCodeAt(position + 2)) << 4 | readHexDigit(body.charCodeAt(position + 3));
    }
    function readHexDigit(code) {
      return code >= 48 && code <= 57 ? code - 48 : code >= 65 && code <= 70 ? code - 55 : code >= 97 && code <= 102 ? code - 87 : -1;
    }
    function readEscapedCharacter(lexer, position) {
      const body = lexer.source.body;
      const code = body.charCodeAt(position + 1);
      switch (code) {
        case 34:
          return {
            value: '"',
            size: 2
          };
        case 92:
          return {
            value: "\\",
            size: 2
          };
        case 47:
          return {
            value: "/",
            size: 2
          };
        case 98:
          return {
            value: "\b",
            size: 2
          };
        case 102:
          return {
            value: "\f",
            size: 2
          };
        case 110:
          return {
            value: "\n",
            size: 2
          };
        case 114:
          return {
            value: "\r",
            size: 2
          };
        case 116:
          return {
            value: "	",
            size: 2
          };
      }
      throw (0, _syntaxError.syntaxError)(
        lexer.source,
        position,
        `Invalid character escape sequence: "${body.slice(
          position,
          position + 2
        )}".`
      );
    }
    function readBlockString(lexer, start) {
      const body = lexer.source.body;
      const bodyLength = body.length;
      let lineStart = lexer.lineStart;
      let position = start + 3;
      let chunkStart = position;
      let currentLine = "";
      const blockLines = [];
      while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if (code === 34 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34) {
          currentLine += body.slice(chunkStart, position);
          blockLines.push(currentLine);
          const token = createToken(
            lexer,
            _tokenKind.TokenKind.BLOCK_STRING,
            start,
            position + 3,
            // Return a string of the lines joined with U+000A.
            (0, _blockString.dedentBlockStringLines)(blockLines).join("\n")
          );
          lexer.line += blockLines.length - 1;
          lexer.lineStart = lineStart;
          return token;
        }
        if (code === 92 && body.charCodeAt(position + 1) === 34 && body.charCodeAt(position + 2) === 34 && body.charCodeAt(position + 3) === 34) {
          currentLine += body.slice(chunkStart, position);
          chunkStart = position + 1;
          position += 4;
          continue;
        }
        if (code === 10 || code === 13) {
          currentLine += body.slice(chunkStart, position);
          blockLines.push(currentLine);
          if (code === 13 && body.charCodeAt(position + 1) === 10) {
            position += 2;
          } else {
            ++position;
          }
          currentLine = "";
          chunkStart = position;
          lineStart = position;
          continue;
        }
        if (isUnicodeScalarValue(code)) {
          ++position;
        } else if (isSupplementaryCodePoint(body, position)) {
          position += 2;
        } else {
          throw (0, _syntaxError.syntaxError)(
            lexer.source,
            position,
            `Invalid character within String: ${printCodePointAt(
              lexer,
              position
            )}.`
          );
        }
      }
      throw (0, _syntaxError.syntaxError)(
        lexer.source,
        position,
        "Unterminated string."
      );
    }
    function readName(lexer, start) {
      const body = lexer.source.body;
      const bodyLength = body.length;
      let position = start + 1;
      while (position < bodyLength) {
        const code = body.charCodeAt(position);
        if ((0, _characterClasses.isNameContinue)(code)) {
          ++position;
        } else {
          break;
        }
      }
      return createToken(
        lexer,
        _tokenKind.TokenKind.NAME,
        start,
        position,
        body.slice(start, position)
      );
    }
  }
});

// node_modules/graphql/jsutils/inspect.js
var require_inspect = __commonJS({
  "node_modules/graphql/jsutils/inspect.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.inspect = inspect;
    var MAX_ARRAY_LENGTH = 10;
    var MAX_RECURSIVE_DEPTH = 2;
    function inspect(value) {
      return formatValue(value, []);
    }
    function formatValue(value, seenValues) {
      switch (typeof value) {
        case "string":
          return JSON.stringify(value);
        case "function":
          return value.name ? `[function ${value.name}]` : "[function]";
        case "object":
          return formatObjectValue(value, seenValues);
        default:
          return String(value);
      }
    }
    function formatObjectValue(value, previouslySeenValues) {
      if (value === null) {
        return "null";
      }
      if (previouslySeenValues.includes(value)) {
        return "[Circular]";
      }
      const seenValues = [...previouslySeenValues, value];
      if (isJSONable(value)) {
        const jsonValue = value.toJSON();
        if (jsonValue !== value) {
          return typeof jsonValue === "string" ? jsonValue : formatValue(jsonValue, seenValues);
        }
      } else if (Array.isArray(value)) {
        return formatArray(value, seenValues);
      }
      return formatObject(value, seenValues);
    }
    function isJSONable(value) {
      return typeof value.toJSON === "function";
    }
    function formatObject(object, seenValues) {
      const entries = Object.entries(object);
      if (entries.length === 0) {
        return "{}";
      }
      if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return "[" + getObjectTag(object) + "]";
      }
      const properties = entries.map(
        ([key, value]) => key + ": " + formatValue(value, seenValues)
      );
      return "{ " + properties.join(", ") + " }";
    }
    function formatArray(array, seenValues) {
      if (array.length === 0) {
        return "[]";
      }
      if (seenValues.length > MAX_RECURSIVE_DEPTH) {
        return "[Array]";
      }
      const len = Math.min(MAX_ARRAY_LENGTH, array.length);
      const remaining = array.length - len;
      const items = [];
      for (let i = 0; i < len; ++i) {
        items.push(formatValue(array[i], seenValues));
      }
      if (remaining === 1) {
        items.push("... 1 more item");
      } else if (remaining > 1) {
        items.push(`... ${remaining} more items`);
      }
      return "[" + items.join(", ") + "]";
    }
    function getObjectTag(object) {
      const tag = Object.prototype.toString.call(object).replace(/^\[object /, "").replace(/]$/, "");
      if (tag === "Object" && typeof object.constructor === "function") {
        const name = object.constructor.name;
        if (typeof name === "string" && name !== "") {
          return name;
        }
      }
      return tag;
    }
  }
});

// node_modules/graphql/jsutils/instanceOf.js
var require_instanceOf = __commonJS({
  "node_modules/graphql/jsutils/instanceOf.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.instanceOf = void 0;
    var _inspect = require_inspect();
    var isProduction = globalThis.process && // eslint-disable-next-line no-undef
    process.env.NODE_ENV === "production";
    var instanceOf = (
      /* c8 ignore next 6 */
      // FIXME: https://github.com/graphql/graphql-js/issues/2317
      isProduction ? function instanceOf2(value, constructor) {
        return value instanceof constructor;
      } : function instanceOf2(value, constructor) {
        if (value instanceof constructor) {
          return true;
        }
        if (typeof value === "object" && value !== null) {
          var _value$constructor;
          const className = constructor.prototype[Symbol.toStringTag];
          const valueClassName = (
            // We still need to support constructor's name to detect conflicts with older versions of this library.
            Symbol.toStringTag in value ? value[Symbol.toStringTag] : (_value$constructor = value.constructor) === null || _value$constructor === void 0 ? void 0 : _value$constructor.name
          );
          if (className === valueClassName) {
            const stringifiedValue = (0, _inspect.inspect)(value);
            throw new Error(`Cannot use ${className} "${stringifiedValue}" from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`);
          }
        }
        return false;
      }
    );
    exports2.instanceOf = instanceOf;
  }
});

// node_modules/graphql/language/source.js
var require_source = __commonJS({
  "node_modules/graphql/language/source.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.Source = void 0;
    exports2.isSource = isSource;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _instanceOf = require_instanceOf();
    var Source = class {
      constructor(body, name = "GraphQL request", locationOffset = {
        line: 1,
        column: 1
      }) {
        typeof body === "string" || (0, _devAssert.devAssert)(
          false,
          `Body must be a string. Received: ${(0, _inspect.inspect)(body)}.`
        );
        this.body = body;
        this.name = name;
        this.locationOffset = locationOffset;
        this.locationOffset.line > 0 || (0, _devAssert.devAssert)(
          false,
          "line in locationOffset is 1-indexed and must be positive."
        );
        this.locationOffset.column > 0 || (0, _devAssert.devAssert)(
          false,
          "column in locationOffset is 1-indexed and must be positive."
        );
      }
      get [Symbol.toStringTag]() {
        return "Source";
      }
    };
    exports2.Source = Source;
    function isSource(source) {
      return (0, _instanceOf.instanceOf)(source, Source);
    }
  }
});

// node_modules/graphql/language/parser.js
var require_parser = __commonJS({
  "node_modules/graphql/language/parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.Parser = void 0;
    exports2.parse = parse2;
    exports2.parseConstValue = parseConstValue;
    exports2.parseType = parseType;
    exports2.parseValue = parseValue;
    var _syntaxError = require_syntaxError();
    var _ast = require_ast();
    var _directiveLocation = require_directiveLocation();
    var _kinds = require_kinds();
    var _lexer = require_lexer();
    var _source = require_source();
    var _tokenKind = require_tokenKind();
    function parse2(source, options) {
      const parser = new Parser(source, options);
      return parser.parseDocument();
    }
    function parseValue(source, options) {
      const parser = new Parser(source, options);
      parser.expectToken(_tokenKind.TokenKind.SOF);
      const value = parser.parseValueLiteral(false);
      parser.expectToken(_tokenKind.TokenKind.EOF);
      return value;
    }
    function parseConstValue(source, options) {
      const parser = new Parser(source, options);
      parser.expectToken(_tokenKind.TokenKind.SOF);
      const value = parser.parseConstValueLiteral();
      parser.expectToken(_tokenKind.TokenKind.EOF);
      return value;
    }
    function parseType(source, options) {
      const parser = new Parser(source, options);
      parser.expectToken(_tokenKind.TokenKind.SOF);
      const type = parser.parseTypeReference();
      parser.expectToken(_tokenKind.TokenKind.EOF);
      return type;
    }
    var Parser = class {
      constructor(source, options = {}) {
        const sourceObj = (0, _source.isSource)(source) ? source : new _source.Source(source);
        this._lexer = new _lexer.Lexer(sourceObj);
        this._options = options;
        this._tokenCounter = 0;
      }
      /**
       * Converts a name lex token into a name parse node.
       */
      parseName() {
        const token = this.expectToken(_tokenKind.TokenKind.NAME);
        return this.node(token, {
          kind: _kinds.Kind.NAME,
          value: token.value
        });
      }
      // Implements the parsing rules in the Document section.
      /**
       * Document : Definition+
       */
      parseDocument() {
        return this.node(this._lexer.token, {
          kind: _kinds.Kind.DOCUMENT,
          definitions: this.many(
            _tokenKind.TokenKind.SOF,
            this.parseDefinition,
            _tokenKind.TokenKind.EOF
          )
        });
      }
      /**
       * Definition :
       *   - ExecutableDefinition
       *   - TypeSystemDefinition
       *   - TypeSystemExtension
       *
       * ExecutableDefinition :
       *   - OperationDefinition
       *   - FragmentDefinition
       *
       * TypeSystemDefinition :
       *   - SchemaDefinition
       *   - TypeDefinition
       *   - DirectiveDefinition
       *
       * TypeDefinition :
       *   - ScalarTypeDefinition
       *   - ObjectTypeDefinition
       *   - InterfaceTypeDefinition
       *   - UnionTypeDefinition
       *   - EnumTypeDefinition
       *   - InputObjectTypeDefinition
       */
      parseDefinition() {
        if (this.peek(_tokenKind.TokenKind.BRACE_L)) {
          return this.parseOperationDefinition();
        }
        const hasDescription = this.peekDescription();
        const keywordToken = hasDescription ? this._lexer.lookahead() : this._lexer.token;
        if (keywordToken.kind === _tokenKind.TokenKind.NAME) {
          switch (keywordToken.value) {
            case "schema":
              return this.parseSchemaDefinition();
            case "scalar":
              return this.parseScalarTypeDefinition();
            case "type":
              return this.parseObjectTypeDefinition();
            case "interface":
              return this.parseInterfaceTypeDefinition();
            case "union":
              return this.parseUnionTypeDefinition();
            case "enum":
              return this.parseEnumTypeDefinition();
            case "input":
              return this.parseInputObjectTypeDefinition();
            case "directive":
              return this.parseDirectiveDefinition();
          }
          if (hasDescription) {
            throw (0, _syntaxError.syntaxError)(
              this._lexer.source,
              this._lexer.token.start,
              "Unexpected description, descriptions are supported only on type definitions."
            );
          }
          switch (keywordToken.value) {
            case "query":
            case "mutation":
            case "subscription":
              return this.parseOperationDefinition();
            case "fragment":
              return this.parseFragmentDefinition();
            case "extend":
              return this.parseTypeSystemExtension();
          }
        }
        throw this.unexpected(keywordToken);
      }
      // Implements the parsing rules in the Operations section.
      /**
       * OperationDefinition :
       *  - SelectionSet
       *  - OperationType Name? VariableDefinitions? Directives? SelectionSet
       */
      parseOperationDefinition() {
        const start = this._lexer.token;
        if (this.peek(_tokenKind.TokenKind.BRACE_L)) {
          return this.node(start, {
            kind: _kinds.Kind.OPERATION_DEFINITION,
            operation: _ast.OperationTypeNode.QUERY,
            name: void 0,
            variableDefinitions: [],
            directives: [],
            selectionSet: this.parseSelectionSet()
          });
        }
        const operation = this.parseOperationType();
        let name;
        if (this.peek(_tokenKind.TokenKind.NAME)) {
          name = this.parseName();
        }
        return this.node(start, {
          kind: _kinds.Kind.OPERATION_DEFINITION,
          operation,
          name,
          variableDefinitions: this.parseVariableDefinitions(),
          directives: this.parseDirectives(false),
          selectionSet: this.parseSelectionSet()
        });
      }
      /**
       * OperationType : one of query mutation subscription
       */
      parseOperationType() {
        const operationToken = this.expectToken(_tokenKind.TokenKind.NAME);
        switch (operationToken.value) {
          case "query":
            return _ast.OperationTypeNode.QUERY;
          case "mutation":
            return _ast.OperationTypeNode.MUTATION;
          case "subscription":
            return _ast.OperationTypeNode.SUBSCRIPTION;
        }
        throw this.unexpected(operationToken);
      }
      /**
       * VariableDefinitions : ( VariableDefinition+ )
       */
      parseVariableDefinitions() {
        return this.optionalMany(
          _tokenKind.TokenKind.PAREN_L,
          this.parseVariableDefinition,
          _tokenKind.TokenKind.PAREN_R
        );
      }
      /**
       * VariableDefinition : Variable : Type DefaultValue? Directives[Const]?
       */
      parseVariableDefinition() {
        return this.node(this._lexer.token, {
          kind: _kinds.Kind.VARIABLE_DEFINITION,
          variable: this.parseVariable(),
          type: (this.expectToken(_tokenKind.TokenKind.COLON), this.parseTypeReference()),
          defaultValue: this.expectOptionalToken(_tokenKind.TokenKind.EQUALS) ? this.parseConstValueLiteral() : void 0,
          directives: this.parseConstDirectives()
        });
      }
      /**
       * Variable : $ Name
       */
      parseVariable() {
        const start = this._lexer.token;
        this.expectToken(_tokenKind.TokenKind.DOLLAR);
        return this.node(start, {
          kind: _kinds.Kind.VARIABLE,
          name: this.parseName()
        });
      }
      /**
       * ```
       * SelectionSet : { Selection+ }
       * ```
       */
      parseSelectionSet() {
        return this.node(this._lexer.token, {
          kind: _kinds.Kind.SELECTION_SET,
          selections: this.many(
            _tokenKind.TokenKind.BRACE_L,
            this.parseSelection,
            _tokenKind.TokenKind.BRACE_R
          )
        });
      }
      /**
       * Selection :
       *   - Field
       *   - FragmentSpread
       *   - InlineFragment
       */
      parseSelection() {
        return this.peek(_tokenKind.TokenKind.SPREAD) ? this.parseFragment() : this.parseField();
      }
      /**
       * Field : Alias? Name Arguments? Directives? SelectionSet?
       *
       * Alias : Name :
       */
      parseField() {
        const start = this._lexer.token;
        const nameOrAlias = this.parseName();
        let alias;
        let name;
        if (this.expectOptionalToken(_tokenKind.TokenKind.COLON)) {
          alias = nameOrAlias;
          name = this.parseName();
        } else {
          name = nameOrAlias;
        }
        return this.node(start, {
          kind: _kinds.Kind.FIELD,
          alias,
          name,
          arguments: this.parseArguments(false),
          directives: this.parseDirectives(false),
          selectionSet: this.peek(_tokenKind.TokenKind.BRACE_L) ? this.parseSelectionSet() : void 0
        });
      }
      /**
       * Arguments[Const] : ( Argument[?Const]+ )
       */
      parseArguments(isConst) {
        const item = isConst ? this.parseConstArgument : this.parseArgument;
        return this.optionalMany(
          _tokenKind.TokenKind.PAREN_L,
          item,
          _tokenKind.TokenKind.PAREN_R
        );
      }
      /**
       * Argument[Const] : Name : Value[?Const]
       */
      parseArgument(isConst = false) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(_tokenKind.TokenKind.COLON);
        return this.node(start, {
          kind: _kinds.Kind.ARGUMENT,
          name,
          value: this.parseValueLiteral(isConst)
        });
      }
      parseConstArgument() {
        return this.parseArgument(true);
      }
      // Implements the parsing rules in the Fragments section.
      /**
       * Corresponds to both FragmentSpread and InlineFragment in the spec.
       *
       * FragmentSpread : ... FragmentName Directives?
       *
       * InlineFragment : ... TypeCondition? Directives? SelectionSet
       */
      parseFragment() {
        const start = this._lexer.token;
        this.expectToken(_tokenKind.TokenKind.SPREAD);
        const hasTypeCondition = this.expectOptionalKeyword("on");
        if (!hasTypeCondition && this.peek(_tokenKind.TokenKind.NAME)) {
          return this.node(start, {
            kind: _kinds.Kind.FRAGMENT_SPREAD,
            name: this.parseFragmentName(),
            directives: this.parseDirectives(false)
          });
        }
        return this.node(start, {
          kind: _kinds.Kind.INLINE_FRAGMENT,
          typeCondition: hasTypeCondition ? this.parseNamedType() : void 0,
          directives: this.parseDirectives(false),
          selectionSet: this.parseSelectionSet()
        });
      }
      /**
       * FragmentDefinition :
       *   - fragment FragmentName on TypeCondition Directives? SelectionSet
       *
       * TypeCondition : NamedType
       */
      parseFragmentDefinition() {
        const start = this._lexer.token;
        this.expectKeyword("fragment");
        if (this._options.allowLegacyFragmentVariables === true) {
          return this.node(start, {
            kind: _kinds.Kind.FRAGMENT_DEFINITION,
            name: this.parseFragmentName(),
            variableDefinitions: this.parseVariableDefinitions(),
            typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
            directives: this.parseDirectives(false),
            selectionSet: this.parseSelectionSet()
          });
        }
        return this.node(start, {
          kind: _kinds.Kind.FRAGMENT_DEFINITION,
          name: this.parseFragmentName(),
          typeCondition: (this.expectKeyword("on"), this.parseNamedType()),
          directives: this.parseDirectives(false),
          selectionSet: this.parseSelectionSet()
        });
      }
      /**
       * FragmentName : Name but not `on`
       */
      parseFragmentName() {
        if (this._lexer.token.value === "on") {
          throw this.unexpected();
        }
        return this.parseName();
      }
      // Implements the parsing rules in the Values section.
      /**
       * Value[Const] :
       *   - [~Const] Variable
       *   - IntValue
       *   - FloatValue
       *   - StringValue
       *   - BooleanValue
       *   - NullValue
       *   - EnumValue
       *   - ListValue[?Const]
       *   - ObjectValue[?Const]
       *
       * BooleanValue : one of `true` `false`
       *
       * NullValue : `null`
       *
       * EnumValue : Name but not `true`, `false` or `null`
       */
      parseValueLiteral(isConst) {
        const token = this._lexer.token;
        switch (token.kind) {
          case _tokenKind.TokenKind.BRACKET_L:
            return this.parseList(isConst);
          case _tokenKind.TokenKind.BRACE_L:
            return this.parseObject(isConst);
          case _tokenKind.TokenKind.INT:
            this.advanceLexer();
            return this.node(token, {
              kind: _kinds.Kind.INT,
              value: token.value
            });
          case _tokenKind.TokenKind.FLOAT:
            this.advanceLexer();
            return this.node(token, {
              kind: _kinds.Kind.FLOAT,
              value: token.value
            });
          case _tokenKind.TokenKind.STRING:
          case _tokenKind.TokenKind.BLOCK_STRING:
            return this.parseStringLiteral();
          case _tokenKind.TokenKind.NAME:
            this.advanceLexer();
            switch (token.value) {
              case "true":
                return this.node(token, {
                  kind: _kinds.Kind.BOOLEAN,
                  value: true
                });
              case "false":
                return this.node(token, {
                  kind: _kinds.Kind.BOOLEAN,
                  value: false
                });
              case "null":
                return this.node(token, {
                  kind: _kinds.Kind.NULL
                });
              default:
                return this.node(token, {
                  kind: _kinds.Kind.ENUM,
                  value: token.value
                });
            }
          case _tokenKind.TokenKind.DOLLAR:
            if (isConst) {
              this.expectToken(_tokenKind.TokenKind.DOLLAR);
              if (this._lexer.token.kind === _tokenKind.TokenKind.NAME) {
                const varName = this._lexer.token.value;
                throw (0, _syntaxError.syntaxError)(
                  this._lexer.source,
                  token.start,
                  `Unexpected variable "$${varName}" in constant value.`
                );
              } else {
                throw this.unexpected(token);
              }
            }
            return this.parseVariable();
          default:
            throw this.unexpected();
        }
      }
      parseConstValueLiteral() {
        return this.parseValueLiteral(true);
      }
      parseStringLiteral() {
        const token = this._lexer.token;
        this.advanceLexer();
        return this.node(token, {
          kind: _kinds.Kind.STRING,
          value: token.value,
          block: token.kind === _tokenKind.TokenKind.BLOCK_STRING
        });
      }
      /**
       * ListValue[Const] :
       *   - [ ]
       *   - [ Value[?Const]+ ]
       */
      parseList(isConst) {
        const item = () => this.parseValueLiteral(isConst);
        return this.node(this._lexer.token, {
          kind: _kinds.Kind.LIST,
          values: this.any(
            _tokenKind.TokenKind.BRACKET_L,
            item,
            _tokenKind.TokenKind.BRACKET_R
          )
        });
      }
      /**
       * ```
       * ObjectValue[Const] :
       *   - { }
       *   - { ObjectField[?Const]+ }
       * ```
       */
      parseObject(isConst) {
        const item = () => this.parseObjectField(isConst);
        return this.node(this._lexer.token, {
          kind: _kinds.Kind.OBJECT,
          fields: this.any(
            _tokenKind.TokenKind.BRACE_L,
            item,
            _tokenKind.TokenKind.BRACE_R
          )
        });
      }
      /**
       * ObjectField[Const] : Name : Value[?Const]
       */
      parseObjectField(isConst) {
        const start = this._lexer.token;
        const name = this.parseName();
        this.expectToken(_tokenKind.TokenKind.COLON);
        return this.node(start, {
          kind: _kinds.Kind.OBJECT_FIELD,
          name,
          value: this.parseValueLiteral(isConst)
        });
      }
      // Implements the parsing rules in the Directives section.
      /**
       * Directives[Const] : Directive[?Const]+
       */
      parseDirectives(isConst) {
        const directives = [];
        while (this.peek(_tokenKind.TokenKind.AT)) {
          directives.push(this.parseDirective(isConst));
        }
        return directives;
      }
      parseConstDirectives() {
        return this.parseDirectives(true);
      }
      /**
       * ```
       * Directive[Const] : @ Name Arguments[?Const]?
       * ```
       */
      parseDirective(isConst) {
        const start = this._lexer.token;
        this.expectToken(_tokenKind.TokenKind.AT);
        return this.node(start, {
          kind: _kinds.Kind.DIRECTIVE,
          name: this.parseName(),
          arguments: this.parseArguments(isConst)
        });
      }
      // Implements the parsing rules in the Types section.
      /**
       * Type :
       *   - NamedType
       *   - ListType
       *   - NonNullType
       */
      parseTypeReference() {
        const start = this._lexer.token;
        let type;
        if (this.expectOptionalToken(_tokenKind.TokenKind.BRACKET_L)) {
          const innerType = this.parseTypeReference();
          this.expectToken(_tokenKind.TokenKind.BRACKET_R);
          type = this.node(start, {
            kind: _kinds.Kind.LIST_TYPE,
            type: innerType
          });
        } else {
          type = this.parseNamedType();
        }
        if (this.expectOptionalToken(_tokenKind.TokenKind.BANG)) {
          return this.node(start, {
            kind: _kinds.Kind.NON_NULL_TYPE,
            type
          });
        }
        return type;
      }
      /**
       * NamedType : Name
       */
      parseNamedType() {
        return this.node(this._lexer.token, {
          kind: _kinds.Kind.NAMED_TYPE,
          name: this.parseName()
        });
      }
      // Implements the parsing rules in the Type Definition section.
      peekDescription() {
        return this.peek(_tokenKind.TokenKind.STRING) || this.peek(_tokenKind.TokenKind.BLOCK_STRING);
      }
      /**
       * Description : StringValue
       */
      parseDescription() {
        if (this.peekDescription()) {
          return this.parseStringLiteral();
        }
      }
      /**
       * ```
       * SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
       * ```
       */
      parseSchemaDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("schema");
        const directives = this.parseConstDirectives();
        const operationTypes = this.many(
          _tokenKind.TokenKind.BRACE_L,
          this.parseOperationTypeDefinition,
          _tokenKind.TokenKind.BRACE_R
        );
        return this.node(start, {
          kind: _kinds.Kind.SCHEMA_DEFINITION,
          description,
          directives,
          operationTypes
        });
      }
      /**
       * OperationTypeDefinition : OperationType : NamedType
       */
      parseOperationTypeDefinition() {
        const start = this._lexer.token;
        const operation = this.parseOperationType();
        this.expectToken(_tokenKind.TokenKind.COLON);
        const type = this.parseNamedType();
        return this.node(start, {
          kind: _kinds.Kind.OPERATION_TYPE_DEFINITION,
          operation,
          type
        });
      }
      /**
       * ScalarTypeDefinition : Description? scalar Name Directives[Const]?
       */
      parseScalarTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("scalar");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        return this.node(start, {
          kind: _kinds.Kind.SCALAR_TYPE_DEFINITION,
          description,
          name,
          directives
        });
      }
      /**
       * ObjectTypeDefinition :
       *   Description?
       *   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
       */
      parseObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("type");
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        return this.node(start, {
          kind: _kinds.Kind.OBJECT_TYPE_DEFINITION,
          description,
          name,
          interfaces,
          directives,
          fields
        });
      }
      /**
       * ImplementsInterfaces :
       *   - implements `&`? NamedType
       *   - ImplementsInterfaces & NamedType
       */
      parseImplementsInterfaces() {
        return this.expectOptionalKeyword("implements") ? this.delimitedMany(_tokenKind.TokenKind.AMP, this.parseNamedType) : [];
      }
      /**
       * ```
       * FieldsDefinition : { FieldDefinition+ }
       * ```
       */
      parseFieldsDefinition() {
        return this.optionalMany(
          _tokenKind.TokenKind.BRACE_L,
          this.parseFieldDefinition,
          _tokenKind.TokenKind.BRACE_R
        );
      }
      /**
       * FieldDefinition :
       *   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
       */
      parseFieldDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        this.expectToken(_tokenKind.TokenKind.COLON);
        const type = this.parseTypeReference();
        const directives = this.parseConstDirectives();
        return this.node(start, {
          kind: _kinds.Kind.FIELD_DEFINITION,
          description,
          name,
          arguments: args,
          type,
          directives
        });
      }
      /**
       * ArgumentsDefinition : ( InputValueDefinition+ )
       */
      parseArgumentDefs() {
        return this.optionalMany(
          _tokenKind.TokenKind.PAREN_L,
          this.parseInputValueDef,
          _tokenKind.TokenKind.PAREN_R
        );
      }
      /**
       * InputValueDefinition :
       *   - Description? Name : Type DefaultValue? Directives[Const]?
       */
      parseInputValueDef() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseName();
        this.expectToken(_tokenKind.TokenKind.COLON);
        const type = this.parseTypeReference();
        let defaultValue;
        if (this.expectOptionalToken(_tokenKind.TokenKind.EQUALS)) {
          defaultValue = this.parseConstValueLiteral();
        }
        const directives = this.parseConstDirectives();
        return this.node(start, {
          kind: _kinds.Kind.INPUT_VALUE_DEFINITION,
          description,
          name,
          type,
          defaultValue,
          directives
        });
      }
      /**
       * InterfaceTypeDefinition :
       *   - Description? interface Name Directives[Const]? FieldsDefinition?
       */
      parseInterfaceTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("interface");
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        return this.node(start, {
          kind: _kinds.Kind.INTERFACE_TYPE_DEFINITION,
          description,
          name,
          interfaces,
          directives,
          fields
        });
      }
      /**
       * UnionTypeDefinition :
       *   - Description? union Name Directives[Const]? UnionMemberTypes?
       */
      parseUnionTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("union");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const types = this.parseUnionMemberTypes();
        return this.node(start, {
          kind: _kinds.Kind.UNION_TYPE_DEFINITION,
          description,
          name,
          directives,
          types
        });
      }
      /**
       * UnionMemberTypes :
       *   - = `|`? NamedType
       *   - UnionMemberTypes | NamedType
       */
      parseUnionMemberTypes() {
        return this.expectOptionalToken(_tokenKind.TokenKind.EQUALS) ? this.delimitedMany(_tokenKind.TokenKind.PIPE, this.parseNamedType) : [];
      }
      /**
       * EnumTypeDefinition :
       *   - Description? enum Name Directives[Const]? EnumValuesDefinition?
       */
      parseEnumTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("enum");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const values = this.parseEnumValuesDefinition();
        return this.node(start, {
          kind: _kinds.Kind.ENUM_TYPE_DEFINITION,
          description,
          name,
          directives,
          values
        });
      }
      /**
       * ```
       * EnumValuesDefinition : { EnumValueDefinition+ }
       * ```
       */
      parseEnumValuesDefinition() {
        return this.optionalMany(
          _tokenKind.TokenKind.BRACE_L,
          this.parseEnumValueDefinition,
          _tokenKind.TokenKind.BRACE_R
        );
      }
      /**
       * EnumValueDefinition : Description? EnumValue Directives[Const]?
       */
      parseEnumValueDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        const name = this.parseEnumValueName();
        const directives = this.parseConstDirectives();
        return this.node(start, {
          kind: _kinds.Kind.ENUM_VALUE_DEFINITION,
          description,
          name,
          directives
        });
      }
      /**
       * EnumValue : Name but not `true`, `false` or `null`
       */
      parseEnumValueName() {
        if (this._lexer.token.value === "true" || this._lexer.token.value === "false" || this._lexer.token.value === "null") {
          throw (0, _syntaxError.syntaxError)(
            this._lexer.source,
            this._lexer.token.start,
            `${getTokenDesc(
              this._lexer.token
            )} is reserved and cannot be used for an enum value.`
          );
        }
        return this.parseName();
      }
      /**
       * InputObjectTypeDefinition :
       *   - Description? input Name Directives[Const]? InputFieldsDefinition?
       */
      parseInputObjectTypeDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("input");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const fields = this.parseInputFieldsDefinition();
        return this.node(start, {
          kind: _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION,
          description,
          name,
          directives,
          fields
        });
      }
      /**
       * ```
       * InputFieldsDefinition : { InputValueDefinition+ }
       * ```
       */
      parseInputFieldsDefinition() {
        return this.optionalMany(
          _tokenKind.TokenKind.BRACE_L,
          this.parseInputValueDef,
          _tokenKind.TokenKind.BRACE_R
        );
      }
      /**
       * TypeSystemExtension :
       *   - SchemaExtension
       *   - TypeExtension
       *
       * TypeExtension :
       *   - ScalarTypeExtension
       *   - ObjectTypeExtension
       *   - InterfaceTypeExtension
       *   - UnionTypeExtension
       *   - EnumTypeExtension
       *   - InputObjectTypeDefinition
       */
      parseTypeSystemExtension() {
        const keywordToken = this._lexer.lookahead();
        if (keywordToken.kind === _tokenKind.TokenKind.NAME) {
          switch (keywordToken.value) {
            case "schema":
              return this.parseSchemaExtension();
            case "scalar":
              return this.parseScalarTypeExtension();
            case "type":
              return this.parseObjectTypeExtension();
            case "interface":
              return this.parseInterfaceTypeExtension();
            case "union":
              return this.parseUnionTypeExtension();
            case "enum":
              return this.parseEnumTypeExtension();
            case "input":
              return this.parseInputObjectTypeExtension();
          }
        }
        throw this.unexpected(keywordToken);
      }
      /**
       * ```
       * SchemaExtension :
       *  - extend schema Directives[Const]? { OperationTypeDefinition+ }
       *  - extend schema Directives[Const]
       * ```
       */
      parseSchemaExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("schema");
        const directives = this.parseConstDirectives();
        const operationTypes = this.optionalMany(
          _tokenKind.TokenKind.BRACE_L,
          this.parseOperationTypeDefinition,
          _tokenKind.TokenKind.BRACE_R
        );
        if (directives.length === 0 && operationTypes.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.SCHEMA_EXTENSION,
          directives,
          operationTypes
        });
      }
      /**
       * ScalarTypeExtension :
       *   - extend scalar Name Directives[Const]
       */
      parseScalarTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("scalar");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        if (directives.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.SCALAR_TYPE_EXTENSION,
          name,
          directives
        });
      }
      /**
       * ObjectTypeExtension :
       *  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
       *  - extend type Name ImplementsInterfaces? Directives[Const]
       *  - extend type Name ImplementsInterfaces
       */
      parseObjectTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("type");
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.OBJECT_TYPE_EXTENSION,
          name,
          interfaces,
          directives,
          fields
        });
      }
      /**
       * InterfaceTypeExtension :
       *  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
       *  - extend interface Name ImplementsInterfaces? Directives[Const]
       *  - extend interface Name ImplementsInterfaces
       */
      parseInterfaceTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("interface");
        const name = this.parseName();
        const interfaces = this.parseImplementsInterfaces();
        const directives = this.parseConstDirectives();
        const fields = this.parseFieldsDefinition();
        if (interfaces.length === 0 && directives.length === 0 && fields.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.INTERFACE_TYPE_EXTENSION,
          name,
          interfaces,
          directives,
          fields
        });
      }
      /**
       * UnionTypeExtension :
       *   - extend union Name Directives[Const]? UnionMemberTypes
       *   - extend union Name Directives[Const]
       */
      parseUnionTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("union");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const types = this.parseUnionMemberTypes();
        if (directives.length === 0 && types.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.UNION_TYPE_EXTENSION,
          name,
          directives,
          types
        });
      }
      /**
       * EnumTypeExtension :
       *   - extend enum Name Directives[Const]? EnumValuesDefinition
       *   - extend enum Name Directives[Const]
       */
      parseEnumTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("enum");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const values = this.parseEnumValuesDefinition();
        if (directives.length === 0 && values.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.ENUM_TYPE_EXTENSION,
          name,
          directives,
          values
        });
      }
      /**
       * InputObjectTypeExtension :
       *   - extend input Name Directives[Const]? InputFieldsDefinition
       *   - extend input Name Directives[Const]
       */
      parseInputObjectTypeExtension() {
        const start = this._lexer.token;
        this.expectKeyword("extend");
        this.expectKeyword("input");
        const name = this.parseName();
        const directives = this.parseConstDirectives();
        const fields = this.parseInputFieldsDefinition();
        if (directives.length === 0 && fields.length === 0) {
          throw this.unexpected();
        }
        return this.node(start, {
          kind: _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION,
          name,
          directives,
          fields
        });
      }
      /**
       * ```
       * DirectiveDefinition :
       *   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
       * ```
       */
      parseDirectiveDefinition() {
        const start = this._lexer.token;
        const description = this.parseDescription();
        this.expectKeyword("directive");
        this.expectToken(_tokenKind.TokenKind.AT);
        const name = this.parseName();
        const args = this.parseArgumentDefs();
        const repeatable = this.expectOptionalKeyword("repeatable");
        this.expectKeyword("on");
        const locations = this.parseDirectiveLocations();
        return this.node(start, {
          kind: _kinds.Kind.DIRECTIVE_DEFINITION,
          description,
          name,
          arguments: args,
          repeatable,
          locations
        });
      }
      /**
       * DirectiveLocations :
       *   - `|`? DirectiveLocation
       *   - DirectiveLocations | DirectiveLocation
       */
      parseDirectiveLocations() {
        return this.delimitedMany(
          _tokenKind.TokenKind.PIPE,
          this.parseDirectiveLocation
        );
      }
      /*
       * DirectiveLocation :
       *   - ExecutableDirectiveLocation
       *   - TypeSystemDirectiveLocation
       *
       * ExecutableDirectiveLocation : one of
       *   `QUERY`
       *   `MUTATION`
       *   `SUBSCRIPTION`
       *   `FIELD`
       *   `FRAGMENT_DEFINITION`
       *   `FRAGMENT_SPREAD`
       *   `INLINE_FRAGMENT`
       *
       * TypeSystemDirectiveLocation : one of
       *   `SCHEMA`
       *   `SCALAR`
       *   `OBJECT`
       *   `FIELD_DEFINITION`
       *   `ARGUMENT_DEFINITION`
       *   `INTERFACE`
       *   `UNION`
       *   `ENUM`
       *   `ENUM_VALUE`
       *   `INPUT_OBJECT`
       *   `INPUT_FIELD_DEFINITION`
       */
      parseDirectiveLocation() {
        const start = this._lexer.token;
        const name = this.parseName();
        if (Object.prototype.hasOwnProperty.call(
          _directiveLocation.DirectiveLocation,
          name.value
        )) {
          return name;
        }
        throw this.unexpected(start);
      }
      // Core parsing utility functions
      /**
       * Returns a node that, if configured to do so, sets a "loc" field as a
       * location object, used to identify the place in the source that created a
       * given parsed object.
       */
      node(startToken, node) {
        if (this._options.noLocation !== true) {
          node.loc = new _ast.Location(
            startToken,
            this._lexer.lastToken,
            this._lexer.source
          );
        }
        return node;
      }
      /**
       * Determines if the next token is of a given kind
       */
      peek(kind) {
        return this._lexer.token.kind === kind;
      }
      /**
       * If the next token is of the given kind, return that token after advancing the lexer.
       * Otherwise, do not change the parser state and throw an error.
       */
      expectToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
          this.advanceLexer();
          return token;
        }
        throw (0, _syntaxError.syntaxError)(
          this._lexer.source,
          token.start,
          `Expected ${getTokenKindDesc(kind)}, found ${getTokenDesc(token)}.`
        );
      }
      /**
       * If the next token is of the given kind, return "true" after advancing the lexer.
       * Otherwise, do not change the parser state and return "false".
       */
      expectOptionalToken(kind) {
        const token = this._lexer.token;
        if (token.kind === kind) {
          this.advanceLexer();
          return true;
        }
        return false;
      }
      /**
       * If the next token is a given keyword, advance the lexer.
       * Otherwise, do not change the parser state and throw an error.
       */
      expectKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === _tokenKind.TokenKind.NAME && token.value === value) {
          this.advanceLexer();
        } else {
          throw (0, _syntaxError.syntaxError)(
            this._lexer.source,
            token.start,
            `Expected "${value}", found ${getTokenDesc(token)}.`
          );
        }
      }
      /**
       * If the next token is a given keyword, return "true" after advancing the lexer.
       * Otherwise, do not change the parser state and return "false".
       */
      expectOptionalKeyword(value) {
        const token = this._lexer.token;
        if (token.kind === _tokenKind.TokenKind.NAME && token.value === value) {
          this.advanceLexer();
          return true;
        }
        return false;
      }
      /**
       * Helper function for creating an error when an unexpected lexed token is encountered.
       */
      unexpected(atToken) {
        const token = atToken !== null && atToken !== void 0 ? atToken : this._lexer.token;
        return (0, _syntaxError.syntaxError)(
          this._lexer.source,
          token.start,
          `Unexpected ${getTokenDesc(token)}.`
        );
      }
      /**
       * Returns a possibly empty list of parse nodes, determined by the parseFn.
       * This list begins with a lex token of openKind and ends with a lex token of closeKind.
       * Advances the parser to the next lex token after the closing token.
       */
      any(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        while (!this.expectOptionalToken(closeKind)) {
          nodes.push(parseFn.call(this));
        }
        return nodes;
      }
      /**
       * Returns a list of parse nodes, determined by the parseFn.
       * It can be empty only if open token is missing otherwise it will always return non-empty list
       * that begins with a lex token of openKind and ends with a lex token of closeKind.
       * Advances the parser to the next lex token after the closing token.
       */
      optionalMany(openKind, parseFn, closeKind) {
        if (this.expectOptionalToken(openKind)) {
          const nodes = [];
          do {
            nodes.push(parseFn.call(this));
          } while (!this.expectOptionalToken(closeKind));
          return nodes;
        }
        return [];
      }
      /**
       * Returns a non-empty list of parse nodes, determined by the parseFn.
       * This list begins with a lex token of openKind and ends with a lex token of closeKind.
       * Advances the parser to the next lex token after the closing token.
       */
      many(openKind, parseFn, closeKind) {
        this.expectToken(openKind);
        const nodes = [];
        do {
          nodes.push(parseFn.call(this));
        } while (!this.expectOptionalToken(closeKind));
        return nodes;
      }
      /**
       * Returns a non-empty list of parse nodes, determined by the parseFn.
       * This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
       * Advances the parser to the next lex token after last item in the list.
       */
      delimitedMany(delimiterKind, parseFn) {
        this.expectOptionalToken(delimiterKind);
        const nodes = [];
        do {
          nodes.push(parseFn.call(this));
        } while (this.expectOptionalToken(delimiterKind));
        return nodes;
      }
      advanceLexer() {
        const { maxTokens } = this._options;
        const token = this._lexer.advance();
        if (maxTokens !== void 0 && token.kind !== _tokenKind.TokenKind.EOF) {
          ++this._tokenCounter;
          if (this._tokenCounter > maxTokens) {
            throw (0, _syntaxError.syntaxError)(
              this._lexer.source,
              token.start,
              `Document contains more that ${maxTokens} tokens. Parsing aborted.`
            );
          }
        }
      }
    };
    exports2.Parser = Parser;
    function getTokenDesc(token) {
      const value = token.value;
      return getTokenKindDesc(token.kind) + (value != null ? ` "${value}"` : "");
    }
    function getTokenKindDesc(kind) {
      return (0, _lexer.isPunctuatorTokenKind)(kind) ? `"${kind}"` : kind;
    }
  }
});

// node_modules/graphql/jsutils/didYouMean.js
var require_didYouMean = __commonJS({
  "node_modules/graphql/jsutils/didYouMean.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.didYouMean = didYouMean;
    var MAX_SUGGESTIONS = 5;
    function didYouMean(firstArg, secondArg) {
      const [subMessage, suggestionsArg] = secondArg ? [firstArg, secondArg] : [void 0, firstArg];
      let message = " Did you mean ";
      if (subMessage) {
        message += subMessage + " ";
      }
      const suggestions = suggestionsArg.map((x) => `"${x}"`);
      switch (suggestions.length) {
        case 0:
          return "";
        case 1:
          return message + suggestions[0] + "?";
        case 2:
          return message + suggestions[0] + " or " + suggestions[1] + "?";
      }
      const selected = suggestions.slice(0, MAX_SUGGESTIONS);
      const lastItem = selected.pop();
      return message + selected.join(", ") + ", or " + lastItem + "?";
    }
  }
});

// node_modules/graphql/jsutils/identityFunc.js
var require_identityFunc = __commonJS({
  "node_modules/graphql/jsutils/identityFunc.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.identityFunc = identityFunc;
    function identityFunc(x) {
      return x;
    }
  }
});

// node_modules/graphql/jsutils/keyMap.js
var require_keyMap = __commonJS({
  "node_modules/graphql/jsutils/keyMap.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.keyMap = keyMap;
    function keyMap(list, keyFn) {
      const result = /* @__PURE__ */ Object.create(null);
      for (const item of list) {
        result[keyFn(item)] = item;
      }
      return result;
    }
  }
});

// node_modules/graphql/jsutils/keyValMap.js
var require_keyValMap = __commonJS({
  "node_modules/graphql/jsutils/keyValMap.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.keyValMap = keyValMap;
    function keyValMap(list, keyFn, valFn) {
      const result = /* @__PURE__ */ Object.create(null);
      for (const item of list) {
        result[keyFn(item)] = valFn(item);
      }
      return result;
    }
  }
});

// node_modules/graphql/jsutils/mapValue.js
var require_mapValue = __commonJS({
  "node_modules/graphql/jsutils/mapValue.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.mapValue = mapValue;
    function mapValue(map, fn) {
      const result = /* @__PURE__ */ Object.create(null);
      for (const key of Object.keys(map)) {
        result[key] = fn(map[key], key);
      }
      return result;
    }
  }
});

// node_modules/graphql/jsutils/naturalCompare.js
var require_naturalCompare = __commonJS({
  "node_modules/graphql/jsutils/naturalCompare.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.naturalCompare = naturalCompare;
    function naturalCompare(aStr, bStr) {
      let aIndex = 0;
      let bIndex = 0;
      while (aIndex < aStr.length && bIndex < bStr.length) {
        let aChar = aStr.charCodeAt(aIndex);
        let bChar = bStr.charCodeAt(bIndex);
        if (isDigit(aChar) && isDigit(bChar)) {
          let aNum = 0;
          do {
            ++aIndex;
            aNum = aNum * 10 + aChar - DIGIT_0;
            aChar = aStr.charCodeAt(aIndex);
          } while (isDigit(aChar) && aNum > 0);
          let bNum = 0;
          do {
            ++bIndex;
            bNum = bNum * 10 + bChar - DIGIT_0;
            bChar = bStr.charCodeAt(bIndex);
          } while (isDigit(bChar) && bNum > 0);
          if (aNum < bNum) {
            return -1;
          }
          if (aNum > bNum) {
            return 1;
          }
        } else {
          if (aChar < bChar) {
            return -1;
          }
          if (aChar > bChar) {
            return 1;
          }
          ++aIndex;
          ++bIndex;
        }
      }
      return aStr.length - bStr.length;
    }
    var DIGIT_0 = 48;
    var DIGIT_9 = 57;
    function isDigit(code) {
      return !isNaN(code) && DIGIT_0 <= code && code <= DIGIT_9;
    }
  }
});

// node_modules/graphql/jsutils/suggestionList.js
var require_suggestionList = __commonJS({
  "node_modules/graphql/jsutils/suggestionList.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.suggestionList = suggestionList;
    var _naturalCompare = require_naturalCompare();
    function suggestionList(input, options) {
      const optionsByDistance = /* @__PURE__ */ Object.create(null);
      const lexicalDistance = new LexicalDistance(input);
      const threshold = Math.floor(input.length * 0.4) + 1;
      for (const option of options) {
        const distance = lexicalDistance.measure(option, threshold);
        if (distance !== void 0) {
          optionsByDistance[option] = distance;
        }
      }
      return Object.keys(optionsByDistance).sort((a, b) => {
        const distanceDiff = optionsByDistance[a] - optionsByDistance[b];
        return distanceDiff !== 0 ? distanceDiff : (0, _naturalCompare.naturalCompare)(a, b);
      });
    }
    var LexicalDistance = class {
      constructor(input) {
        this._input = input;
        this._inputLowerCase = input.toLowerCase();
        this._inputArray = stringToArray(this._inputLowerCase);
        this._rows = [
          new Array(input.length + 1).fill(0),
          new Array(input.length + 1).fill(0),
          new Array(input.length + 1).fill(0)
        ];
      }
      measure(option, threshold) {
        if (this._input === option) {
          return 0;
        }
        const optionLowerCase = option.toLowerCase();
        if (this._inputLowerCase === optionLowerCase) {
          return 1;
        }
        let a = stringToArray(optionLowerCase);
        let b = this._inputArray;
        if (a.length < b.length) {
          const tmp = a;
          a = b;
          b = tmp;
        }
        const aLength = a.length;
        const bLength = b.length;
        if (aLength - bLength > threshold) {
          return void 0;
        }
        const rows = this._rows;
        for (let j = 0; j <= bLength; j++) {
          rows[0][j] = j;
        }
        for (let i = 1; i <= aLength; i++) {
          const upRow = rows[(i - 1) % 3];
          const currentRow = rows[i % 3];
          let smallestCell = currentRow[0] = i;
          for (let j = 1; j <= bLength; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let currentCell = Math.min(
              upRow[j] + 1,
              // delete
              currentRow[j - 1] + 1,
              // insert
              upRow[j - 1] + cost
              // substitute
            );
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
              const doubleDiagonalCell = rows[(i - 2) % 3][j - 2];
              currentCell = Math.min(currentCell, doubleDiagonalCell + 1);
            }
            if (currentCell < smallestCell) {
              smallestCell = currentCell;
            }
            currentRow[j] = currentCell;
          }
          if (smallestCell > threshold) {
            return void 0;
          }
        }
        const distance = rows[aLength % 3][bLength];
        return distance <= threshold ? distance : void 0;
      }
    };
    function stringToArray(str) {
      const strLength = str.length;
      const array = new Array(strLength);
      for (let i = 0; i < strLength; ++i) {
        array[i] = str.charCodeAt(i);
      }
      return array;
    }
  }
});

// node_modules/graphql/jsutils/toObjMap.js
var require_toObjMap = __commonJS({
  "node_modules/graphql/jsutils/toObjMap.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.toObjMap = toObjMap;
    function toObjMap(obj) {
      if (obj == null) {
        return /* @__PURE__ */ Object.create(null);
      }
      if (Object.getPrototypeOf(obj) === null) {
        return obj;
      }
      const map = /* @__PURE__ */ Object.create(null);
      for (const [key, value] of Object.entries(obj)) {
        map[key] = value;
      }
      return map;
    }
  }
});

// node_modules/graphql/language/printString.js
var require_printString = __commonJS({
  "node_modules/graphql/language/printString.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.printString = printString;
    function printString(str) {
      return `"${str.replace(escapedRegExp, escapedReplacer)}"`;
    }
    var escapedRegExp = /[\x00-\x1f\x22\x5c\x7f-\x9f]/g;
    function escapedReplacer(str) {
      return escapeSequences[str.charCodeAt(0)];
    }
    var escapeSequences = [
      "\\u0000",
      "\\u0001",
      "\\u0002",
      "\\u0003",
      "\\u0004",
      "\\u0005",
      "\\u0006",
      "\\u0007",
      "\\b",
      "\\t",
      "\\n",
      "\\u000B",
      "\\f",
      "\\r",
      "\\u000E",
      "\\u000F",
      "\\u0010",
      "\\u0011",
      "\\u0012",
      "\\u0013",
      "\\u0014",
      "\\u0015",
      "\\u0016",
      "\\u0017",
      "\\u0018",
      "\\u0019",
      "\\u001A",
      "\\u001B",
      "\\u001C",
      "\\u001D",
      "\\u001E",
      "\\u001F",
      "",
      "",
      '\\"',
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      // 2F
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      // 3F
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      // 4F
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "\\\\",
      "",
      "",
      "",
      // 5F
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      // 6F
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "\\u007F",
      "\\u0080",
      "\\u0081",
      "\\u0082",
      "\\u0083",
      "\\u0084",
      "\\u0085",
      "\\u0086",
      "\\u0087",
      "\\u0088",
      "\\u0089",
      "\\u008A",
      "\\u008B",
      "\\u008C",
      "\\u008D",
      "\\u008E",
      "\\u008F",
      "\\u0090",
      "\\u0091",
      "\\u0092",
      "\\u0093",
      "\\u0094",
      "\\u0095",
      "\\u0096",
      "\\u0097",
      "\\u0098",
      "\\u0099",
      "\\u009A",
      "\\u009B",
      "\\u009C",
      "\\u009D",
      "\\u009E",
      "\\u009F"
    ];
  }
});

// node_modules/graphql/language/visitor.js
var require_visitor = __commonJS({
  "node_modules/graphql/language/visitor.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.BREAK = void 0;
    exports2.getEnterLeaveForKind = getEnterLeaveForKind;
    exports2.getVisitFn = getVisitFn;
    exports2.visit = visit2;
    exports2.visitInParallel = visitInParallel;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _ast = require_ast();
    var _kinds = require_kinds();
    var BREAK = Object.freeze({});
    exports2.BREAK = BREAK;
    function visit2(root, visitor, visitorKeys = _ast.QueryDocumentKeys) {
      const enterLeaveMap = /* @__PURE__ */ new Map();
      for (const kind of Object.values(_kinds.Kind)) {
        enterLeaveMap.set(kind, getEnterLeaveForKind(visitor, kind));
      }
      let stack = void 0;
      let inArray = Array.isArray(root);
      let keys = [root];
      let index = -1;
      let edits = [];
      let node = root;
      let key = void 0;
      let parent = void 0;
      const path2 = [];
      const ancestors = [];
      do {
        index++;
        const isLeaving = index === keys.length;
        const isEdited = isLeaving && edits.length !== 0;
        if (isLeaving) {
          key = ancestors.length === 0 ? void 0 : path2[path2.length - 1];
          node = parent;
          parent = ancestors.pop();
          if (isEdited) {
            if (inArray) {
              node = node.slice();
              let editOffset = 0;
              for (const [editKey, editValue] of edits) {
                const arrayKey = editKey - editOffset;
                if (editValue === null) {
                  node.splice(arrayKey, 1);
                  editOffset++;
                } else {
                  node[arrayKey] = editValue;
                }
              }
            } else {
              node = Object.defineProperties(
                {},
                Object.getOwnPropertyDescriptors(node)
              );
              for (const [editKey, editValue] of edits) {
                node[editKey] = editValue;
              }
            }
          }
          index = stack.index;
          keys = stack.keys;
          edits = stack.edits;
          inArray = stack.inArray;
          stack = stack.prev;
        } else if (parent) {
          key = inArray ? index : keys[index];
          node = parent[key];
          if (node === null || node === void 0) {
            continue;
          }
          path2.push(key);
        }
        let result;
        if (!Array.isArray(node)) {
          var _enterLeaveMap$get, _enterLeaveMap$get2;
          (0, _ast.isNode)(node) || (0, _devAssert.devAssert)(
            false,
            `Invalid AST Node: ${(0, _inspect.inspect)(node)}.`
          );
          const visitFn = isLeaving ? (_enterLeaveMap$get = enterLeaveMap.get(node.kind)) === null || _enterLeaveMap$get === void 0 ? void 0 : _enterLeaveMap$get.leave : (_enterLeaveMap$get2 = enterLeaveMap.get(node.kind)) === null || _enterLeaveMap$get2 === void 0 ? void 0 : _enterLeaveMap$get2.enter;
          result = visitFn === null || visitFn === void 0 ? void 0 : visitFn.call(visitor, node, key, parent, path2, ancestors);
          if (result === BREAK) {
            break;
          }
          if (result === false) {
            if (!isLeaving) {
              path2.pop();
              continue;
            }
          } else if (result !== void 0) {
            edits.push([key, result]);
            if (!isLeaving) {
              if ((0, _ast.isNode)(result)) {
                node = result;
              } else {
                path2.pop();
                continue;
              }
            }
          }
        }
        if (result === void 0 && isEdited) {
          edits.push([key, node]);
        }
        if (isLeaving) {
          path2.pop();
        } else {
          var _node$kind;
          stack = {
            inArray,
            index,
            keys,
            edits,
            prev: stack
          };
          inArray = Array.isArray(node);
          keys = inArray ? node : (_node$kind = visitorKeys[node.kind]) !== null && _node$kind !== void 0 ? _node$kind : [];
          index = -1;
          edits = [];
          if (parent) {
            ancestors.push(parent);
          }
          parent = node;
        }
      } while (stack !== void 0);
      if (edits.length !== 0) {
        return edits[edits.length - 1][1];
      }
      return root;
    }
    function visitInParallel(visitors) {
      const skipping = new Array(visitors.length).fill(null);
      const mergedVisitor = /* @__PURE__ */ Object.create(null);
      for (const kind of Object.values(_kinds.Kind)) {
        let hasVisitor = false;
        const enterList = new Array(visitors.length).fill(void 0);
        const leaveList = new Array(visitors.length).fill(void 0);
        for (let i = 0; i < visitors.length; ++i) {
          const { enter, leave } = getEnterLeaveForKind(visitors[i], kind);
          hasVisitor || (hasVisitor = enter != null || leave != null);
          enterList[i] = enter;
          leaveList[i] = leave;
        }
        if (!hasVisitor) {
          continue;
        }
        const mergedEnterLeave = {
          enter(...args) {
            const node = args[0];
            for (let i = 0; i < visitors.length; i++) {
              if (skipping[i] === null) {
                var _enterList$i;
                const result = (_enterList$i = enterList[i]) === null || _enterList$i === void 0 ? void 0 : _enterList$i.apply(visitors[i], args);
                if (result === false) {
                  skipping[i] = node;
                } else if (result === BREAK) {
                  skipping[i] = BREAK;
                } else if (result !== void 0) {
                  return result;
                }
              }
            }
          },
          leave(...args) {
            const node = args[0];
            for (let i = 0; i < visitors.length; i++) {
              if (skipping[i] === null) {
                var _leaveList$i;
                const result = (_leaveList$i = leaveList[i]) === null || _leaveList$i === void 0 ? void 0 : _leaveList$i.apply(visitors[i], args);
                if (result === BREAK) {
                  skipping[i] = BREAK;
                } else if (result !== void 0 && result !== false) {
                  return result;
                }
              } else if (skipping[i] === node) {
                skipping[i] = null;
              }
            }
          }
        };
        mergedVisitor[kind] = mergedEnterLeave;
      }
      return mergedVisitor;
    }
    function getEnterLeaveForKind(visitor, kind) {
      const kindVisitor = visitor[kind];
      if (typeof kindVisitor === "object") {
        return kindVisitor;
      } else if (typeof kindVisitor === "function") {
        return {
          enter: kindVisitor,
          leave: void 0
        };
      }
      return {
        enter: visitor.enter,
        leave: visitor.leave
      };
    }
    function getVisitFn(visitor, kind, isLeaving) {
      const { enter, leave } = getEnterLeaveForKind(visitor, kind);
      return isLeaving ? leave : enter;
    }
  }
});

// node_modules/graphql/language/printer.js
var require_printer = __commonJS({
  "node_modules/graphql/language/printer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.print = print2;
    var _blockString = require_blockString();
    var _printString = require_printString();
    var _visitor = require_visitor();
    function print2(ast) {
      return (0, _visitor.visit)(ast, printDocASTReducer);
    }
    var MAX_LINE_LENGTH = 80;
    var printDocASTReducer = {
      Name: {
        leave: (node) => node.value
      },
      Variable: {
        leave: (node) => "$" + node.name
      },
      // Document
      Document: {
        leave: (node) => join(node.definitions, "\n\n")
      },
      OperationDefinition: {
        leave(node) {
          const varDefs = wrap("(", join(node.variableDefinitions, ", "), ")");
          const prefix = join(
            [
              node.operation,
              join([node.name, varDefs]),
              join(node.directives, " ")
            ],
            " "
          );
          return (prefix === "query" ? "" : prefix + " ") + node.selectionSet;
        }
      },
      VariableDefinition: {
        leave: ({ variable, type, defaultValue, directives }) => variable + ": " + type + wrap(" = ", defaultValue) + wrap(" ", join(directives, " "))
      },
      SelectionSet: {
        leave: ({ selections }) => block(selections)
      },
      Field: {
        leave({ alias, name, arguments: args, directives, selectionSet }) {
          const prefix = wrap("", alias, ": ") + name;
          let argsLine = prefix + wrap("(", join(args, ", "), ")");
          if (argsLine.length > MAX_LINE_LENGTH) {
            argsLine = prefix + wrap("(\n", indent(join(args, "\n")), "\n)");
          }
          return join([argsLine, join(directives, " "), selectionSet], " ");
        }
      },
      Argument: {
        leave: ({ name, value }) => name + ": " + value
      },
      // Fragments
      FragmentSpread: {
        leave: ({ name, directives }) => "..." + name + wrap(" ", join(directives, " "))
      },
      InlineFragment: {
        leave: ({ typeCondition, directives, selectionSet }) => join(
          [
            "...",
            wrap("on ", typeCondition),
            join(directives, " "),
            selectionSet
          ],
          " "
        )
      },
      FragmentDefinition: {
        leave: ({ name, typeCondition, variableDefinitions, directives, selectionSet }) => (
          // or removed in the future.
          `fragment ${name}${wrap("(", join(variableDefinitions, ", "), ")")} on ${typeCondition} ${wrap("", join(directives, " "), " ")}` + selectionSet
        )
      },
      // Value
      IntValue: {
        leave: ({ value }) => value
      },
      FloatValue: {
        leave: ({ value }) => value
      },
      StringValue: {
        leave: ({ value, block: isBlockString }) => isBlockString ? (0, _blockString.printBlockString)(value) : (0, _printString.printString)(value)
      },
      BooleanValue: {
        leave: ({ value }) => value ? "true" : "false"
      },
      NullValue: {
        leave: () => "null"
      },
      EnumValue: {
        leave: ({ value }) => value
      },
      ListValue: {
        leave: ({ values }) => "[" + join(values, ", ") + "]"
      },
      ObjectValue: {
        leave: ({ fields }) => "{" + join(fields, ", ") + "}"
      },
      ObjectField: {
        leave: ({ name, value }) => name + ": " + value
      },
      // Directive
      Directive: {
        leave: ({ name, arguments: args }) => "@" + name + wrap("(", join(args, ", "), ")")
      },
      // Type
      NamedType: {
        leave: ({ name }) => name
      },
      ListType: {
        leave: ({ type }) => "[" + type + "]"
      },
      NonNullType: {
        leave: ({ type }) => type + "!"
      },
      // Type System Definitions
      SchemaDefinition: {
        leave: ({ description, directives, operationTypes }) => wrap("", description, "\n") + join(["schema", join(directives, " "), block(operationTypes)], " ")
      },
      OperationTypeDefinition: {
        leave: ({ operation, type }) => operation + ": " + type
      },
      ScalarTypeDefinition: {
        leave: ({ description, name, directives }) => wrap("", description, "\n") + join(["scalar", name, join(directives, " ")], " ")
      },
      ObjectTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) => wrap("", description, "\n") + join(
          [
            "type",
            name,
            wrap("implements ", join(interfaces, " & ")),
            join(directives, " "),
            block(fields)
          ],
          " "
        )
      },
      FieldDefinition: {
        leave: ({ description, name, arguments: args, type, directives }) => wrap("", description, "\n") + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + ": " + type + wrap(" ", join(directives, " "))
      },
      InputValueDefinition: {
        leave: ({ description, name, type, defaultValue, directives }) => wrap("", description, "\n") + join(
          [name + ": " + type, wrap("= ", defaultValue), join(directives, " ")],
          " "
        )
      },
      InterfaceTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) => wrap("", description, "\n") + join(
          [
            "interface",
            name,
            wrap("implements ", join(interfaces, " & ")),
            join(directives, " "),
            block(fields)
          ],
          " "
        )
      },
      UnionTypeDefinition: {
        leave: ({ description, name, directives, types }) => wrap("", description, "\n") + join(
          ["union", name, join(directives, " "), wrap("= ", join(types, " | "))],
          " "
        )
      },
      EnumTypeDefinition: {
        leave: ({ description, name, directives, values }) => wrap("", description, "\n") + join(["enum", name, join(directives, " "), block(values)], " ")
      },
      EnumValueDefinition: {
        leave: ({ description, name, directives }) => wrap("", description, "\n") + join([name, join(directives, " ")], " ")
      },
      InputObjectTypeDefinition: {
        leave: ({ description, name, directives, fields }) => wrap("", description, "\n") + join(["input", name, join(directives, " "), block(fields)], " ")
      },
      DirectiveDefinition: {
        leave: ({ description, name, arguments: args, repeatable, locations }) => wrap("", description, "\n") + "directive @" + name + (hasMultilineItems(args) ? wrap("(\n", indent(join(args, "\n")), "\n)") : wrap("(", join(args, ", "), ")")) + (repeatable ? " repeatable" : "") + " on " + join(locations, " | ")
      },
      SchemaExtension: {
        leave: ({ directives, operationTypes }) => join(
          ["extend schema", join(directives, " "), block(operationTypes)],
          " "
        )
      },
      ScalarTypeExtension: {
        leave: ({ name, directives }) => join(["extend scalar", name, join(directives, " ")], " ")
      },
      ObjectTypeExtension: {
        leave: ({ name, interfaces, directives, fields }) => join(
          [
            "extend type",
            name,
            wrap("implements ", join(interfaces, " & ")),
            join(directives, " "),
            block(fields)
          ],
          " "
        )
      },
      InterfaceTypeExtension: {
        leave: ({ name, interfaces, directives, fields }) => join(
          [
            "extend interface",
            name,
            wrap("implements ", join(interfaces, " & ")),
            join(directives, " "),
            block(fields)
          ],
          " "
        )
      },
      UnionTypeExtension: {
        leave: ({ name, directives, types }) => join(
          [
            "extend union",
            name,
            join(directives, " "),
            wrap("= ", join(types, " | "))
          ],
          " "
        )
      },
      EnumTypeExtension: {
        leave: ({ name, directives, values }) => join(["extend enum", name, join(directives, " "), block(values)], " ")
      },
      InputObjectTypeExtension: {
        leave: ({ name, directives, fields }) => join(["extend input", name, join(directives, " "), block(fields)], " ")
      }
    };
    function join(maybeArray, separator = "") {
      var _maybeArray$filter$jo;
      return (_maybeArray$filter$jo = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.filter((x) => x).join(separator)) !== null && _maybeArray$filter$jo !== void 0 ? _maybeArray$filter$jo : "";
    }
    function block(array) {
      return wrap("{\n", indent(join(array, "\n")), "\n}");
    }
    function wrap(start, maybeString, end = "") {
      return maybeString != null && maybeString !== "" ? start + maybeString + end : "";
    }
    function indent(str) {
      return wrap("  ", str.replace(/\n/g, "\n  "));
    }
    function hasMultilineItems(maybeArray) {
      var _maybeArray$some;
      return (_maybeArray$some = maybeArray === null || maybeArray === void 0 ? void 0 : maybeArray.some((str) => str.includes("\n"))) !== null && _maybeArray$some !== void 0 ? _maybeArray$some : false;
    }
  }
});

// node_modules/graphql/utilities/valueFromASTUntyped.js
var require_valueFromASTUntyped = __commonJS({
  "node_modules/graphql/utilities/valueFromASTUntyped.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.valueFromASTUntyped = valueFromASTUntyped;
    var _keyValMap = require_keyValMap();
    var _kinds = require_kinds();
    function valueFromASTUntyped(valueNode, variables) {
      switch (valueNode.kind) {
        case _kinds.Kind.NULL:
          return null;
        case _kinds.Kind.INT:
          return parseInt(valueNode.value, 10);
        case _kinds.Kind.FLOAT:
          return parseFloat(valueNode.value);
        case _kinds.Kind.STRING:
        case _kinds.Kind.ENUM:
        case _kinds.Kind.BOOLEAN:
          return valueNode.value;
        case _kinds.Kind.LIST:
          return valueNode.values.map(
            (node) => valueFromASTUntyped(node, variables)
          );
        case _kinds.Kind.OBJECT:
          return (0, _keyValMap.keyValMap)(
            valueNode.fields,
            (field) => field.name.value,
            (field) => valueFromASTUntyped(field.value, variables)
          );
        case _kinds.Kind.VARIABLE:
          return variables === null || variables === void 0 ? void 0 : variables[valueNode.name.value];
      }
    }
  }
});

// node_modules/graphql/type/assertName.js
var require_assertName = __commonJS({
  "node_modules/graphql/type/assertName.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.assertEnumValueName = assertEnumValueName;
    exports2.assertName = assertName;
    var _devAssert = require_devAssert();
    var _GraphQLError = require_GraphQLError();
    var _characterClasses = require_characterClasses();
    function assertName(name) {
      name != null || (0, _devAssert.devAssert)(false, "Must provide name.");
      typeof name === "string" || (0, _devAssert.devAssert)(false, "Expected name to be a string.");
      if (name.length === 0) {
        throw new _GraphQLError.GraphQLError(
          "Expected name to be a non-empty string."
        );
      }
      for (let i = 1; i < name.length; ++i) {
        if (!(0, _characterClasses.isNameContinue)(name.charCodeAt(i))) {
          throw new _GraphQLError.GraphQLError(
            `Names must only contain [_a-zA-Z0-9] but "${name}" does not.`
          );
        }
      }
      if (!(0, _characterClasses.isNameStart)(name.charCodeAt(0))) {
        throw new _GraphQLError.GraphQLError(
          `Names must start with [_a-zA-Z] but "${name}" does not.`
        );
      }
      return name;
    }
    function assertEnumValueName(name) {
      if (name === "true" || name === "false" || name === "null") {
        throw new _GraphQLError.GraphQLError(
          `Enum values cannot be named: ${name}`
        );
      }
      return assertName(name);
    }
  }
});

// node_modules/graphql/type/definition.js
var require_definition = __commonJS({
  "node_modules/graphql/type/definition.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.GraphQLUnionType = exports2.GraphQLScalarType = exports2.GraphQLObjectType = exports2.GraphQLNonNull = exports2.GraphQLList = exports2.GraphQLInterfaceType = exports2.GraphQLInputObjectType = exports2.GraphQLEnumType = void 0;
    exports2.argsToArgsConfig = argsToArgsConfig;
    exports2.assertAbstractType = assertAbstractType;
    exports2.assertCompositeType = assertCompositeType;
    exports2.assertEnumType = assertEnumType;
    exports2.assertInputObjectType = assertInputObjectType;
    exports2.assertInputType = assertInputType;
    exports2.assertInterfaceType = assertInterfaceType;
    exports2.assertLeafType = assertLeafType;
    exports2.assertListType = assertListType;
    exports2.assertNamedType = assertNamedType;
    exports2.assertNonNullType = assertNonNullType;
    exports2.assertNullableType = assertNullableType;
    exports2.assertObjectType = assertObjectType;
    exports2.assertOutputType = assertOutputType;
    exports2.assertScalarType = assertScalarType;
    exports2.assertType = assertType;
    exports2.assertUnionType = assertUnionType;
    exports2.assertWrappingType = assertWrappingType;
    exports2.defineArguments = defineArguments;
    exports2.getNamedType = getNamedType;
    exports2.getNullableType = getNullableType;
    exports2.isAbstractType = isAbstractType;
    exports2.isCompositeType = isCompositeType;
    exports2.isEnumType = isEnumType;
    exports2.isInputObjectType = isInputObjectType;
    exports2.isInputType = isInputType;
    exports2.isInterfaceType = isInterfaceType;
    exports2.isLeafType = isLeafType;
    exports2.isListType = isListType;
    exports2.isNamedType = isNamedType;
    exports2.isNonNullType = isNonNullType;
    exports2.isNullableType = isNullableType;
    exports2.isObjectType = isObjectType;
    exports2.isOutputType = isOutputType;
    exports2.isRequiredArgument = isRequiredArgument;
    exports2.isRequiredInputField = isRequiredInputField;
    exports2.isScalarType = isScalarType;
    exports2.isType = isType;
    exports2.isUnionType = isUnionType;
    exports2.isWrappingType = isWrappingType;
    exports2.resolveObjMapThunk = resolveObjMapThunk;
    exports2.resolveReadonlyArrayThunk = resolveReadonlyArrayThunk;
    var _devAssert = require_devAssert();
    var _didYouMean = require_didYouMean();
    var _identityFunc = require_identityFunc();
    var _inspect = require_inspect();
    var _instanceOf = require_instanceOf();
    var _isObjectLike = require_isObjectLike();
    var _keyMap = require_keyMap();
    var _keyValMap = require_keyValMap();
    var _mapValue = require_mapValue();
    var _suggestionList = require_suggestionList();
    var _toObjMap = require_toObjMap();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _valueFromASTUntyped = require_valueFromASTUntyped();
    var _assertName = require_assertName();
    function isType(type) {
      return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type) || isListType(type) || isNonNullType(type);
    }
    function assertType(type) {
      if (!isType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL type.`
        );
      }
      return type;
    }
    function isScalarType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLScalarType);
    }
    function assertScalarType(type) {
      if (!isScalarType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL Scalar type.`
        );
      }
      return type;
    }
    function isObjectType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLObjectType);
    }
    function assertObjectType(type) {
      if (!isObjectType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL Object type.`
        );
      }
      return type;
    }
    function isInterfaceType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLInterfaceType);
    }
    function assertInterfaceType(type) {
      if (!isInterfaceType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL Interface type.`
        );
      }
      return type;
    }
    function isUnionType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLUnionType);
    }
    function assertUnionType(type) {
      if (!isUnionType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL Union type.`
        );
      }
      return type;
    }
    function isEnumType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLEnumType);
    }
    function assertEnumType(type) {
      if (!isEnumType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL Enum type.`
        );
      }
      return type;
    }
    function isInputObjectType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLInputObjectType);
    }
    function assertInputObjectType(type) {
      if (!isInputObjectType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(
            type
          )} to be a GraphQL Input Object type.`
        );
      }
      return type;
    }
    function isListType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLList);
    }
    function assertListType(type) {
      if (!isListType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL List type.`
        );
      }
      return type;
    }
    function isNonNullType(type) {
      return (0, _instanceOf.instanceOf)(type, GraphQLNonNull);
    }
    function assertNonNullType(type) {
      if (!isNonNullType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL Non-Null type.`
        );
      }
      return type;
    }
    function isInputType(type) {
      return isScalarType(type) || isEnumType(type) || isInputObjectType(type) || isWrappingType(type) && isInputType(type.ofType);
    }
    function assertInputType(type) {
      if (!isInputType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL input type.`
        );
      }
      return type;
    }
    function isOutputType(type) {
      return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isWrappingType(type) && isOutputType(type.ofType);
    }
    function assertOutputType(type) {
      if (!isOutputType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL output type.`
        );
      }
      return type;
    }
    function isLeafType(type) {
      return isScalarType(type) || isEnumType(type);
    }
    function assertLeafType(type) {
      if (!isLeafType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL leaf type.`
        );
      }
      return type;
    }
    function isCompositeType(type) {
      return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
    }
    function assertCompositeType(type) {
      if (!isCompositeType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL composite type.`
        );
      }
      return type;
    }
    function isAbstractType(type) {
      return isInterfaceType(type) || isUnionType(type);
    }
    function assertAbstractType(type) {
      if (!isAbstractType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL abstract type.`
        );
      }
      return type;
    }
    var GraphQLList = class {
      constructor(ofType) {
        isType(ofType) || (0, _devAssert.devAssert)(
          false,
          `Expected ${(0, _inspect.inspect)(ofType)} to be a GraphQL type.`
        );
        this.ofType = ofType;
      }
      get [Symbol.toStringTag]() {
        return "GraphQLList";
      }
      toString() {
        return "[" + String(this.ofType) + "]";
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLList = GraphQLList;
    var GraphQLNonNull = class {
      constructor(ofType) {
        isNullableType(ofType) || (0, _devAssert.devAssert)(
          false,
          `Expected ${(0, _inspect.inspect)(
            ofType
          )} to be a GraphQL nullable type.`
        );
        this.ofType = ofType;
      }
      get [Symbol.toStringTag]() {
        return "GraphQLNonNull";
      }
      toString() {
        return String(this.ofType) + "!";
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLNonNull = GraphQLNonNull;
    function isWrappingType(type) {
      return isListType(type) || isNonNullType(type);
    }
    function assertWrappingType(type) {
      if (!isWrappingType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL wrapping type.`
        );
      }
      return type;
    }
    function isNullableType(type) {
      return isType(type) && !isNonNullType(type);
    }
    function assertNullableType(type) {
      if (!isNullableType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL nullable type.`
        );
      }
      return type;
    }
    function getNullableType(type) {
      if (type) {
        return isNonNullType(type) ? type.ofType : type;
      }
    }
    function isNamedType(type) {
      return isScalarType(type) || isObjectType(type) || isInterfaceType(type) || isUnionType(type) || isEnumType(type) || isInputObjectType(type);
    }
    function assertNamedType(type) {
      if (!isNamedType(type)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(type)} to be a GraphQL named type.`
        );
      }
      return type;
    }
    function getNamedType(type) {
      if (type) {
        let unwrappedType = type;
        while (isWrappingType(unwrappedType)) {
          unwrappedType = unwrappedType.ofType;
        }
        return unwrappedType;
      }
    }
    function resolveReadonlyArrayThunk(thunk) {
      return typeof thunk === "function" ? thunk() : thunk;
    }
    function resolveObjMapThunk(thunk) {
      return typeof thunk === "function" ? thunk() : thunk;
    }
    var GraphQLScalarType = class {
      constructor(config) {
        var _config$parseValue, _config$serialize, _config$parseLiteral, _config$extensionASTN;
        const parseValue = (_config$parseValue = config.parseValue) !== null && _config$parseValue !== void 0 ? _config$parseValue : _identityFunc.identityFunc;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.specifiedByURL = config.specifiedByURL;
        this.serialize = (_config$serialize = config.serialize) !== null && _config$serialize !== void 0 ? _config$serialize : _identityFunc.identityFunc;
        this.parseValue = parseValue;
        this.parseLiteral = (_config$parseLiteral = config.parseLiteral) !== null && _config$parseLiteral !== void 0 ? _config$parseLiteral : (node, variables) => parseValue(
          (0, _valueFromASTUntyped.valueFromASTUntyped)(node, variables)
        );
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN = config.extensionASTNodes) !== null && _config$extensionASTN !== void 0 ? _config$extensionASTN : [];
        config.specifiedByURL == null || typeof config.specifiedByURL === "string" || (0, _devAssert.devAssert)(
          false,
          `${this.name} must provide "specifiedByURL" as a string, but got: ${(0, _inspect.inspect)(config.specifiedByURL)}.`
        );
        config.serialize == null || typeof config.serialize === "function" || (0, _devAssert.devAssert)(
          false,
          `${this.name} must provide "serialize" function. If this custom Scalar is also used as an input type, ensure "parseValue" and "parseLiteral" functions are also provided.`
        );
        if (config.parseLiteral) {
          typeof config.parseValue === "function" && typeof config.parseLiteral === "function" || (0, _devAssert.devAssert)(
            false,
            `${this.name} must provide both "parseValue" and "parseLiteral" functions.`
          );
        }
      }
      get [Symbol.toStringTag]() {
        return "GraphQLScalarType";
      }
      toConfig() {
        return {
          name: this.name,
          description: this.description,
          specifiedByURL: this.specifiedByURL,
          serialize: this.serialize,
          parseValue: this.parseValue,
          parseLiteral: this.parseLiteral,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes
        };
      }
      toString() {
        return this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLScalarType = GraphQLScalarType;
    var GraphQLObjectType = class {
      constructor(config) {
        var _config$extensionASTN2;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.isTypeOf = config.isTypeOf;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN2 = config.extensionASTNodes) !== null && _config$extensionASTN2 !== void 0 ? _config$extensionASTN2 : [];
        this._fields = () => defineFieldMap(config);
        this._interfaces = () => defineInterfaces(config);
        config.isTypeOf == null || typeof config.isTypeOf === "function" || (0, _devAssert.devAssert)(
          false,
          `${this.name} must provide "isTypeOf" as a function, but got: ${(0, _inspect.inspect)(config.isTypeOf)}.`
        );
      }
      get [Symbol.toStringTag]() {
        return "GraphQLObjectType";
      }
      getFields() {
        if (typeof this._fields === "function") {
          this._fields = this._fields();
        }
        return this._fields;
      }
      getInterfaces() {
        if (typeof this._interfaces === "function") {
          this._interfaces = this._interfaces();
        }
        return this._interfaces;
      }
      toConfig() {
        return {
          name: this.name,
          description: this.description,
          interfaces: this.getInterfaces(),
          fields: fieldsToFieldsConfig(this.getFields()),
          isTypeOf: this.isTypeOf,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes
        };
      }
      toString() {
        return this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLObjectType = GraphQLObjectType;
    function defineInterfaces(config) {
      var _config$interfaces;
      const interfaces = resolveReadonlyArrayThunk(
        (_config$interfaces = config.interfaces) !== null && _config$interfaces !== void 0 ? _config$interfaces : []
      );
      Array.isArray(interfaces) || (0, _devAssert.devAssert)(
        false,
        `${config.name} interfaces must be an Array or a function which returns an Array.`
      );
      return interfaces;
    }
    function defineFieldMap(config) {
      const fieldMap = resolveObjMapThunk(config.fields);
      isPlainObj(fieldMap) || (0, _devAssert.devAssert)(
        false,
        `${config.name} fields must be an object with field names as keys or a function which returns such an object.`
      );
      return (0, _mapValue.mapValue)(fieldMap, (fieldConfig, fieldName) => {
        var _fieldConfig$args;
        isPlainObj(fieldConfig) || (0, _devAssert.devAssert)(
          false,
          `${config.name}.${fieldName} field config must be an object.`
        );
        fieldConfig.resolve == null || typeof fieldConfig.resolve === "function" || (0, _devAssert.devAssert)(
          false,
          `${config.name}.${fieldName} field resolver must be a function if provided, but got: ${(0, _inspect.inspect)(fieldConfig.resolve)}.`
        );
        const argsConfig = (_fieldConfig$args = fieldConfig.args) !== null && _fieldConfig$args !== void 0 ? _fieldConfig$args : {};
        isPlainObj(argsConfig) || (0, _devAssert.devAssert)(
          false,
          `${config.name}.${fieldName} args must be an object with argument names as keys.`
        );
        return {
          name: (0, _assertName.assertName)(fieldName),
          description: fieldConfig.description,
          type: fieldConfig.type,
          args: defineArguments(argsConfig),
          resolve: fieldConfig.resolve,
          subscribe: fieldConfig.subscribe,
          deprecationReason: fieldConfig.deprecationReason,
          extensions: (0, _toObjMap.toObjMap)(fieldConfig.extensions),
          astNode: fieldConfig.astNode
        };
      });
    }
    function defineArguments(config) {
      return Object.entries(config).map(([argName, argConfig]) => ({
        name: (0, _assertName.assertName)(argName),
        description: argConfig.description,
        type: argConfig.type,
        defaultValue: argConfig.defaultValue,
        deprecationReason: argConfig.deprecationReason,
        extensions: (0, _toObjMap.toObjMap)(argConfig.extensions),
        astNode: argConfig.astNode
      }));
    }
    function isPlainObj(obj) {
      return (0, _isObjectLike.isObjectLike)(obj) && !Array.isArray(obj);
    }
    function fieldsToFieldsConfig(fields) {
      return (0, _mapValue.mapValue)(fields, (field) => ({
        description: field.description,
        type: field.type,
        args: argsToArgsConfig(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        extensions: field.extensions,
        astNode: field.astNode
      }));
    }
    function argsToArgsConfig(args) {
      return (0, _keyValMap.keyValMap)(
        args,
        (arg) => arg.name,
        (arg) => ({
          description: arg.description,
          type: arg.type,
          defaultValue: arg.defaultValue,
          deprecationReason: arg.deprecationReason,
          extensions: arg.extensions,
          astNode: arg.astNode
        })
      );
    }
    function isRequiredArgument(arg) {
      return isNonNullType(arg.type) && arg.defaultValue === void 0;
    }
    var GraphQLInterfaceType = class {
      constructor(config) {
        var _config$extensionASTN3;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN3 = config.extensionASTNodes) !== null && _config$extensionASTN3 !== void 0 ? _config$extensionASTN3 : [];
        this._fields = defineFieldMap.bind(void 0, config);
        this._interfaces = defineInterfaces.bind(void 0, config);
        config.resolveType == null || typeof config.resolveType === "function" || (0, _devAssert.devAssert)(
          false,
          `${this.name} must provide "resolveType" as a function, but got: ${(0, _inspect.inspect)(config.resolveType)}.`
        );
      }
      get [Symbol.toStringTag]() {
        return "GraphQLInterfaceType";
      }
      getFields() {
        if (typeof this._fields === "function") {
          this._fields = this._fields();
        }
        return this._fields;
      }
      getInterfaces() {
        if (typeof this._interfaces === "function") {
          this._interfaces = this._interfaces();
        }
        return this._interfaces;
      }
      toConfig() {
        return {
          name: this.name,
          description: this.description,
          interfaces: this.getInterfaces(),
          fields: fieldsToFieldsConfig(this.getFields()),
          resolveType: this.resolveType,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes
        };
      }
      toString() {
        return this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLInterfaceType = GraphQLInterfaceType;
    var GraphQLUnionType = class {
      constructor(config) {
        var _config$extensionASTN4;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN4 = config.extensionASTNodes) !== null && _config$extensionASTN4 !== void 0 ? _config$extensionASTN4 : [];
        this._types = defineTypes.bind(void 0, config);
        config.resolveType == null || typeof config.resolveType === "function" || (0, _devAssert.devAssert)(
          false,
          `${this.name} must provide "resolveType" as a function, but got: ${(0, _inspect.inspect)(config.resolveType)}.`
        );
      }
      get [Symbol.toStringTag]() {
        return "GraphQLUnionType";
      }
      getTypes() {
        if (typeof this._types === "function") {
          this._types = this._types();
        }
        return this._types;
      }
      toConfig() {
        return {
          name: this.name,
          description: this.description,
          types: this.getTypes(),
          resolveType: this.resolveType,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes
        };
      }
      toString() {
        return this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLUnionType = GraphQLUnionType;
    function defineTypes(config) {
      const types = resolveReadonlyArrayThunk(config.types);
      Array.isArray(types) || (0, _devAssert.devAssert)(
        false,
        `Must provide Array of types or a function which returns such an array for Union ${config.name}.`
      );
      return types;
    }
    var GraphQLEnumType = class {
      /* <T> */
      constructor(config) {
        var _config$extensionASTN5;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN5 = config.extensionASTNodes) !== null && _config$extensionASTN5 !== void 0 ? _config$extensionASTN5 : [];
        this._values = typeof config.values === "function" ? config.values : defineEnumValues(this.name, config.values);
        this._valueLookup = null;
        this._nameLookup = null;
      }
      get [Symbol.toStringTag]() {
        return "GraphQLEnumType";
      }
      getValues() {
        if (typeof this._values === "function") {
          this._values = defineEnumValues(this.name, this._values());
        }
        return this._values;
      }
      getValue(name) {
        if (this._nameLookup === null) {
          this._nameLookup = (0, _keyMap.keyMap)(
            this.getValues(),
            (value) => value.name
          );
        }
        return this._nameLookup[name];
      }
      serialize(outputValue) {
        if (this._valueLookup === null) {
          this._valueLookup = new Map(
            this.getValues().map((enumValue2) => [enumValue2.value, enumValue2])
          );
        }
        const enumValue = this._valueLookup.get(outputValue);
        if (enumValue === void 0) {
          throw new _GraphQLError.GraphQLError(
            `Enum "${this.name}" cannot represent value: ${(0, _inspect.inspect)(
              outputValue
            )}`
          );
        }
        return enumValue.name;
      }
      parseValue(inputValue) {
        if (typeof inputValue !== "string") {
          const valueStr = (0, _inspect.inspect)(inputValue);
          throw new _GraphQLError.GraphQLError(
            `Enum "${this.name}" cannot represent non-string value: ${valueStr}.` + didYouMeanEnumValue(this, valueStr)
          );
        }
        const enumValue = this.getValue(inputValue);
        if (enumValue == null) {
          throw new _GraphQLError.GraphQLError(
            `Value "${inputValue}" does not exist in "${this.name}" enum.` + didYouMeanEnumValue(this, inputValue)
          );
        }
        return enumValue.value;
      }
      parseLiteral(valueNode, _variables) {
        if (valueNode.kind !== _kinds.Kind.ENUM) {
          const valueStr = (0, _printer.print)(valueNode);
          throw new _GraphQLError.GraphQLError(
            `Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` + didYouMeanEnumValue(this, valueStr),
            {
              nodes: valueNode
            }
          );
        }
        const enumValue = this.getValue(valueNode.value);
        if (enumValue == null) {
          const valueStr = (0, _printer.print)(valueNode);
          throw new _GraphQLError.GraphQLError(
            `Value "${valueStr}" does not exist in "${this.name}" enum.` + didYouMeanEnumValue(this, valueStr),
            {
              nodes: valueNode
            }
          );
        }
        return enumValue.value;
      }
      toConfig() {
        const values = (0, _keyValMap.keyValMap)(
          this.getValues(),
          (value) => value.name,
          (value) => ({
            description: value.description,
            value: value.value,
            deprecationReason: value.deprecationReason,
            extensions: value.extensions,
            astNode: value.astNode
          })
        );
        return {
          name: this.name,
          description: this.description,
          values,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes
        };
      }
      toString() {
        return this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLEnumType = GraphQLEnumType;
    function didYouMeanEnumValue(enumType, unknownValueStr) {
      const allNames = enumType.getValues().map((value) => value.name);
      const suggestedValues = (0, _suggestionList.suggestionList)(
        unknownValueStr,
        allNames
      );
      return (0, _didYouMean.didYouMean)("the enum value", suggestedValues);
    }
    function defineEnumValues(typeName, valueMap) {
      isPlainObj(valueMap) || (0, _devAssert.devAssert)(
        false,
        `${typeName} values must be an object with value names as keys.`
      );
      return Object.entries(valueMap).map(([valueName, valueConfig]) => {
        isPlainObj(valueConfig) || (0, _devAssert.devAssert)(
          false,
          `${typeName}.${valueName} must refer to an object with a "value" key representing an internal value but got: ${(0, _inspect.inspect)(
            valueConfig
          )}.`
        );
        return {
          name: (0, _assertName.assertEnumValueName)(valueName),
          description: valueConfig.description,
          value: valueConfig.value !== void 0 ? valueConfig.value : valueName,
          deprecationReason: valueConfig.deprecationReason,
          extensions: (0, _toObjMap.toObjMap)(valueConfig.extensions),
          astNode: valueConfig.astNode
        };
      });
    }
    var GraphQLInputObjectType = class {
      constructor(config) {
        var _config$extensionASTN6, _config$isOneOf;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN6 = config.extensionASTNodes) !== null && _config$extensionASTN6 !== void 0 ? _config$extensionASTN6 : [];
        this.isOneOf = (_config$isOneOf = config.isOneOf) !== null && _config$isOneOf !== void 0 ? _config$isOneOf : false;
        this._fields = defineInputFieldMap.bind(void 0, config);
      }
      get [Symbol.toStringTag]() {
        return "GraphQLInputObjectType";
      }
      getFields() {
        if (typeof this._fields === "function") {
          this._fields = this._fields();
        }
        return this._fields;
      }
      toConfig() {
        const fields = (0, _mapValue.mapValue)(this.getFields(), (field) => ({
          description: field.description,
          type: field.type,
          defaultValue: field.defaultValue,
          deprecationReason: field.deprecationReason,
          extensions: field.extensions,
          astNode: field.astNode
        }));
        return {
          name: this.name,
          description: this.description,
          fields,
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes,
          isOneOf: this.isOneOf
        };
      }
      toString() {
        return this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLInputObjectType = GraphQLInputObjectType;
    function defineInputFieldMap(config) {
      const fieldMap = resolveObjMapThunk(config.fields);
      isPlainObj(fieldMap) || (0, _devAssert.devAssert)(
        false,
        `${config.name} fields must be an object with field names as keys or a function which returns such an object.`
      );
      return (0, _mapValue.mapValue)(fieldMap, (fieldConfig, fieldName) => {
        !("resolve" in fieldConfig) || (0, _devAssert.devAssert)(
          false,
          `${config.name}.${fieldName} field has a resolve property, but Input Types cannot define resolvers.`
        );
        return {
          name: (0, _assertName.assertName)(fieldName),
          description: fieldConfig.description,
          type: fieldConfig.type,
          defaultValue: fieldConfig.defaultValue,
          deprecationReason: fieldConfig.deprecationReason,
          extensions: (0, _toObjMap.toObjMap)(fieldConfig.extensions),
          astNode: fieldConfig.astNode
        };
      });
    }
    function isRequiredInputField(field) {
      return isNonNullType(field.type) && field.defaultValue === void 0;
    }
  }
});

// node_modules/graphql/utilities/typeComparators.js
var require_typeComparators = __commonJS({
  "node_modules/graphql/utilities/typeComparators.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.doTypesOverlap = doTypesOverlap;
    exports2.isEqualType = isEqualType;
    exports2.isTypeSubTypeOf = isTypeSubTypeOf;
    var _definition = require_definition();
    function isEqualType(typeA, typeB) {
      if (typeA === typeB) {
        return true;
      }
      if ((0, _definition.isNonNullType)(typeA) && (0, _definition.isNonNullType)(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
      }
      if ((0, _definition.isListType)(typeA) && (0, _definition.isListType)(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
      }
      return false;
    }
    function isTypeSubTypeOf(schema, maybeSubType, superType) {
      if (maybeSubType === superType) {
        return true;
      }
      if ((0, _definition.isNonNullType)(superType)) {
        if ((0, _definition.isNonNullType)(maybeSubType)) {
          return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
      }
      if ((0, _definition.isNonNullType)(maybeSubType)) {
        return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
      }
      if ((0, _definition.isListType)(superType)) {
        if ((0, _definition.isListType)(maybeSubType)) {
          return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
      }
      if ((0, _definition.isListType)(maybeSubType)) {
        return false;
      }
      return (0, _definition.isAbstractType)(superType) && ((0, _definition.isInterfaceType)(maybeSubType) || (0, _definition.isObjectType)(maybeSubType)) && schema.isSubType(superType, maybeSubType);
    }
    function doTypesOverlap(schema, typeA, typeB) {
      if (typeA === typeB) {
        return true;
      }
      if ((0, _definition.isAbstractType)(typeA)) {
        if ((0, _definition.isAbstractType)(typeB)) {
          return schema.getPossibleTypes(typeA).some((type) => schema.isSubType(typeB, type));
        }
        return schema.isSubType(typeA, typeB);
      }
      if ((0, _definition.isAbstractType)(typeB)) {
        return schema.isSubType(typeB, typeA);
      }
      return false;
    }
  }
});

// node_modules/graphql/type/scalars.js
var require_scalars = __commonJS({
  "node_modules/graphql/type/scalars.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.GraphQLString = exports2.GraphQLInt = exports2.GraphQLID = exports2.GraphQLFloat = exports2.GraphQLBoolean = exports2.GRAPHQL_MIN_INT = exports2.GRAPHQL_MAX_INT = void 0;
    exports2.isSpecifiedScalarType = isSpecifiedScalarType;
    exports2.specifiedScalarTypes = void 0;
    var _inspect = require_inspect();
    var _isObjectLike = require_isObjectLike();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var GRAPHQL_MAX_INT = 2147483647;
    exports2.GRAPHQL_MAX_INT = GRAPHQL_MAX_INT;
    var GRAPHQL_MIN_INT = -2147483648;
    exports2.GRAPHQL_MIN_INT = GRAPHQL_MIN_INT;
    var GraphQLInt = new _definition.GraphQLScalarType({
      name: "Int",
      description: "The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.",
      serialize(outputValue) {
        const coercedValue = serializeObject(outputValue);
        if (typeof coercedValue === "boolean") {
          return coercedValue ? 1 : 0;
        }
        let num = coercedValue;
        if (typeof coercedValue === "string" && coercedValue !== "") {
          num = Number(coercedValue);
        }
        if (typeof num !== "number" || !Number.isInteger(num)) {
          throw new _GraphQLError.GraphQLError(
            `Int cannot represent non-integer value: ${(0, _inspect.inspect)(
              coercedValue
            )}`
          );
        }
        if (num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT) {
          throw new _GraphQLError.GraphQLError(
            "Int cannot represent non 32-bit signed integer value: " + (0, _inspect.inspect)(coercedValue)
          );
        }
        return num;
      },
      parseValue(inputValue) {
        if (typeof inputValue !== "number" || !Number.isInteger(inputValue)) {
          throw new _GraphQLError.GraphQLError(
            `Int cannot represent non-integer value: ${(0, _inspect.inspect)(
              inputValue
            )}`
          );
        }
        if (inputValue > GRAPHQL_MAX_INT || inputValue < GRAPHQL_MIN_INT) {
          throw new _GraphQLError.GraphQLError(
            `Int cannot represent non 32-bit signed integer value: ${inputValue}`
          );
        }
        return inputValue;
      },
      parseLiteral(valueNode) {
        if (valueNode.kind !== _kinds.Kind.INT) {
          throw new _GraphQLError.GraphQLError(
            `Int cannot represent non-integer value: ${(0, _printer.print)(
              valueNode
            )}`,
            {
              nodes: valueNode
            }
          );
        }
        const num = parseInt(valueNode.value, 10);
        if (num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT) {
          throw new _GraphQLError.GraphQLError(
            `Int cannot represent non 32-bit signed integer value: ${valueNode.value}`,
            {
              nodes: valueNode
            }
          );
        }
        return num;
      }
    });
    exports2.GraphQLInt = GraphQLInt;
    var GraphQLFloat = new _definition.GraphQLScalarType({
      name: "Float",
      description: "The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).",
      serialize(outputValue) {
        const coercedValue = serializeObject(outputValue);
        if (typeof coercedValue === "boolean") {
          return coercedValue ? 1 : 0;
        }
        let num = coercedValue;
        if (typeof coercedValue === "string" && coercedValue !== "") {
          num = Number(coercedValue);
        }
        if (typeof num !== "number" || !Number.isFinite(num)) {
          throw new _GraphQLError.GraphQLError(
            `Float cannot represent non numeric value: ${(0, _inspect.inspect)(
              coercedValue
            )}`
          );
        }
        return num;
      },
      parseValue(inputValue) {
        if (typeof inputValue !== "number" || !Number.isFinite(inputValue)) {
          throw new _GraphQLError.GraphQLError(
            `Float cannot represent non numeric value: ${(0, _inspect.inspect)(
              inputValue
            )}`
          );
        }
        return inputValue;
      },
      parseLiteral(valueNode) {
        if (valueNode.kind !== _kinds.Kind.FLOAT && valueNode.kind !== _kinds.Kind.INT) {
          throw new _GraphQLError.GraphQLError(
            `Float cannot represent non numeric value: ${(0, _printer.print)(
              valueNode
            )}`,
            valueNode
          );
        }
        return parseFloat(valueNode.value);
      }
    });
    exports2.GraphQLFloat = GraphQLFloat;
    var GraphQLString = new _definition.GraphQLScalarType({
      name: "String",
      description: "The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.",
      serialize(outputValue) {
        const coercedValue = serializeObject(outputValue);
        if (typeof coercedValue === "string") {
          return coercedValue;
        }
        if (typeof coercedValue === "boolean") {
          return coercedValue ? "true" : "false";
        }
        if (typeof coercedValue === "number" && Number.isFinite(coercedValue)) {
          return coercedValue.toString();
        }
        throw new _GraphQLError.GraphQLError(
          `String cannot represent value: ${(0, _inspect.inspect)(outputValue)}`
        );
      },
      parseValue(inputValue) {
        if (typeof inputValue !== "string") {
          throw new _GraphQLError.GraphQLError(
            `String cannot represent a non string value: ${(0, _inspect.inspect)(
              inputValue
            )}`
          );
        }
        return inputValue;
      },
      parseLiteral(valueNode) {
        if (valueNode.kind !== _kinds.Kind.STRING) {
          throw new _GraphQLError.GraphQLError(
            `String cannot represent a non string value: ${(0, _printer.print)(
              valueNode
            )}`,
            {
              nodes: valueNode
            }
          );
        }
        return valueNode.value;
      }
    });
    exports2.GraphQLString = GraphQLString;
    var GraphQLBoolean = new _definition.GraphQLScalarType({
      name: "Boolean",
      description: "The `Boolean` scalar type represents `true` or `false`.",
      serialize(outputValue) {
        const coercedValue = serializeObject(outputValue);
        if (typeof coercedValue === "boolean") {
          return coercedValue;
        }
        if (Number.isFinite(coercedValue)) {
          return coercedValue !== 0;
        }
        throw new _GraphQLError.GraphQLError(
          `Boolean cannot represent a non boolean value: ${(0, _inspect.inspect)(
            coercedValue
          )}`
        );
      },
      parseValue(inputValue) {
        if (typeof inputValue !== "boolean") {
          throw new _GraphQLError.GraphQLError(
            `Boolean cannot represent a non boolean value: ${(0, _inspect.inspect)(
              inputValue
            )}`
          );
        }
        return inputValue;
      },
      parseLiteral(valueNode) {
        if (valueNode.kind !== _kinds.Kind.BOOLEAN) {
          throw new _GraphQLError.GraphQLError(
            `Boolean cannot represent a non boolean value: ${(0, _printer.print)(
              valueNode
            )}`,
            {
              nodes: valueNode
            }
          );
        }
        return valueNode.value;
      }
    });
    exports2.GraphQLBoolean = GraphQLBoolean;
    var GraphQLID = new _definition.GraphQLScalarType({
      name: "ID",
      description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
      serialize(outputValue) {
        const coercedValue = serializeObject(outputValue);
        if (typeof coercedValue === "string") {
          return coercedValue;
        }
        if (Number.isInteger(coercedValue)) {
          return String(coercedValue);
        }
        throw new _GraphQLError.GraphQLError(
          `ID cannot represent value: ${(0, _inspect.inspect)(outputValue)}`
        );
      },
      parseValue(inputValue) {
        if (typeof inputValue === "string") {
          return inputValue;
        }
        if (typeof inputValue === "number" && Number.isInteger(inputValue)) {
          return inputValue.toString();
        }
        throw new _GraphQLError.GraphQLError(
          `ID cannot represent value: ${(0, _inspect.inspect)(inputValue)}`
        );
      },
      parseLiteral(valueNode) {
        if (valueNode.kind !== _kinds.Kind.STRING && valueNode.kind !== _kinds.Kind.INT) {
          throw new _GraphQLError.GraphQLError(
            "ID cannot represent a non-string and non-integer value: " + (0, _printer.print)(valueNode),
            {
              nodes: valueNode
            }
          );
        }
        return valueNode.value;
      }
    });
    exports2.GraphQLID = GraphQLID;
    var specifiedScalarTypes = Object.freeze([
      GraphQLString,
      GraphQLInt,
      GraphQLFloat,
      GraphQLBoolean,
      GraphQLID
    ]);
    exports2.specifiedScalarTypes = specifiedScalarTypes;
    function isSpecifiedScalarType(type) {
      return specifiedScalarTypes.some(({ name }) => type.name === name);
    }
    function serializeObject(outputValue) {
      if ((0, _isObjectLike.isObjectLike)(outputValue)) {
        if (typeof outputValue.valueOf === "function") {
          const valueOfResult = outputValue.valueOf();
          if (!(0, _isObjectLike.isObjectLike)(valueOfResult)) {
            return valueOfResult;
          }
        }
        if (typeof outputValue.toJSON === "function") {
          return outputValue.toJSON();
        }
      }
      return outputValue;
    }
  }
});

// node_modules/graphql/type/directives.js
var require_directives = __commonJS({
  "node_modules/graphql/type/directives.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.GraphQLSpecifiedByDirective = exports2.GraphQLSkipDirective = exports2.GraphQLOneOfDirective = exports2.GraphQLIncludeDirective = exports2.GraphQLDirective = exports2.GraphQLDeprecatedDirective = exports2.DEFAULT_DEPRECATION_REASON = void 0;
    exports2.assertDirective = assertDirective;
    exports2.isDirective = isDirective;
    exports2.isSpecifiedDirective = isSpecifiedDirective;
    exports2.specifiedDirectives = void 0;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _instanceOf = require_instanceOf();
    var _isObjectLike = require_isObjectLike();
    var _toObjMap = require_toObjMap();
    var _directiveLocation = require_directiveLocation();
    var _assertName = require_assertName();
    var _definition = require_definition();
    var _scalars = require_scalars();
    function isDirective(directive) {
      return (0, _instanceOf.instanceOf)(directive, GraphQLDirective);
    }
    function assertDirective(directive) {
      if (!isDirective(directive)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(directive)} to be a GraphQL directive.`
        );
      }
      return directive;
    }
    var GraphQLDirective = class {
      constructor(config) {
        var _config$isRepeatable, _config$args;
        this.name = (0, _assertName.assertName)(config.name);
        this.description = config.description;
        this.locations = config.locations;
        this.isRepeatable = (_config$isRepeatable = config.isRepeatable) !== null && _config$isRepeatable !== void 0 ? _config$isRepeatable : false;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        Array.isArray(config.locations) || (0, _devAssert.devAssert)(
          false,
          `@${config.name} locations must be an Array.`
        );
        const args = (_config$args = config.args) !== null && _config$args !== void 0 ? _config$args : {};
        (0, _isObjectLike.isObjectLike)(args) && !Array.isArray(args) || (0, _devAssert.devAssert)(
          false,
          `@${config.name} args must be an object with argument names as keys.`
        );
        this.args = (0, _definition.defineArguments)(args);
      }
      get [Symbol.toStringTag]() {
        return "GraphQLDirective";
      }
      toConfig() {
        return {
          name: this.name,
          description: this.description,
          locations: this.locations,
          args: (0, _definition.argsToArgsConfig)(this.args),
          isRepeatable: this.isRepeatable,
          extensions: this.extensions,
          astNode: this.astNode
        };
      }
      toString() {
        return "@" + this.name;
      }
      toJSON() {
        return this.toString();
      }
    };
    exports2.GraphQLDirective = GraphQLDirective;
    var GraphQLIncludeDirective = new GraphQLDirective({
      name: "include",
      description: "Directs the executor to include this field or fragment only when the `if` argument is true.",
      locations: [
        _directiveLocation.DirectiveLocation.FIELD,
        _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD,
        _directiveLocation.DirectiveLocation.INLINE_FRAGMENT
      ],
      args: {
        if: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
          description: "Included when true."
        }
      }
    });
    exports2.GraphQLIncludeDirective = GraphQLIncludeDirective;
    var GraphQLSkipDirective = new GraphQLDirective({
      name: "skip",
      description: "Directs the executor to skip this field or fragment when the `if` argument is true.",
      locations: [
        _directiveLocation.DirectiveLocation.FIELD,
        _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD,
        _directiveLocation.DirectiveLocation.INLINE_FRAGMENT
      ],
      args: {
        if: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
          description: "Skipped when true."
        }
      }
    });
    exports2.GraphQLSkipDirective = GraphQLSkipDirective;
    var DEFAULT_DEPRECATION_REASON = "No longer supported";
    exports2.DEFAULT_DEPRECATION_REASON = DEFAULT_DEPRECATION_REASON;
    var GraphQLDeprecatedDirective = new GraphQLDirective({
      name: "deprecated",
      description: "Marks an element of a GraphQL schema as no longer supported.",
      locations: [
        _directiveLocation.DirectiveLocation.FIELD_DEFINITION,
        _directiveLocation.DirectiveLocation.ARGUMENT_DEFINITION,
        _directiveLocation.DirectiveLocation.INPUT_FIELD_DEFINITION,
        _directiveLocation.DirectiveLocation.ENUM_VALUE
      ],
      args: {
        reason: {
          type: _scalars.GraphQLString,
          description: "Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).",
          defaultValue: DEFAULT_DEPRECATION_REASON
        }
      }
    });
    exports2.GraphQLDeprecatedDirective = GraphQLDeprecatedDirective;
    var GraphQLSpecifiedByDirective = new GraphQLDirective({
      name: "specifiedBy",
      description: "Exposes a URL that specifies the behavior of this scalar.",
      locations: [_directiveLocation.DirectiveLocation.SCALAR],
      args: {
        url: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
          description: "The URL that specifies the behavior of this scalar."
        }
      }
    });
    exports2.GraphQLSpecifiedByDirective = GraphQLSpecifiedByDirective;
    var GraphQLOneOfDirective = new GraphQLDirective({
      name: "oneOf",
      description: "Indicates exactly one field must be supplied and this field must not be `null`.",
      locations: [_directiveLocation.DirectiveLocation.INPUT_OBJECT],
      args: {}
    });
    exports2.GraphQLOneOfDirective = GraphQLOneOfDirective;
    var specifiedDirectives = Object.freeze([
      GraphQLIncludeDirective,
      GraphQLSkipDirective,
      GraphQLDeprecatedDirective,
      GraphQLSpecifiedByDirective,
      GraphQLOneOfDirective
    ]);
    exports2.specifiedDirectives = specifiedDirectives;
    function isSpecifiedDirective(directive) {
      return specifiedDirectives.some(({ name }) => name === directive.name);
    }
  }
});

// node_modules/graphql/jsutils/isIterableObject.js
var require_isIterableObject = __commonJS({
  "node_modules/graphql/jsutils/isIterableObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.isIterableObject = isIterableObject;
    function isIterableObject(maybeIterable) {
      return typeof maybeIterable === "object" && typeof (maybeIterable === null || maybeIterable === void 0 ? void 0 : maybeIterable[Symbol.iterator]) === "function";
    }
  }
});

// node_modules/graphql/utilities/astFromValue.js
var require_astFromValue = __commonJS({
  "node_modules/graphql/utilities/astFromValue.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.astFromValue = astFromValue;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _isIterableObject = require_isIterableObject();
    var _isObjectLike = require_isObjectLike();
    var _kinds = require_kinds();
    var _definition = require_definition();
    var _scalars = require_scalars();
    function astFromValue(value, type) {
      if ((0, _definition.isNonNullType)(type)) {
        const astValue = astFromValue(value, type.ofType);
        if ((astValue === null || astValue === void 0 ? void 0 : astValue.kind) === _kinds.Kind.NULL) {
          return null;
        }
        return astValue;
      }
      if (value === null) {
        return {
          kind: _kinds.Kind.NULL
        };
      }
      if (value === void 0) {
        return null;
      }
      if ((0, _definition.isListType)(type)) {
        const itemType = type.ofType;
        if ((0, _isIterableObject.isIterableObject)(value)) {
          const valuesNodes = [];
          for (const item of value) {
            const itemNode = astFromValue(item, itemType);
            if (itemNode != null) {
              valuesNodes.push(itemNode);
            }
          }
          return {
            kind: _kinds.Kind.LIST,
            values: valuesNodes
          };
        }
        return astFromValue(value, itemType);
      }
      if ((0, _definition.isInputObjectType)(type)) {
        if (!(0, _isObjectLike.isObjectLike)(value)) {
          return null;
        }
        const fieldNodes = [];
        for (const field of Object.values(type.getFields())) {
          const fieldValue = astFromValue(value[field.name], field.type);
          if (fieldValue) {
            fieldNodes.push({
              kind: _kinds.Kind.OBJECT_FIELD,
              name: {
                kind: _kinds.Kind.NAME,
                value: field.name
              },
              value: fieldValue
            });
          }
        }
        return {
          kind: _kinds.Kind.OBJECT,
          fields: fieldNodes
        };
      }
      if ((0, _definition.isLeafType)(type)) {
        const serialized = type.serialize(value);
        if (serialized == null) {
          return null;
        }
        if (typeof serialized === "boolean") {
          return {
            kind: _kinds.Kind.BOOLEAN,
            value: serialized
          };
        }
        if (typeof serialized === "number" && Number.isFinite(serialized)) {
          const stringNum = String(serialized);
          return integerStringRegExp.test(stringNum) ? {
            kind: _kinds.Kind.INT,
            value: stringNum
          } : {
            kind: _kinds.Kind.FLOAT,
            value: stringNum
          };
        }
        if (typeof serialized === "string") {
          if ((0, _definition.isEnumType)(type)) {
            return {
              kind: _kinds.Kind.ENUM,
              value: serialized
            };
          }
          if (type === _scalars.GraphQLID && integerStringRegExp.test(serialized)) {
            return {
              kind: _kinds.Kind.INT,
              value: serialized
            };
          }
          return {
            kind: _kinds.Kind.STRING,
            value: serialized
          };
        }
        throw new TypeError(
          `Cannot convert value to AST: ${(0, _inspect.inspect)(serialized)}.`
        );
      }
      (0, _invariant.invariant)(
        false,
        "Unexpected input type: " + (0, _inspect.inspect)(type)
      );
    }
    var integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
  }
});

// node_modules/graphql/type/introspection.js
var require_introspection = __commonJS({
  "node_modules/graphql/type/introspection.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.introspectionTypes = exports2.__TypeKind = exports2.__Type = exports2.__Schema = exports2.__InputValue = exports2.__Field = exports2.__EnumValue = exports2.__DirectiveLocation = exports2.__Directive = exports2.TypeNameMetaFieldDef = exports2.TypeMetaFieldDef = exports2.TypeKind = exports2.SchemaMetaFieldDef = void 0;
    exports2.isIntrospectionType = isIntrospectionType;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _directiveLocation = require_directiveLocation();
    var _printer = require_printer();
    var _astFromValue = require_astFromValue();
    var _definition = require_definition();
    var _scalars = require_scalars();
    var __Schema = new _definition.GraphQLObjectType({
      name: "__Schema",
      description: "A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.",
      fields: () => ({
        description: {
          type: _scalars.GraphQLString,
          resolve: (schema) => schema.description
        },
        types: {
          description: "A list of all types supported by this server.",
          type: new _definition.GraphQLNonNull(
            new _definition.GraphQLList(new _definition.GraphQLNonNull(__Type))
          ),
          resolve(schema) {
            return Object.values(schema.getTypeMap());
          }
        },
        queryType: {
          description: "The type that query operations will be rooted at.",
          type: new _definition.GraphQLNonNull(__Type),
          resolve: (schema) => schema.getQueryType()
        },
        mutationType: {
          description: "If this server supports mutation, the type that mutation operations will be rooted at.",
          type: __Type,
          resolve: (schema) => schema.getMutationType()
        },
        subscriptionType: {
          description: "If this server support subscription, the type that subscription operations will be rooted at.",
          type: __Type,
          resolve: (schema) => schema.getSubscriptionType()
        },
        directives: {
          description: "A list of all directives supported by this server.",
          type: new _definition.GraphQLNonNull(
            new _definition.GraphQLList(
              new _definition.GraphQLNonNull(__Directive)
            )
          ),
          resolve: (schema) => schema.getDirectives()
        }
      })
    });
    exports2.__Schema = __Schema;
    var __Directive = new _definition.GraphQLObjectType({
      name: "__Directive",
      description: "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
      fields: () => ({
        name: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
          resolve: (directive) => directive.name
        },
        description: {
          type: _scalars.GraphQLString,
          resolve: (directive) => directive.description
        },
        isRepeatable: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
          resolve: (directive) => directive.isRepeatable
        },
        locations: {
          type: new _definition.GraphQLNonNull(
            new _definition.GraphQLList(
              new _definition.GraphQLNonNull(__DirectiveLocation)
            )
          ),
          resolve: (directive) => directive.locations
        },
        args: {
          type: new _definition.GraphQLNonNull(
            new _definition.GraphQLList(
              new _definition.GraphQLNonNull(__InputValue)
            )
          ),
          args: {
            includeDeprecated: {
              type: _scalars.GraphQLBoolean,
              defaultValue: false
            }
          },
          resolve(field, { includeDeprecated }) {
            return includeDeprecated ? field.args : field.args.filter((arg) => arg.deprecationReason == null);
          }
        }
      })
    });
    exports2.__Directive = __Directive;
    var __DirectiveLocation = new _definition.GraphQLEnumType({
      name: "__DirectiveLocation",
      description: "A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.",
      values: {
        QUERY: {
          value: _directiveLocation.DirectiveLocation.QUERY,
          description: "Location adjacent to a query operation."
        },
        MUTATION: {
          value: _directiveLocation.DirectiveLocation.MUTATION,
          description: "Location adjacent to a mutation operation."
        },
        SUBSCRIPTION: {
          value: _directiveLocation.DirectiveLocation.SUBSCRIPTION,
          description: "Location adjacent to a subscription operation."
        },
        FIELD: {
          value: _directiveLocation.DirectiveLocation.FIELD,
          description: "Location adjacent to a field."
        },
        FRAGMENT_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.FRAGMENT_DEFINITION,
          description: "Location adjacent to a fragment definition."
        },
        FRAGMENT_SPREAD: {
          value: _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD,
          description: "Location adjacent to a fragment spread."
        },
        INLINE_FRAGMENT: {
          value: _directiveLocation.DirectiveLocation.INLINE_FRAGMENT,
          description: "Location adjacent to an inline fragment."
        },
        VARIABLE_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.VARIABLE_DEFINITION,
          description: "Location adjacent to a variable definition."
        },
        SCHEMA: {
          value: _directiveLocation.DirectiveLocation.SCHEMA,
          description: "Location adjacent to a schema definition."
        },
        SCALAR: {
          value: _directiveLocation.DirectiveLocation.SCALAR,
          description: "Location adjacent to a scalar definition."
        },
        OBJECT: {
          value: _directiveLocation.DirectiveLocation.OBJECT,
          description: "Location adjacent to an object type definition."
        },
        FIELD_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.FIELD_DEFINITION,
          description: "Location adjacent to a field definition."
        },
        ARGUMENT_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.ARGUMENT_DEFINITION,
          description: "Location adjacent to an argument definition."
        },
        INTERFACE: {
          value: _directiveLocation.DirectiveLocation.INTERFACE,
          description: "Location adjacent to an interface definition."
        },
        UNION: {
          value: _directiveLocation.DirectiveLocation.UNION,
          description: "Location adjacent to a union definition."
        },
        ENUM: {
          value: _directiveLocation.DirectiveLocation.ENUM,
          description: "Location adjacent to an enum definition."
        },
        ENUM_VALUE: {
          value: _directiveLocation.DirectiveLocation.ENUM_VALUE,
          description: "Location adjacent to an enum value definition."
        },
        INPUT_OBJECT: {
          value: _directiveLocation.DirectiveLocation.INPUT_OBJECT,
          description: "Location adjacent to an input object type definition."
        },
        INPUT_FIELD_DEFINITION: {
          value: _directiveLocation.DirectiveLocation.INPUT_FIELD_DEFINITION,
          description: "Location adjacent to an input object field definition."
        }
      }
    });
    exports2.__DirectiveLocation = __DirectiveLocation;
    var __Type = new _definition.GraphQLObjectType({
      name: "__Type",
      description: "The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.",
      fields: () => ({
        kind: {
          type: new _definition.GraphQLNonNull(__TypeKind),
          resolve(type) {
            if ((0, _definition.isScalarType)(type)) {
              return TypeKind.SCALAR;
            }
            if ((0, _definition.isObjectType)(type)) {
              return TypeKind.OBJECT;
            }
            if ((0, _definition.isInterfaceType)(type)) {
              return TypeKind.INTERFACE;
            }
            if ((0, _definition.isUnionType)(type)) {
              return TypeKind.UNION;
            }
            if ((0, _definition.isEnumType)(type)) {
              return TypeKind.ENUM;
            }
            if ((0, _definition.isInputObjectType)(type)) {
              return TypeKind.INPUT_OBJECT;
            }
            if ((0, _definition.isListType)(type)) {
              return TypeKind.LIST;
            }
            if ((0, _definition.isNonNullType)(type)) {
              return TypeKind.NON_NULL;
            }
            (0, _invariant.invariant)(
              false,
              `Unexpected type: "${(0, _inspect.inspect)(type)}".`
            );
          }
        },
        name: {
          type: _scalars.GraphQLString,
          resolve: (type) => "name" in type ? type.name : void 0
        },
        description: {
          type: _scalars.GraphQLString,
          resolve: (type) => (
            /* c8 ignore next */
            "description" in type ? type.description : void 0
          )
        },
        specifiedByURL: {
          type: _scalars.GraphQLString,
          resolve: (obj) => "specifiedByURL" in obj ? obj.specifiedByURL : void 0
        },
        fields: {
          type: new _definition.GraphQLList(
            new _definition.GraphQLNonNull(__Field)
          ),
          args: {
            includeDeprecated: {
              type: _scalars.GraphQLBoolean,
              defaultValue: false
            }
          },
          resolve(type, { includeDeprecated }) {
            if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type)) {
              const fields = Object.values(type.getFields());
              return includeDeprecated ? fields : fields.filter((field) => field.deprecationReason == null);
            }
          }
        },
        interfaces: {
          type: new _definition.GraphQLList(new _definition.GraphQLNonNull(__Type)),
          resolve(type) {
            if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type)) {
              return type.getInterfaces();
            }
          }
        },
        possibleTypes: {
          type: new _definition.GraphQLList(new _definition.GraphQLNonNull(__Type)),
          resolve(type, _args, _context, { schema }) {
            if ((0, _definition.isAbstractType)(type)) {
              return schema.getPossibleTypes(type);
            }
          }
        },
        enumValues: {
          type: new _definition.GraphQLList(
            new _definition.GraphQLNonNull(__EnumValue)
          ),
          args: {
            includeDeprecated: {
              type: _scalars.GraphQLBoolean,
              defaultValue: false
            }
          },
          resolve(type, { includeDeprecated }) {
            if ((0, _definition.isEnumType)(type)) {
              const values = type.getValues();
              return includeDeprecated ? values : values.filter((field) => field.deprecationReason == null);
            }
          }
        },
        inputFields: {
          type: new _definition.GraphQLList(
            new _definition.GraphQLNonNull(__InputValue)
          ),
          args: {
            includeDeprecated: {
              type: _scalars.GraphQLBoolean,
              defaultValue: false
            }
          },
          resolve(type, { includeDeprecated }) {
            if ((0, _definition.isInputObjectType)(type)) {
              const values = Object.values(type.getFields());
              return includeDeprecated ? values : values.filter((field) => field.deprecationReason == null);
            }
          }
        },
        ofType: {
          type: __Type,
          resolve: (type) => "ofType" in type ? type.ofType : void 0
        },
        isOneOf: {
          type: _scalars.GraphQLBoolean,
          resolve: (type) => {
            if ((0, _definition.isInputObjectType)(type)) {
              return type.isOneOf;
            }
          }
        }
      })
    });
    exports2.__Type = __Type;
    var __Field = new _definition.GraphQLObjectType({
      name: "__Field",
      description: "Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.",
      fields: () => ({
        name: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
          resolve: (field) => field.name
        },
        description: {
          type: _scalars.GraphQLString,
          resolve: (field) => field.description
        },
        args: {
          type: new _definition.GraphQLNonNull(
            new _definition.GraphQLList(
              new _definition.GraphQLNonNull(__InputValue)
            )
          ),
          args: {
            includeDeprecated: {
              type: _scalars.GraphQLBoolean,
              defaultValue: false
            }
          },
          resolve(field, { includeDeprecated }) {
            return includeDeprecated ? field.args : field.args.filter((arg) => arg.deprecationReason == null);
          }
        },
        type: {
          type: new _definition.GraphQLNonNull(__Type),
          resolve: (field) => field.type
        },
        isDeprecated: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
          resolve: (field) => field.deprecationReason != null
        },
        deprecationReason: {
          type: _scalars.GraphQLString,
          resolve: (field) => field.deprecationReason
        }
      })
    });
    exports2.__Field = __Field;
    var __InputValue = new _definition.GraphQLObjectType({
      name: "__InputValue",
      description: "Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.",
      fields: () => ({
        name: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
          resolve: (inputValue) => inputValue.name
        },
        description: {
          type: _scalars.GraphQLString,
          resolve: (inputValue) => inputValue.description
        },
        type: {
          type: new _definition.GraphQLNonNull(__Type),
          resolve: (inputValue) => inputValue.type
        },
        defaultValue: {
          type: _scalars.GraphQLString,
          description: "A GraphQL-formatted string representing the default value for this input value.",
          resolve(inputValue) {
            const { type, defaultValue } = inputValue;
            const valueAST = (0, _astFromValue.astFromValue)(defaultValue, type);
            return valueAST ? (0, _printer.print)(valueAST) : null;
          }
        },
        isDeprecated: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
          resolve: (field) => field.deprecationReason != null
        },
        deprecationReason: {
          type: _scalars.GraphQLString,
          resolve: (obj) => obj.deprecationReason
        }
      })
    });
    exports2.__InputValue = __InputValue;
    var __EnumValue = new _definition.GraphQLObjectType({
      name: "__EnumValue",
      description: "One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.",
      fields: () => ({
        name: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
          resolve: (enumValue) => enumValue.name
        },
        description: {
          type: _scalars.GraphQLString,
          resolve: (enumValue) => enumValue.description
        },
        isDeprecated: {
          type: new _definition.GraphQLNonNull(_scalars.GraphQLBoolean),
          resolve: (enumValue) => enumValue.deprecationReason != null
        },
        deprecationReason: {
          type: _scalars.GraphQLString,
          resolve: (enumValue) => enumValue.deprecationReason
        }
      })
    });
    exports2.__EnumValue = __EnumValue;
    var TypeKind;
    exports2.TypeKind = TypeKind;
    (function(TypeKind2) {
      TypeKind2["SCALAR"] = "SCALAR";
      TypeKind2["OBJECT"] = "OBJECT";
      TypeKind2["INTERFACE"] = "INTERFACE";
      TypeKind2["UNION"] = "UNION";
      TypeKind2["ENUM"] = "ENUM";
      TypeKind2["INPUT_OBJECT"] = "INPUT_OBJECT";
      TypeKind2["LIST"] = "LIST";
      TypeKind2["NON_NULL"] = "NON_NULL";
    })(TypeKind || (exports2.TypeKind = TypeKind = {}));
    var __TypeKind = new _definition.GraphQLEnumType({
      name: "__TypeKind",
      description: "An enum describing what kind of type a given `__Type` is.",
      values: {
        SCALAR: {
          value: TypeKind.SCALAR,
          description: "Indicates this type is a scalar."
        },
        OBJECT: {
          value: TypeKind.OBJECT,
          description: "Indicates this type is an object. `fields` and `interfaces` are valid fields."
        },
        INTERFACE: {
          value: TypeKind.INTERFACE,
          description: "Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields."
        },
        UNION: {
          value: TypeKind.UNION,
          description: "Indicates this type is a union. `possibleTypes` is a valid field."
        },
        ENUM: {
          value: TypeKind.ENUM,
          description: "Indicates this type is an enum. `enumValues` is a valid field."
        },
        INPUT_OBJECT: {
          value: TypeKind.INPUT_OBJECT,
          description: "Indicates this type is an input object. `inputFields` is a valid field."
        },
        LIST: {
          value: TypeKind.LIST,
          description: "Indicates this type is a list. `ofType` is a valid field."
        },
        NON_NULL: {
          value: TypeKind.NON_NULL,
          description: "Indicates this type is a non-null. `ofType` is a valid field."
        }
      }
    });
    exports2.__TypeKind = __TypeKind;
    var SchemaMetaFieldDef = {
      name: "__schema",
      type: new _definition.GraphQLNonNull(__Schema),
      description: "Access the current type schema of this server.",
      args: [],
      resolve: (_source, _args, _context, { schema }) => schema,
      deprecationReason: void 0,
      extensions: /* @__PURE__ */ Object.create(null),
      astNode: void 0
    };
    exports2.SchemaMetaFieldDef = SchemaMetaFieldDef;
    var TypeMetaFieldDef = {
      name: "__type",
      type: __Type,
      description: "Request the type information of a single type.",
      args: [
        {
          name: "name",
          description: void 0,
          type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
          defaultValue: void 0,
          deprecationReason: void 0,
          extensions: /* @__PURE__ */ Object.create(null),
          astNode: void 0
        }
      ],
      resolve: (_source, { name }, _context, { schema }) => schema.getType(name),
      deprecationReason: void 0,
      extensions: /* @__PURE__ */ Object.create(null),
      astNode: void 0
    };
    exports2.TypeMetaFieldDef = TypeMetaFieldDef;
    var TypeNameMetaFieldDef = {
      name: "__typename",
      type: new _definition.GraphQLNonNull(_scalars.GraphQLString),
      description: "The name of the current Object type at runtime.",
      args: [],
      resolve: (_source, _args, _context, { parentType }) => parentType.name,
      deprecationReason: void 0,
      extensions: /* @__PURE__ */ Object.create(null),
      astNode: void 0
    };
    exports2.TypeNameMetaFieldDef = TypeNameMetaFieldDef;
    var introspectionTypes = Object.freeze([
      __Schema,
      __Directive,
      __DirectiveLocation,
      __Type,
      __Field,
      __InputValue,
      __EnumValue,
      __TypeKind
    ]);
    exports2.introspectionTypes = introspectionTypes;
    function isIntrospectionType(type) {
      return introspectionTypes.some(({ name }) => type.name === name);
    }
  }
});

// node_modules/graphql/type/schema.js
var require_schema = __commonJS({
  "node_modules/graphql/type/schema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.GraphQLSchema = void 0;
    exports2.assertSchema = assertSchema;
    exports2.isSchema = isSchema;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _instanceOf = require_instanceOf();
    var _isObjectLike = require_isObjectLike();
    var _toObjMap = require_toObjMap();
    var _ast = require_ast();
    var _definition = require_definition();
    var _directives = require_directives();
    var _introspection = require_introspection();
    function isSchema(schema) {
      return (0, _instanceOf.instanceOf)(schema, GraphQLSchema);
    }
    function assertSchema(schema) {
      if (!isSchema(schema)) {
        throw new Error(
          `Expected ${(0, _inspect.inspect)(schema)} to be a GraphQL schema.`
        );
      }
      return schema;
    }
    var GraphQLSchema = class {
      // Used as a cache for validateSchema().
      constructor(config) {
        var _config$extensionASTN, _config$directives;
        this.__validationErrors = config.assumeValid === true ? [] : void 0;
        (0, _isObjectLike.isObjectLike)(config) || (0, _devAssert.devAssert)(false, "Must provide configuration object.");
        !config.types || Array.isArray(config.types) || (0, _devAssert.devAssert)(
          false,
          `"types" must be Array if provided but got: ${(0, _inspect.inspect)(
            config.types
          )}.`
        );
        !config.directives || Array.isArray(config.directives) || (0, _devAssert.devAssert)(
          false,
          `"directives" must be Array if provided but got: ${(0, _inspect.inspect)(config.directives)}.`
        );
        this.description = config.description;
        this.extensions = (0, _toObjMap.toObjMap)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = (_config$extensionASTN = config.extensionASTNodes) !== null && _config$extensionASTN !== void 0 ? _config$extensionASTN : [];
        this._queryType = config.query;
        this._mutationType = config.mutation;
        this._subscriptionType = config.subscription;
        this._directives = (_config$directives = config.directives) !== null && _config$directives !== void 0 ? _config$directives : _directives.specifiedDirectives;
        const allReferencedTypes = new Set(config.types);
        if (config.types != null) {
          for (const type of config.types) {
            allReferencedTypes.delete(type);
            collectReferencedTypes(type, allReferencedTypes);
          }
        }
        if (this._queryType != null) {
          collectReferencedTypes(this._queryType, allReferencedTypes);
        }
        if (this._mutationType != null) {
          collectReferencedTypes(this._mutationType, allReferencedTypes);
        }
        if (this._subscriptionType != null) {
          collectReferencedTypes(this._subscriptionType, allReferencedTypes);
        }
        for (const directive of this._directives) {
          if ((0, _directives.isDirective)(directive)) {
            for (const arg of directive.args) {
              collectReferencedTypes(arg.type, allReferencedTypes);
            }
          }
        }
        collectReferencedTypes(_introspection.__Schema, allReferencedTypes);
        this._typeMap = /* @__PURE__ */ Object.create(null);
        this._subTypeMap = /* @__PURE__ */ Object.create(null);
        this._implementationsMap = /* @__PURE__ */ Object.create(null);
        for (const namedType of allReferencedTypes) {
          if (namedType == null) {
            continue;
          }
          const typeName = namedType.name;
          typeName || (0, _devAssert.devAssert)(
            false,
            "One of the provided types for building the Schema is missing a name."
          );
          if (this._typeMap[typeName] !== void 0) {
            throw new Error(
              `Schema must contain uniquely named types but contains multiple types named "${typeName}".`
            );
          }
          this._typeMap[typeName] = namedType;
          if ((0, _definition.isInterfaceType)(namedType)) {
            for (const iface of namedType.getInterfaces()) {
              if ((0, _definition.isInterfaceType)(iface)) {
                let implementations = this._implementationsMap[iface.name];
                if (implementations === void 0) {
                  implementations = this._implementationsMap[iface.name] = {
                    objects: [],
                    interfaces: []
                  };
                }
                implementations.interfaces.push(namedType);
              }
            }
          } else if ((0, _definition.isObjectType)(namedType)) {
            for (const iface of namedType.getInterfaces()) {
              if ((0, _definition.isInterfaceType)(iface)) {
                let implementations = this._implementationsMap[iface.name];
                if (implementations === void 0) {
                  implementations = this._implementationsMap[iface.name] = {
                    objects: [],
                    interfaces: []
                  };
                }
                implementations.objects.push(namedType);
              }
            }
          }
        }
      }
      get [Symbol.toStringTag]() {
        return "GraphQLSchema";
      }
      getQueryType() {
        return this._queryType;
      }
      getMutationType() {
        return this._mutationType;
      }
      getSubscriptionType() {
        return this._subscriptionType;
      }
      getRootType(operation) {
        switch (operation) {
          case _ast.OperationTypeNode.QUERY:
            return this.getQueryType();
          case _ast.OperationTypeNode.MUTATION:
            return this.getMutationType();
          case _ast.OperationTypeNode.SUBSCRIPTION:
            return this.getSubscriptionType();
        }
      }
      getTypeMap() {
        return this._typeMap;
      }
      getType(name) {
        return this.getTypeMap()[name];
      }
      getPossibleTypes(abstractType) {
        return (0, _definition.isUnionType)(abstractType) ? abstractType.getTypes() : this.getImplementations(abstractType).objects;
      }
      getImplementations(interfaceType) {
        const implementations = this._implementationsMap[interfaceType.name];
        return implementations !== null && implementations !== void 0 ? implementations : {
          objects: [],
          interfaces: []
        };
      }
      isSubType(abstractType, maybeSubType) {
        let map = this._subTypeMap[abstractType.name];
        if (map === void 0) {
          map = /* @__PURE__ */ Object.create(null);
          if ((0, _definition.isUnionType)(abstractType)) {
            for (const type of abstractType.getTypes()) {
              map[type.name] = true;
            }
          } else {
            const implementations = this.getImplementations(abstractType);
            for (const type of implementations.objects) {
              map[type.name] = true;
            }
            for (const type of implementations.interfaces) {
              map[type.name] = true;
            }
          }
          this._subTypeMap[abstractType.name] = map;
        }
        return map[maybeSubType.name] !== void 0;
      }
      getDirectives() {
        return this._directives;
      }
      getDirective(name) {
        return this.getDirectives().find((directive) => directive.name === name);
      }
      toConfig() {
        return {
          description: this.description,
          query: this.getQueryType(),
          mutation: this.getMutationType(),
          subscription: this.getSubscriptionType(),
          types: Object.values(this.getTypeMap()),
          directives: this.getDirectives(),
          extensions: this.extensions,
          astNode: this.astNode,
          extensionASTNodes: this.extensionASTNodes,
          assumeValid: this.__validationErrors !== void 0
        };
      }
    };
    exports2.GraphQLSchema = GraphQLSchema;
    function collectReferencedTypes(type, typeSet) {
      const namedType = (0, _definition.getNamedType)(type);
      if (!typeSet.has(namedType)) {
        typeSet.add(namedType);
        if ((0, _definition.isUnionType)(namedType)) {
          for (const memberType of namedType.getTypes()) {
            collectReferencedTypes(memberType, typeSet);
          }
        } else if ((0, _definition.isObjectType)(namedType) || (0, _definition.isInterfaceType)(namedType)) {
          for (const interfaceType of namedType.getInterfaces()) {
            collectReferencedTypes(interfaceType, typeSet);
          }
          for (const field of Object.values(namedType.getFields())) {
            collectReferencedTypes(field.type, typeSet);
            for (const arg of field.args) {
              collectReferencedTypes(arg.type, typeSet);
            }
          }
        } else if ((0, _definition.isInputObjectType)(namedType)) {
          for (const field of Object.values(namedType.getFields())) {
            collectReferencedTypes(field.type, typeSet);
          }
        }
      }
      return typeSet;
    }
  }
});

// node_modules/graphql/type/validate.js
var require_validate = __commonJS({
  "node_modules/graphql/type/validate.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.assertValidSchema = assertValidSchema;
    exports2.validateSchema = validateSchema;
    var _inspect = require_inspect();
    var _GraphQLError = require_GraphQLError();
    var _ast = require_ast();
    var _typeComparators = require_typeComparators();
    var _definition = require_definition();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _schema = require_schema();
    function validateSchema(schema) {
      (0, _schema.assertSchema)(schema);
      if (schema.__validationErrors) {
        return schema.__validationErrors;
      }
      const context = new SchemaValidationContext(schema);
      validateRootTypes(context);
      validateDirectives(context);
      validateTypes(context);
      const errors = context.getErrors();
      schema.__validationErrors = errors;
      return errors;
    }
    function assertValidSchema(schema) {
      const errors = validateSchema(schema);
      if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join("\n\n"));
      }
    }
    var SchemaValidationContext = class {
      constructor(schema) {
        this._errors = [];
        this.schema = schema;
      }
      reportError(message, nodes) {
        const _nodes = Array.isArray(nodes) ? nodes.filter(Boolean) : nodes;
        this._errors.push(
          new _GraphQLError.GraphQLError(message, {
            nodes: _nodes
          })
        );
      }
      getErrors() {
        return this._errors;
      }
    };
    function validateRootTypes(context) {
      const schema = context.schema;
      const queryType = schema.getQueryType();
      if (!queryType) {
        context.reportError("Query root type must be provided.", schema.astNode);
      } else if (!(0, _definition.isObjectType)(queryType)) {
        var _getOperationTypeNode;
        context.reportError(
          `Query root type must be Object type, it cannot be ${(0, _inspect.inspect)(queryType)}.`,
          (_getOperationTypeNode = getOperationTypeNode(
            schema,
            _ast.OperationTypeNode.QUERY
          )) !== null && _getOperationTypeNode !== void 0 ? _getOperationTypeNode : queryType.astNode
        );
      }
      const mutationType = schema.getMutationType();
      if (mutationType && !(0, _definition.isObjectType)(mutationType)) {
        var _getOperationTypeNode2;
        context.reportError(
          `Mutation root type must be Object type if provided, it cannot be ${(0, _inspect.inspect)(mutationType)}.`,
          (_getOperationTypeNode2 = getOperationTypeNode(
            schema,
            _ast.OperationTypeNode.MUTATION
          )) !== null && _getOperationTypeNode2 !== void 0 ? _getOperationTypeNode2 : mutationType.astNode
        );
      }
      const subscriptionType = schema.getSubscriptionType();
      if (subscriptionType && !(0, _definition.isObjectType)(subscriptionType)) {
        var _getOperationTypeNode3;
        context.reportError(
          `Subscription root type must be Object type if provided, it cannot be ${(0, _inspect.inspect)(subscriptionType)}.`,
          (_getOperationTypeNode3 = getOperationTypeNode(
            schema,
            _ast.OperationTypeNode.SUBSCRIPTION
          )) !== null && _getOperationTypeNode3 !== void 0 ? _getOperationTypeNode3 : subscriptionType.astNode
        );
      }
    }
    function getOperationTypeNode(schema, operation) {
      var _flatMap$find;
      return (_flatMap$find = [schema.astNode, ...schema.extensionASTNodes].flatMap(
        // FIXME: https://github.com/graphql/graphql-js/issues/2203
        (schemaNode) => {
          var _schemaNode$operation;
          return (
            /* c8 ignore next */
            (_schemaNode$operation = schemaNode === null || schemaNode === void 0 ? void 0 : schemaNode.operationTypes) !== null && _schemaNode$operation !== void 0 ? _schemaNode$operation : []
          );
        }
      ).find((operationNode) => operationNode.operation === operation)) === null || _flatMap$find === void 0 ? void 0 : _flatMap$find.type;
    }
    function validateDirectives(context) {
      for (const directive of context.schema.getDirectives()) {
        if (!(0, _directives.isDirective)(directive)) {
          context.reportError(
            `Expected directive but got: ${(0, _inspect.inspect)(directive)}.`,
            directive === null || directive === void 0 ? void 0 : directive.astNode
          );
          continue;
        }
        validateName(context, directive);
        for (const arg of directive.args) {
          validateName(context, arg);
          if (!(0, _definition.isInputType)(arg.type)) {
            context.reportError(
              `The type of @${directive.name}(${arg.name}:) must be Input Type but got: ${(0, _inspect.inspect)(arg.type)}.`,
              arg.astNode
            );
          }
          if ((0, _definition.isRequiredArgument)(arg) && arg.deprecationReason != null) {
            var _arg$astNode;
            context.reportError(
              `Required argument @${directive.name}(${arg.name}:) cannot be deprecated.`,
              [
                getDeprecatedDirectiveNode(arg.astNode),
                (_arg$astNode = arg.astNode) === null || _arg$astNode === void 0 ? void 0 : _arg$astNode.type
              ]
            );
          }
        }
      }
    }
    function validateName(context, node) {
      if (node.name.startsWith("__")) {
        context.reportError(
          `Name "${node.name}" must not begin with "__", which is reserved by GraphQL introspection.`,
          node.astNode
        );
      }
    }
    function validateTypes(context) {
      const validateInputObjectCircularRefs = createInputObjectCircularRefsValidator(context);
      const typeMap = context.schema.getTypeMap();
      for (const type of Object.values(typeMap)) {
        if (!(0, _definition.isNamedType)(type)) {
          context.reportError(
            `Expected GraphQL named type but got: ${(0, _inspect.inspect)(type)}.`,
            type.astNode
          );
          continue;
        }
        if (!(0, _introspection.isIntrospectionType)(type)) {
          validateName(context, type);
        }
        if ((0, _definition.isObjectType)(type)) {
          validateFields(context, type);
          validateInterfaces(context, type);
        } else if ((0, _definition.isInterfaceType)(type)) {
          validateFields(context, type);
          validateInterfaces(context, type);
        } else if ((0, _definition.isUnionType)(type)) {
          validateUnionMembers(context, type);
        } else if ((0, _definition.isEnumType)(type)) {
          validateEnumValues(context, type);
        } else if ((0, _definition.isInputObjectType)(type)) {
          validateInputFields(context, type);
          validateInputObjectCircularRefs(type);
        }
      }
    }
    function validateFields(context, type) {
      const fields = Object.values(type.getFields());
      if (fields.length === 0) {
        context.reportError(`Type ${type.name} must define one or more fields.`, [
          type.astNode,
          ...type.extensionASTNodes
        ]);
      }
      for (const field of fields) {
        validateName(context, field);
        if (!(0, _definition.isOutputType)(field.type)) {
          var _field$astNode;
          context.reportError(
            `The type of ${type.name}.${field.name} must be Output Type but got: ${(0, _inspect.inspect)(field.type)}.`,
            (_field$astNode = field.astNode) === null || _field$astNode === void 0 ? void 0 : _field$astNode.type
          );
        }
        for (const arg of field.args) {
          const argName = arg.name;
          validateName(context, arg);
          if (!(0, _definition.isInputType)(arg.type)) {
            var _arg$astNode2;
            context.reportError(
              `The type of ${type.name}.${field.name}(${argName}:) must be Input Type but got: ${(0, _inspect.inspect)(arg.type)}.`,
              (_arg$astNode2 = arg.astNode) === null || _arg$astNode2 === void 0 ? void 0 : _arg$astNode2.type
            );
          }
          if ((0, _definition.isRequiredArgument)(arg) && arg.deprecationReason != null) {
            var _arg$astNode3;
            context.reportError(
              `Required argument ${type.name}.${field.name}(${argName}:) cannot be deprecated.`,
              [
                getDeprecatedDirectiveNode(arg.astNode),
                (_arg$astNode3 = arg.astNode) === null || _arg$astNode3 === void 0 ? void 0 : _arg$astNode3.type
              ]
            );
          }
        }
      }
    }
    function validateInterfaces(context, type) {
      const ifaceTypeNames = /* @__PURE__ */ Object.create(null);
      for (const iface of type.getInterfaces()) {
        if (!(0, _definition.isInterfaceType)(iface)) {
          context.reportError(
            `Type ${(0, _inspect.inspect)(
              type
            )} must only implement Interface types, it cannot implement ${(0, _inspect.inspect)(iface)}.`,
            getAllImplementsInterfaceNodes(type, iface)
          );
          continue;
        }
        if (type === iface) {
          context.reportError(
            `Type ${type.name} cannot implement itself because it would create a circular reference.`,
            getAllImplementsInterfaceNodes(type, iface)
          );
          continue;
        }
        if (ifaceTypeNames[iface.name]) {
          context.reportError(
            `Type ${type.name} can only implement ${iface.name} once.`,
            getAllImplementsInterfaceNodes(type, iface)
          );
          continue;
        }
        ifaceTypeNames[iface.name] = true;
        validateTypeImplementsAncestors(context, type, iface);
        validateTypeImplementsInterface(context, type, iface);
      }
    }
    function validateTypeImplementsInterface(context, type, iface) {
      const typeFieldMap = type.getFields();
      for (const ifaceField of Object.values(iface.getFields())) {
        const fieldName = ifaceField.name;
        const typeField = typeFieldMap[fieldName];
        if (!typeField) {
          context.reportError(
            `Interface field ${iface.name}.${fieldName} expected but ${type.name} does not provide it.`,
            [ifaceField.astNode, type.astNode, ...type.extensionASTNodes]
          );
          continue;
        }
        if (!(0, _typeComparators.isTypeSubTypeOf)(
          context.schema,
          typeField.type,
          ifaceField.type
        )) {
          var _ifaceField$astNode, _typeField$astNode;
          context.reportError(
            `Interface field ${iface.name}.${fieldName} expects type ${(0, _inspect.inspect)(ifaceField.type)} but ${type.name}.${fieldName} is type ${(0, _inspect.inspect)(typeField.type)}.`,
            [
              (_ifaceField$astNode = ifaceField.astNode) === null || _ifaceField$astNode === void 0 ? void 0 : _ifaceField$astNode.type,
              (_typeField$astNode = typeField.astNode) === null || _typeField$astNode === void 0 ? void 0 : _typeField$astNode.type
            ]
          );
        }
        for (const ifaceArg of ifaceField.args) {
          const argName = ifaceArg.name;
          const typeArg = typeField.args.find((arg) => arg.name === argName);
          if (!typeArg) {
            context.reportError(
              `Interface field argument ${iface.name}.${fieldName}(${argName}:) expected but ${type.name}.${fieldName} does not provide it.`,
              [ifaceArg.astNode, typeField.astNode]
            );
            continue;
          }
          if (!(0, _typeComparators.isEqualType)(ifaceArg.type, typeArg.type)) {
            var _ifaceArg$astNode, _typeArg$astNode;
            context.reportError(
              `Interface field argument ${iface.name}.${fieldName}(${argName}:) expects type ${(0, _inspect.inspect)(ifaceArg.type)} but ${type.name}.${fieldName}(${argName}:) is type ${(0, _inspect.inspect)(typeArg.type)}.`,
              [
                (_ifaceArg$astNode = ifaceArg.astNode) === null || _ifaceArg$astNode === void 0 ? void 0 : _ifaceArg$astNode.type,
                (_typeArg$astNode = typeArg.astNode) === null || _typeArg$astNode === void 0 ? void 0 : _typeArg$astNode.type
              ]
            );
          }
        }
        for (const typeArg of typeField.args) {
          const argName = typeArg.name;
          const ifaceArg = ifaceField.args.find((arg) => arg.name === argName);
          if (!ifaceArg && (0, _definition.isRequiredArgument)(typeArg)) {
            context.reportError(
              `Object field ${type.name}.${fieldName} includes required argument ${argName} that is missing from the Interface field ${iface.name}.${fieldName}.`,
              [typeArg.astNode, ifaceField.astNode]
            );
          }
        }
      }
    }
    function validateTypeImplementsAncestors(context, type, iface) {
      const ifaceInterfaces = type.getInterfaces();
      for (const transitive of iface.getInterfaces()) {
        if (!ifaceInterfaces.includes(transitive)) {
          context.reportError(
            transitive === type ? `Type ${type.name} cannot implement ${iface.name} because it would create a circular reference.` : `Type ${type.name} must implement ${transitive.name} because it is implemented by ${iface.name}.`,
            [
              ...getAllImplementsInterfaceNodes(iface, transitive),
              ...getAllImplementsInterfaceNodes(type, iface)
            ]
          );
        }
      }
    }
    function validateUnionMembers(context, union) {
      const memberTypes = union.getTypes();
      if (memberTypes.length === 0) {
        context.reportError(
          `Union type ${union.name} must define one or more member types.`,
          [union.astNode, ...union.extensionASTNodes]
        );
      }
      const includedTypeNames = /* @__PURE__ */ Object.create(null);
      for (const memberType of memberTypes) {
        if (includedTypeNames[memberType.name]) {
          context.reportError(
            `Union type ${union.name} can only include type ${memberType.name} once.`,
            getUnionMemberTypeNodes(union, memberType.name)
          );
          continue;
        }
        includedTypeNames[memberType.name] = true;
        if (!(0, _definition.isObjectType)(memberType)) {
          context.reportError(
            `Union type ${union.name} can only include Object types, it cannot include ${(0, _inspect.inspect)(memberType)}.`,
            getUnionMemberTypeNodes(union, String(memberType))
          );
        }
      }
    }
    function validateEnumValues(context, enumType) {
      const enumValues = enumType.getValues();
      if (enumValues.length === 0) {
        context.reportError(
          `Enum type ${enumType.name} must define one or more values.`,
          [enumType.astNode, ...enumType.extensionASTNodes]
        );
      }
      for (const enumValue of enumValues) {
        validateName(context, enumValue);
      }
    }
    function validateInputFields(context, inputObj) {
      const fields = Object.values(inputObj.getFields());
      if (fields.length === 0) {
        context.reportError(
          `Input Object type ${inputObj.name} must define one or more fields.`,
          [inputObj.astNode, ...inputObj.extensionASTNodes]
        );
      }
      for (const field of fields) {
        validateName(context, field);
        if (!(0, _definition.isInputType)(field.type)) {
          var _field$astNode2;
          context.reportError(
            `The type of ${inputObj.name}.${field.name} must be Input Type but got: ${(0, _inspect.inspect)(field.type)}.`,
            (_field$astNode2 = field.astNode) === null || _field$astNode2 === void 0 ? void 0 : _field$astNode2.type
          );
        }
        if ((0, _definition.isRequiredInputField)(field) && field.deprecationReason != null) {
          var _field$astNode3;
          context.reportError(
            `Required input field ${inputObj.name}.${field.name} cannot be deprecated.`,
            [
              getDeprecatedDirectiveNode(field.astNode),
              (_field$astNode3 = field.astNode) === null || _field$astNode3 === void 0 ? void 0 : _field$astNode3.type
            ]
          );
        }
        if (inputObj.isOneOf) {
          validateOneOfInputObjectField(inputObj, field, context);
        }
      }
    }
    function validateOneOfInputObjectField(type, field, context) {
      if ((0, _definition.isNonNullType)(field.type)) {
        var _field$astNode4;
        context.reportError(
          `OneOf input field ${type.name}.${field.name} must be nullable.`,
          (_field$astNode4 = field.astNode) === null || _field$astNode4 === void 0 ? void 0 : _field$astNode4.type
        );
      }
      if (field.defaultValue !== void 0) {
        context.reportError(
          `OneOf input field ${type.name}.${field.name} cannot have a default value.`,
          field.astNode
        );
      }
    }
    function createInputObjectCircularRefsValidator(context) {
      const visitedTypes = /* @__PURE__ */ Object.create(null);
      const fieldPath = [];
      const fieldPathIndexByTypeName = /* @__PURE__ */ Object.create(null);
      return detectCycleRecursive;
      function detectCycleRecursive(inputObj) {
        if (visitedTypes[inputObj.name]) {
          return;
        }
        visitedTypes[inputObj.name] = true;
        fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;
        const fields = Object.values(inputObj.getFields());
        for (const field of fields) {
          if ((0, _definition.isNonNullType)(field.type) && (0, _definition.isInputObjectType)(field.type.ofType)) {
            const fieldType = field.type.ofType;
            const cycleIndex = fieldPathIndexByTypeName[fieldType.name];
            fieldPath.push(field);
            if (cycleIndex === void 0) {
              detectCycleRecursive(fieldType);
            } else {
              const cyclePath = fieldPath.slice(cycleIndex);
              const pathStr = cyclePath.map((fieldObj) => fieldObj.name).join(".");
              context.reportError(
                `Cannot reference Input Object "${fieldType.name}" within itself through a series of non-null fields: "${pathStr}".`,
                cyclePath.map((fieldObj) => fieldObj.astNode)
              );
            }
            fieldPath.pop();
          }
        }
        fieldPathIndexByTypeName[inputObj.name] = void 0;
      }
    }
    function getAllImplementsInterfaceNodes(type, iface) {
      const { astNode, extensionASTNodes } = type;
      const nodes = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;
      return nodes.flatMap((typeNode) => {
        var _typeNode$interfaces;
        return (
          /* c8 ignore next */
          (_typeNode$interfaces = typeNode.interfaces) !== null && _typeNode$interfaces !== void 0 ? _typeNode$interfaces : []
        );
      }).filter((ifaceNode) => ifaceNode.name.value === iface.name);
    }
    function getUnionMemberTypeNodes(union, typeName) {
      const { astNode, extensionASTNodes } = union;
      const nodes = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;
      return nodes.flatMap((unionNode) => {
        var _unionNode$types;
        return (
          /* c8 ignore next */
          (_unionNode$types = unionNode.types) !== null && _unionNode$types !== void 0 ? _unionNode$types : []
        );
      }).filter((typeNode) => typeNode.name.value === typeName);
    }
    function getDeprecatedDirectiveNode(definitionNode) {
      var _definitionNode$direc;
      return definitionNode === null || definitionNode === void 0 ? void 0 : (_definitionNode$direc = definitionNode.directives) === null || _definitionNode$direc === void 0 ? void 0 : _definitionNode$direc.find(
        (node) => node.name.value === _directives.GraphQLDeprecatedDirective.name
      );
    }
  }
});

// node_modules/graphql/utilities/typeFromAST.js
var require_typeFromAST = __commonJS({
  "node_modules/graphql/utilities/typeFromAST.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.typeFromAST = typeFromAST;
    var _kinds = require_kinds();
    var _definition = require_definition();
    function typeFromAST(schema, typeNode) {
      switch (typeNode.kind) {
        case _kinds.Kind.LIST_TYPE: {
          const innerType = typeFromAST(schema, typeNode.type);
          return innerType && new _definition.GraphQLList(innerType);
        }
        case _kinds.Kind.NON_NULL_TYPE: {
          const innerType = typeFromAST(schema, typeNode.type);
          return innerType && new _definition.GraphQLNonNull(innerType);
        }
        case _kinds.Kind.NAMED_TYPE:
          return schema.getType(typeNode.name.value);
      }
    }
  }
});

// node_modules/graphql/utilities/TypeInfo.js
var require_TypeInfo = __commonJS({
  "node_modules/graphql/utilities/TypeInfo.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.TypeInfo = void 0;
    exports2.visitWithTypeInfo = visitWithTypeInfo;
    var _ast = require_ast();
    var _kinds = require_kinds();
    var _visitor = require_visitor();
    var _definition = require_definition();
    var _introspection = require_introspection();
    var _typeFromAST = require_typeFromAST();
    var TypeInfo = class {
      constructor(schema, initialType, getFieldDefFn) {
        this._schema = schema;
        this._typeStack = [];
        this._parentTypeStack = [];
        this._inputTypeStack = [];
        this._fieldDefStack = [];
        this._defaultValueStack = [];
        this._directive = null;
        this._argument = null;
        this._enumValue = null;
        this._getFieldDef = getFieldDefFn !== null && getFieldDefFn !== void 0 ? getFieldDefFn : getFieldDef;
        if (initialType) {
          if ((0, _definition.isInputType)(initialType)) {
            this._inputTypeStack.push(initialType);
          }
          if ((0, _definition.isCompositeType)(initialType)) {
            this._parentTypeStack.push(initialType);
          }
          if ((0, _definition.isOutputType)(initialType)) {
            this._typeStack.push(initialType);
          }
        }
      }
      get [Symbol.toStringTag]() {
        return "TypeInfo";
      }
      getType() {
        if (this._typeStack.length > 0) {
          return this._typeStack[this._typeStack.length - 1];
        }
      }
      getParentType() {
        if (this._parentTypeStack.length > 0) {
          return this._parentTypeStack[this._parentTypeStack.length - 1];
        }
      }
      getInputType() {
        if (this._inputTypeStack.length > 0) {
          return this._inputTypeStack[this._inputTypeStack.length - 1];
        }
      }
      getParentInputType() {
        if (this._inputTypeStack.length > 1) {
          return this._inputTypeStack[this._inputTypeStack.length - 2];
        }
      }
      getFieldDef() {
        if (this._fieldDefStack.length > 0) {
          return this._fieldDefStack[this._fieldDefStack.length - 1];
        }
      }
      getDefaultValue() {
        if (this._defaultValueStack.length > 0) {
          return this._defaultValueStack[this._defaultValueStack.length - 1];
        }
      }
      getDirective() {
        return this._directive;
      }
      getArgument() {
        return this._argument;
      }
      getEnumValue() {
        return this._enumValue;
      }
      enter(node) {
        const schema = this._schema;
        switch (node.kind) {
          case _kinds.Kind.SELECTION_SET: {
            const namedType = (0, _definition.getNamedType)(this.getType());
            this._parentTypeStack.push(
              (0, _definition.isCompositeType)(namedType) ? namedType : void 0
            );
            break;
          }
          case _kinds.Kind.FIELD: {
            const parentType = this.getParentType();
            let fieldDef;
            let fieldType;
            if (parentType) {
              fieldDef = this._getFieldDef(schema, parentType, node);
              if (fieldDef) {
                fieldType = fieldDef.type;
              }
            }
            this._fieldDefStack.push(fieldDef);
            this._typeStack.push(
              (0, _definition.isOutputType)(fieldType) ? fieldType : void 0
            );
            break;
          }
          case _kinds.Kind.DIRECTIVE:
            this._directive = schema.getDirective(node.name.value);
            break;
          case _kinds.Kind.OPERATION_DEFINITION: {
            const rootType = schema.getRootType(node.operation);
            this._typeStack.push(
              (0, _definition.isObjectType)(rootType) ? rootType : void 0
            );
            break;
          }
          case _kinds.Kind.INLINE_FRAGMENT:
          case _kinds.Kind.FRAGMENT_DEFINITION: {
            const typeConditionAST = node.typeCondition;
            const outputType = typeConditionAST ? (0, _typeFromAST.typeFromAST)(schema, typeConditionAST) : (0, _definition.getNamedType)(this.getType());
            this._typeStack.push(
              (0, _definition.isOutputType)(outputType) ? outputType : void 0
            );
            break;
          }
          case _kinds.Kind.VARIABLE_DEFINITION: {
            const inputType = (0, _typeFromAST.typeFromAST)(schema, node.type);
            this._inputTypeStack.push(
              (0, _definition.isInputType)(inputType) ? inputType : void 0
            );
            break;
          }
          case _kinds.Kind.ARGUMENT: {
            var _this$getDirective;
            let argDef;
            let argType;
            const fieldOrDirective = (_this$getDirective = this.getDirective()) !== null && _this$getDirective !== void 0 ? _this$getDirective : this.getFieldDef();
            if (fieldOrDirective) {
              argDef = fieldOrDirective.args.find(
                (arg) => arg.name === node.name.value
              );
              if (argDef) {
                argType = argDef.type;
              }
            }
            this._argument = argDef;
            this._defaultValueStack.push(argDef ? argDef.defaultValue : void 0);
            this._inputTypeStack.push(
              (0, _definition.isInputType)(argType) ? argType : void 0
            );
            break;
          }
          case _kinds.Kind.LIST: {
            const listType = (0, _definition.getNullableType)(this.getInputType());
            const itemType = (0, _definition.isListType)(listType) ? listType.ofType : listType;
            this._defaultValueStack.push(void 0);
            this._inputTypeStack.push(
              (0, _definition.isInputType)(itemType) ? itemType : void 0
            );
            break;
          }
          case _kinds.Kind.OBJECT_FIELD: {
            const objectType = (0, _definition.getNamedType)(this.getInputType());
            let inputFieldType;
            let inputField;
            if ((0, _definition.isInputObjectType)(objectType)) {
              inputField = objectType.getFields()[node.name.value];
              if (inputField) {
                inputFieldType = inputField.type;
              }
            }
            this._defaultValueStack.push(
              inputField ? inputField.defaultValue : void 0
            );
            this._inputTypeStack.push(
              (0, _definition.isInputType)(inputFieldType) ? inputFieldType : void 0
            );
            break;
          }
          case _kinds.Kind.ENUM: {
            const enumType = (0, _definition.getNamedType)(this.getInputType());
            let enumValue;
            if ((0, _definition.isEnumType)(enumType)) {
              enumValue = enumType.getValue(node.value);
            }
            this._enumValue = enumValue;
            break;
          }
          default:
        }
      }
      leave(node) {
        switch (node.kind) {
          case _kinds.Kind.SELECTION_SET:
            this._parentTypeStack.pop();
            break;
          case _kinds.Kind.FIELD:
            this._fieldDefStack.pop();
            this._typeStack.pop();
            break;
          case _kinds.Kind.DIRECTIVE:
            this._directive = null;
            break;
          case _kinds.Kind.OPERATION_DEFINITION:
          case _kinds.Kind.INLINE_FRAGMENT:
          case _kinds.Kind.FRAGMENT_DEFINITION:
            this._typeStack.pop();
            break;
          case _kinds.Kind.VARIABLE_DEFINITION:
            this._inputTypeStack.pop();
            break;
          case _kinds.Kind.ARGUMENT:
            this._argument = null;
            this._defaultValueStack.pop();
            this._inputTypeStack.pop();
            break;
          case _kinds.Kind.LIST:
          case _kinds.Kind.OBJECT_FIELD:
            this._defaultValueStack.pop();
            this._inputTypeStack.pop();
            break;
          case _kinds.Kind.ENUM:
            this._enumValue = null;
            break;
          default:
        }
      }
    };
    exports2.TypeInfo = TypeInfo;
    function getFieldDef(schema, parentType, fieldNode) {
      const name = fieldNode.name.value;
      if (name === _introspection.SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.SchemaMetaFieldDef;
      }
      if (name === _introspection.TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.TypeMetaFieldDef;
      }
      if (name === _introspection.TypeNameMetaFieldDef.name && (0, _definition.isCompositeType)(parentType)) {
        return _introspection.TypeNameMetaFieldDef;
      }
      if ((0, _definition.isObjectType)(parentType) || (0, _definition.isInterfaceType)(parentType)) {
        return parentType.getFields()[name];
      }
    }
    function visitWithTypeInfo(typeInfo, visitor) {
      return {
        enter(...args) {
          const node = args[0];
          typeInfo.enter(node);
          const fn = (0, _visitor.getEnterLeaveForKind)(visitor, node.kind).enter;
          if (fn) {
            const result = fn.apply(visitor, args);
            if (result !== void 0) {
              typeInfo.leave(node);
              if ((0, _ast.isNode)(result)) {
                typeInfo.enter(result);
              }
            }
            return result;
          }
        },
        leave(...args) {
          const node = args[0];
          const fn = (0, _visitor.getEnterLeaveForKind)(visitor, node.kind).leave;
          let result;
          if (fn) {
            result = fn.apply(visitor, args);
          }
          typeInfo.leave(node);
          return result;
        }
      };
    }
  }
});

// node_modules/graphql/language/predicates.js
var require_predicates = __commonJS({
  "node_modules/graphql/language/predicates.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.isConstValueNode = isConstValueNode;
    exports2.isDefinitionNode = isDefinitionNode;
    exports2.isExecutableDefinitionNode = isExecutableDefinitionNode;
    exports2.isSelectionNode = isSelectionNode;
    exports2.isTypeDefinitionNode = isTypeDefinitionNode;
    exports2.isTypeExtensionNode = isTypeExtensionNode;
    exports2.isTypeNode = isTypeNode;
    exports2.isTypeSystemDefinitionNode = isTypeSystemDefinitionNode;
    exports2.isTypeSystemExtensionNode = isTypeSystemExtensionNode;
    exports2.isValueNode = isValueNode;
    var _kinds = require_kinds();
    function isDefinitionNode(node) {
      return isExecutableDefinitionNode(node) || isTypeSystemDefinitionNode(node) || isTypeSystemExtensionNode(node);
    }
    function isExecutableDefinitionNode(node) {
      return node.kind === _kinds.Kind.OPERATION_DEFINITION || node.kind === _kinds.Kind.FRAGMENT_DEFINITION;
    }
    function isSelectionNode(node) {
      return node.kind === _kinds.Kind.FIELD || node.kind === _kinds.Kind.FRAGMENT_SPREAD || node.kind === _kinds.Kind.INLINE_FRAGMENT;
    }
    function isValueNode(node) {
      return node.kind === _kinds.Kind.VARIABLE || node.kind === _kinds.Kind.INT || node.kind === _kinds.Kind.FLOAT || node.kind === _kinds.Kind.STRING || node.kind === _kinds.Kind.BOOLEAN || node.kind === _kinds.Kind.NULL || node.kind === _kinds.Kind.ENUM || node.kind === _kinds.Kind.LIST || node.kind === _kinds.Kind.OBJECT;
    }
    function isConstValueNode(node) {
      return isValueNode(node) && (node.kind === _kinds.Kind.LIST ? node.values.some(isConstValueNode) : node.kind === _kinds.Kind.OBJECT ? node.fields.some((field) => isConstValueNode(field.value)) : node.kind !== _kinds.Kind.VARIABLE);
    }
    function isTypeNode(node) {
      return node.kind === _kinds.Kind.NAMED_TYPE || node.kind === _kinds.Kind.LIST_TYPE || node.kind === _kinds.Kind.NON_NULL_TYPE;
    }
    function isTypeSystemDefinitionNode(node) {
      return node.kind === _kinds.Kind.SCHEMA_DEFINITION || isTypeDefinitionNode(node) || node.kind === _kinds.Kind.DIRECTIVE_DEFINITION;
    }
    function isTypeDefinitionNode(node) {
      return node.kind === _kinds.Kind.SCALAR_TYPE_DEFINITION || node.kind === _kinds.Kind.OBJECT_TYPE_DEFINITION || node.kind === _kinds.Kind.INTERFACE_TYPE_DEFINITION || node.kind === _kinds.Kind.UNION_TYPE_DEFINITION || node.kind === _kinds.Kind.ENUM_TYPE_DEFINITION || node.kind === _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION;
    }
    function isTypeSystemExtensionNode(node) {
      return node.kind === _kinds.Kind.SCHEMA_EXTENSION || isTypeExtensionNode(node);
    }
    function isTypeExtensionNode(node) {
      return node.kind === _kinds.Kind.SCALAR_TYPE_EXTENSION || node.kind === _kinds.Kind.OBJECT_TYPE_EXTENSION || node.kind === _kinds.Kind.INTERFACE_TYPE_EXTENSION || node.kind === _kinds.Kind.UNION_TYPE_EXTENSION || node.kind === _kinds.Kind.ENUM_TYPE_EXTENSION || node.kind === _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION;
    }
  }
});

// node_modules/graphql/validation/rules/ExecutableDefinitionsRule.js
var require_ExecutableDefinitionsRule = __commonJS({
  "node_modules/graphql/validation/rules/ExecutableDefinitionsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.ExecutableDefinitionsRule = ExecutableDefinitionsRule;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    function ExecutableDefinitionsRule(context) {
      return {
        Document(node) {
          for (const definition of node.definitions) {
            if (!(0, _predicates.isExecutableDefinitionNode)(definition)) {
              const defName = definition.kind === _kinds.Kind.SCHEMA_DEFINITION || definition.kind === _kinds.Kind.SCHEMA_EXTENSION ? "schema" : '"' + definition.name.value + '"';
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `The ${defName} definition is not executable.`,
                  {
                    nodes: definition
                  }
                )
              );
            }
          }
          return false;
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/FieldsOnCorrectTypeRule.js
var require_FieldsOnCorrectTypeRule = __commonJS({
  "node_modules/graphql/validation/rules/FieldsOnCorrectTypeRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.FieldsOnCorrectTypeRule = FieldsOnCorrectTypeRule;
    var _didYouMean = require_didYouMean();
    var _naturalCompare = require_naturalCompare();
    var _suggestionList = require_suggestionList();
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function FieldsOnCorrectTypeRule(context) {
      return {
        Field(node) {
          const type = context.getParentType();
          if (type) {
            const fieldDef = context.getFieldDef();
            if (!fieldDef) {
              const schema = context.getSchema();
              const fieldName = node.name.value;
              let suggestion = (0, _didYouMean.didYouMean)(
                "to use an inline fragment on",
                getSuggestedTypeNames(schema, type, fieldName)
              );
              if (suggestion === "") {
                suggestion = (0, _didYouMean.didYouMean)(
                  getSuggestedFieldNames(type, fieldName)
                );
              }
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Cannot query field "${fieldName}" on type "${type.name}".` + suggestion,
                  {
                    nodes: node
                  }
                )
              );
            }
          }
        }
      };
    }
    function getSuggestedTypeNames(schema, type, fieldName) {
      if (!(0, _definition.isAbstractType)(type)) {
        return [];
      }
      const suggestedTypes = /* @__PURE__ */ new Set();
      const usageCount = /* @__PURE__ */ Object.create(null);
      for (const possibleType of schema.getPossibleTypes(type)) {
        if (!possibleType.getFields()[fieldName]) {
          continue;
        }
        suggestedTypes.add(possibleType);
        usageCount[possibleType.name] = 1;
        for (const possibleInterface of possibleType.getInterfaces()) {
          var _usageCount$possibleI;
          if (!possibleInterface.getFields()[fieldName]) {
            continue;
          }
          suggestedTypes.add(possibleInterface);
          usageCount[possibleInterface.name] = ((_usageCount$possibleI = usageCount[possibleInterface.name]) !== null && _usageCount$possibleI !== void 0 ? _usageCount$possibleI : 0) + 1;
        }
      }
      return [...suggestedTypes].sort((typeA, typeB) => {
        const usageCountDiff = usageCount[typeB.name] - usageCount[typeA.name];
        if (usageCountDiff !== 0) {
          return usageCountDiff;
        }
        if ((0, _definition.isInterfaceType)(typeA) && schema.isSubType(typeA, typeB)) {
          return -1;
        }
        if ((0, _definition.isInterfaceType)(typeB) && schema.isSubType(typeB, typeA)) {
          return 1;
        }
        return (0, _naturalCompare.naturalCompare)(typeA.name, typeB.name);
      }).map((x) => x.name);
    }
    function getSuggestedFieldNames(type, fieldName) {
      if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type)) {
        const possibleFieldNames = Object.keys(type.getFields());
        return (0, _suggestionList.suggestionList)(fieldName, possibleFieldNames);
      }
      return [];
    }
  }
});

// node_modules/graphql/validation/rules/FragmentsOnCompositeTypesRule.js
var require_FragmentsOnCompositeTypesRule = __commonJS({
  "node_modules/graphql/validation/rules/FragmentsOnCompositeTypesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.FragmentsOnCompositeTypesRule = FragmentsOnCompositeTypesRule;
    var _GraphQLError = require_GraphQLError();
    var _printer = require_printer();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    function FragmentsOnCompositeTypesRule(context) {
      return {
        InlineFragment(node) {
          const typeCondition = node.typeCondition;
          if (typeCondition) {
            const type = (0, _typeFromAST.typeFromAST)(
              context.getSchema(),
              typeCondition
            );
            if (type && !(0, _definition.isCompositeType)(type)) {
              const typeStr = (0, _printer.print)(typeCondition);
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Fragment cannot condition on non composite type "${typeStr}".`,
                  {
                    nodes: typeCondition
                  }
                )
              );
            }
          }
        },
        FragmentDefinition(node) {
          const type = (0, _typeFromAST.typeFromAST)(
            context.getSchema(),
            node.typeCondition
          );
          if (type && !(0, _definition.isCompositeType)(type)) {
            const typeStr = (0, _printer.print)(node.typeCondition);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`,
                {
                  nodes: node.typeCondition
                }
              )
            );
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/KnownArgumentNamesRule.js
var require_KnownArgumentNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/KnownArgumentNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.KnownArgumentNamesOnDirectivesRule = KnownArgumentNamesOnDirectivesRule;
    exports2.KnownArgumentNamesRule = KnownArgumentNamesRule;
    var _didYouMean = require_didYouMean();
    var _suggestionList = require_suggestionList();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _directives = require_directives();
    function KnownArgumentNamesRule(context) {
      return {
        // eslint-disable-next-line new-cap
        ...KnownArgumentNamesOnDirectivesRule(context),
        Argument(argNode) {
          const argDef = context.getArgument();
          const fieldDef = context.getFieldDef();
          const parentType = context.getParentType();
          if (!argDef && fieldDef && parentType) {
            const argName = argNode.name.value;
            const knownArgsNames = fieldDef.args.map((arg) => arg.name);
            const suggestions = (0, _suggestionList.suggestionList)(
              argName,
              knownArgsNames
            );
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Unknown argument "${argName}" on field "${parentType.name}.${fieldDef.name}".` + (0, _didYouMean.didYouMean)(suggestions),
                {
                  nodes: argNode
                }
              )
            );
          }
        }
      };
    }
    function KnownArgumentNamesOnDirectivesRule(context) {
      const directiveArgs = /* @__PURE__ */ Object.create(null);
      const schema = context.getSchema();
      const definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (const directive of definedDirectives) {
        directiveArgs[directive.name] = directive.args.map((arg) => arg.name);
      }
      const astDefinitions = context.getDocument().definitions;
      for (const def of astDefinitions) {
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          var _def$arguments;
          const argsNodes = (_def$arguments = def.arguments) !== null && _def$arguments !== void 0 ? _def$arguments : [];
          directiveArgs[def.name.value] = argsNodes.map((arg) => arg.name.value);
        }
      }
      return {
        Directive(directiveNode) {
          const directiveName = directiveNode.name.value;
          const knownArgs = directiveArgs[directiveName];
          if (directiveNode.arguments && knownArgs) {
            for (const argNode of directiveNode.arguments) {
              const argName = argNode.name.value;
              if (!knownArgs.includes(argName)) {
                const suggestions = (0, _suggestionList.suggestionList)(
                  argName,
                  knownArgs
                );
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    `Unknown argument "${argName}" on directive "@${directiveName}".` + (0, _didYouMean.didYouMean)(suggestions),
                    {
                      nodes: argNode
                    }
                  )
                );
              }
            }
          }
          return false;
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/KnownDirectivesRule.js
var require_KnownDirectivesRule = __commonJS({
  "node_modules/graphql/validation/rules/KnownDirectivesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.KnownDirectivesRule = KnownDirectivesRule;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _GraphQLError = require_GraphQLError();
    var _ast = require_ast();
    var _directiveLocation = require_directiveLocation();
    var _kinds = require_kinds();
    var _directives = require_directives();
    function KnownDirectivesRule(context) {
      const locationsMap = /* @__PURE__ */ Object.create(null);
      const schema = context.getSchema();
      const definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (const directive of definedDirectives) {
        locationsMap[directive.name] = directive.locations;
      }
      const astDefinitions = context.getDocument().definitions;
      for (const def of astDefinitions) {
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          locationsMap[def.name.value] = def.locations.map((name) => name.value);
        }
      }
      return {
        Directive(node, _key, _parent, _path, ancestors) {
          const name = node.name.value;
          const locations = locationsMap[name];
          if (!locations) {
            context.reportError(
              new _GraphQLError.GraphQLError(`Unknown directive "@${name}".`, {
                nodes: node
              })
            );
            return;
          }
          const candidateLocation = getDirectiveLocationForASTPath(ancestors);
          if (candidateLocation && !locations.includes(candidateLocation)) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Directive "@${name}" may not be used on ${candidateLocation}.`,
                {
                  nodes: node
                }
              )
            );
          }
        }
      };
    }
    function getDirectiveLocationForASTPath(ancestors) {
      const appliedTo = ancestors[ancestors.length - 1];
      "kind" in appliedTo || (0, _invariant.invariant)(false);
      switch (appliedTo.kind) {
        case _kinds.Kind.OPERATION_DEFINITION:
          return getDirectiveLocationForOperation(appliedTo.operation);
        case _kinds.Kind.FIELD:
          return _directiveLocation.DirectiveLocation.FIELD;
        case _kinds.Kind.FRAGMENT_SPREAD:
          return _directiveLocation.DirectiveLocation.FRAGMENT_SPREAD;
        case _kinds.Kind.INLINE_FRAGMENT:
          return _directiveLocation.DirectiveLocation.INLINE_FRAGMENT;
        case _kinds.Kind.FRAGMENT_DEFINITION:
          return _directiveLocation.DirectiveLocation.FRAGMENT_DEFINITION;
        case _kinds.Kind.VARIABLE_DEFINITION:
          return _directiveLocation.DirectiveLocation.VARIABLE_DEFINITION;
        case _kinds.Kind.SCHEMA_DEFINITION:
        case _kinds.Kind.SCHEMA_EXTENSION:
          return _directiveLocation.DirectiveLocation.SCHEMA;
        case _kinds.Kind.SCALAR_TYPE_DEFINITION:
        case _kinds.Kind.SCALAR_TYPE_EXTENSION:
          return _directiveLocation.DirectiveLocation.SCALAR;
        case _kinds.Kind.OBJECT_TYPE_DEFINITION:
        case _kinds.Kind.OBJECT_TYPE_EXTENSION:
          return _directiveLocation.DirectiveLocation.OBJECT;
        case _kinds.Kind.FIELD_DEFINITION:
          return _directiveLocation.DirectiveLocation.FIELD_DEFINITION;
        case _kinds.Kind.INTERFACE_TYPE_DEFINITION:
        case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
          return _directiveLocation.DirectiveLocation.INTERFACE;
        case _kinds.Kind.UNION_TYPE_DEFINITION:
        case _kinds.Kind.UNION_TYPE_EXTENSION:
          return _directiveLocation.DirectiveLocation.UNION;
        case _kinds.Kind.ENUM_TYPE_DEFINITION:
        case _kinds.Kind.ENUM_TYPE_EXTENSION:
          return _directiveLocation.DirectiveLocation.ENUM;
        case _kinds.Kind.ENUM_VALUE_DEFINITION:
          return _directiveLocation.DirectiveLocation.ENUM_VALUE;
        case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION:
        case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
          return _directiveLocation.DirectiveLocation.INPUT_OBJECT;
        case _kinds.Kind.INPUT_VALUE_DEFINITION: {
          const parentNode = ancestors[ancestors.length - 3];
          "kind" in parentNode || (0, _invariant.invariant)(false);
          return parentNode.kind === _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION ? _directiveLocation.DirectiveLocation.INPUT_FIELD_DEFINITION : _directiveLocation.DirectiveLocation.ARGUMENT_DEFINITION;
        }
        default:
          (0, _invariant.invariant)(
            false,
            "Unexpected kind: " + (0, _inspect.inspect)(appliedTo.kind)
          );
      }
    }
    function getDirectiveLocationForOperation(operation) {
      switch (operation) {
        case _ast.OperationTypeNode.QUERY:
          return _directiveLocation.DirectiveLocation.QUERY;
        case _ast.OperationTypeNode.MUTATION:
          return _directiveLocation.DirectiveLocation.MUTATION;
        case _ast.OperationTypeNode.SUBSCRIPTION:
          return _directiveLocation.DirectiveLocation.SUBSCRIPTION;
      }
    }
  }
});

// node_modules/graphql/validation/rules/KnownFragmentNamesRule.js
var require_KnownFragmentNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/KnownFragmentNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.KnownFragmentNamesRule = KnownFragmentNamesRule;
    var _GraphQLError = require_GraphQLError();
    function KnownFragmentNamesRule(context) {
      return {
        FragmentSpread(node) {
          const fragmentName = node.name.value;
          const fragment = context.getFragment(fragmentName);
          if (!fragment) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Unknown fragment "${fragmentName}".`,
                {
                  nodes: node.name
                }
              )
            );
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/KnownTypeNamesRule.js
var require_KnownTypeNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/KnownTypeNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.KnownTypeNamesRule = KnownTypeNamesRule;
    var _didYouMean = require_didYouMean();
    var _suggestionList = require_suggestionList();
    var _GraphQLError = require_GraphQLError();
    var _predicates = require_predicates();
    var _introspection = require_introspection();
    var _scalars = require_scalars();
    function KnownTypeNamesRule(context) {
      const schema = context.getSchema();
      const existingTypesMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
      const definedTypes = /* @__PURE__ */ Object.create(null);
      for (const def of context.getDocument().definitions) {
        if ((0, _predicates.isTypeDefinitionNode)(def)) {
          definedTypes[def.name.value] = true;
        }
      }
      const typeNames = [
        ...Object.keys(existingTypesMap),
        ...Object.keys(definedTypes)
      ];
      return {
        NamedType(node, _1, parent, _2, ancestors) {
          const typeName = node.name.value;
          if (!existingTypesMap[typeName] && !definedTypes[typeName]) {
            var _ancestors$;
            const definitionNode = (_ancestors$ = ancestors[2]) !== null && _ancestors$ !== void 0 ? _ancestors$ : parent;
            const isSDL = definitionNode != null && isSDLNode(definitionNode);
            if (isSDL && standardTypeNames.includes(typeName)) {
              return;
            }
            const suggestedTypes = (0, _suggestionList.suggestionList)(
              typeName,
              isSDL ? standardTypeNames.concat(typeNames) : typeNames
            );
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Unknown type "${typeName}".` + (0, _didYouMean.didYouMean)(suggestedTypes),
                {
                  nodes: node
                }
              )
            );
          }
        }
      };
    }
    var standardTypeNames = [
      ..._scalars.specifiedScalarTypes,
      ..._introspection.introspectionTypes
    ].map((type) => type.name);
    function isSDLNode(value) {
      return "kind" in value && ((0, _predicates.isTypeSystemDefinitionNode)(value) || (0, _predicates.isTypeSystemExtensionNode)(value));
    }
  }
});

// node_modules/graphql/validation/rules/LoneAnonymousOperationRule.js
var require_LoneAnonymousOperationRule = __commonJS({
  "node_modules/graphql/validation/rules/LoneAnonymousOperationRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.LoneAnonymousOperationRule = LoneAnonymousOperationRule;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    function LoneAnonymousOperationRule(context) {
      let operationCount = 0;
      return {
        Document(node) {
          operationCount = node.definitions.filter(
            (definition) => definition.kind === _kinds.Kind.OPERATION_DEFINITION
          ).length;
        },
        OperationDefinition(node) {
          if (!node.name && operationCount > 1) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                "This anonymous operation must be the only defined operation.",
                {
                  nodes: node
                }
              )
            );
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/LoneSchemaDefinitionRule.js
var require_LoneSchemaDefinitionRule = __commonJS({
  "node_modules/graphql/validation/rules/LoneSchemaDefinitionRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.LoneSchemaDefinitionRule = LoneSchemaDefinitionRule;
    var _GraphQLError = require_GraphQLError();
    function LoneSchemaDefinitionRule(context) {
      var _ref, _ref2, _oldSchema$astNode;
      const oldSchema = context.getSchema();
      const alreadyDefined = (_ref = (_ref2 = (_oldSchema$astNode = oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.astNode) !== null && _oldSchema$astNode !== void 0 ? _oldSchema$astNode : oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getQueryType()) !== null && _ref2 !== void 0 ? _ref2 : oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getMutationType()) !== null && _ref !== void 0 ? _ref : oldSchema === null || oldSchema === void 0 ? void 0 : oldSchema.getSubscriptionType();
      let schemaDefinitionsCount = 0;
      return {
        SchemaDefinition(node) {
          if (alreadyDefined) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                "Cannot define a new schema within a schema extension.",
                {
                  nodes: node
                }
              )
            );
            return;
          }
          if (schemaDefinitionsCount > 0) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                "Must provide only one schema definition.",
                {
                  nodes: node
                }
              )
            );
          }
          ++schemaDefinitionsCount;
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/MaxIntrospectionDepthRule.js
var require_MaxIntrospectionDepthRule = __commonJS({
  "node_modules/graphql/validation/rules/MaxIntrospectionDepthRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.MaxIntrospectionDepthRule = MaxIntrospectionDepthRule;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var MAX_LISTS_DEPTH = 3;
    function MaxIntrospectionDepthRule(context) {
      function checkDepth(node, visitedFragments = /* @__PURE__ */ Object.create(null), depth = 0) {
        if (node.kind === _kinds.Kind.FRAGMENT_SPREAD) {
          const fragmentName = node.name.value;
          if (visitedFragments[fragmentName] === true) {
            return false;
          }
          const fragment = context.getFragment(fragmentName);
          if (!fragment) {
            return false;
          }
          try {
            visitedFragments[fragmentName] = true;
            return checkDepth(fragment, visitedFragments, depth);
          } finally {
            visitedFragments[fragmentName] = void 0;
          }
        }
        if (node.kind === _kinds.Kind.FIELD && // check all introspection lists
        (node.name.value === "fields" || node.name.value === "interfaces" || node.name.value === "possibleTypes" || node.name.value === "inputFields")) {
          depth++;
          if (depth >= MAX_LISTS_DEPTH) {
            return true;
          }
        }
        if ("selectionSet" in node && node.selectionSet) {
          for (const child of node.selectionSet.selections) {
            if (checkDepth(child, visitedFragments, depth)) {
              return true;
            }
          }
        }
        return false;
      }
      return {
        Field(node) {
          if (node.name.value === "__schema" || node.name.value === "__type") {
            if (checkDepth(node)) {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  "Maximum introspection depth exceeded",
                  {
                    nodes: [node]
                  }
                )
              );
              return false;
            }
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/NoFragmentCyclesRule.js
var require_NoFragmentCyclesRule = __commonJS({
  "node_modules/graphql/validation/rules/NoFragmentCyclesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.NoFragmentCyclesRule = NoFragmentCyclesRule;
    var _GraphQLError = require_GraphQLError();
    function NoFragmentCyclesRule(context) {
      const visitedFrags = /* @__PURE__ */ Object.create(null);
      const spreadPath = [];
      const spreadPathIndexByName = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: () => false,
        FragmentDefinition(node) {
          detectCycleRecursive(node);
          return false;
        }
      };
      function detectCycleRecursive(fragment) {
        if (visitedFrags[fragment.name.value]) {
          return;
        }
        const fragmentName = fragment.name.value;
        visitedFrags[fragmentName] = true;
        const spreadNodes = context.getFragmentSpreads(fragment.selectionSet);
        if (spreadNodes.length === 0) {
          return;
        }
        spreadPathIndexByName[fragmentName] = spreadPath.length;
        for (const spreadNode of spreadNodes) {
          const spreadName = spreadNode.name.value;
          const cycleIndex = spreadPathIndexByName[spreadName];
          spreadPath.push(spreadNode);
          if (cycleIndex === void 0) {
            const spreadFragment = context.getFragment(spreadName);
            if (spreadFragment) {
              detectCycleRecursive(spreadFragment);
            }
          } else {
            const cyclePath = spreadPath.slice(cycleIndex);
            const viaPath = cyclePath.slice(0, -1).map((s) => '"' + s.name.value + '"').join(", ");
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Cannot spread fragment "${spreadName}" within itself` + (viaPath !== "" ? ` via ${viaPath}.` : "."),
                {
                  nodes: cyclePath
                }
              )
            );
          }
          spreadPath.pop();
        }
        spreadPathIndexByName[fragmentName] = void 0;
      }
    }
  }
});

// node_modules/graphql/validation/rules/NoUndefinedVariablesRule.js
var require_NoUndefinedVariablesRule = __commonJS({
  "node_modules/graphql/validation/rules/NoUndefinedVariablesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.NoUndefinedVariablesRule = NoUndefinedVariablesRule;
    var _GraphQLError = require_GraphQLError();
    function NoUndefinedVariablesRule(context) {
      let variableNameDefined = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: {
          enter() {
            variableNameDefined = /* @__PURE__ */ Object.create(null);
          },
          leave(operation) {
            const usages = context.getRecursiveVariableUsages(operation);
            for (const { node } of usages) {
              const varName = node.name.value;
              if (variableNameDefined[varName] !== true) {
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    operation.name ? `Variable "$${varName}" is not defined by operation "${operation.name.value}".` : `Variable "$${varName}" is not defined.`,
                    {
                      nodes: [node, operation]
                    }
                  )
                );
              }
            }
          }
        },
        VariableDefinition(node) {
          variableNameDefined[node.variable.name.value] = true;
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/NoUnusedFragmentsRule.js
var require_NoUnusedFragmentsRule = __commonJS({
  "node_modules/graphql/validation/rules/NoUnusedFragmentsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.NoUnusedFragmentsRule = NoUnusedFragmentsRule;
    var _GraphQLError = require_GraphQLError();
    function NoUnusedFragmentsRule(context) {
      const operationDefs = [];
      const fragmentDefs = [];
      return {
        OperationDefinition(node) {
          operationDefs.push(node);
          return false;
        },
        FragmentDefinition(node) {
          fragmentDefs.push(node);
          return false;
        },
        Document: {
          leave() {
            const fragmentNameUsed = /* @__PURE__ */ Object.create(null);
            for (const operation of operationDefs) {
              for (const fragment of context.getRecursivelyReferencedFragments(
                operation
              )) {
                fragmentNameUsed[fragment.name.value] = true;
              }
            }
            for (const fragmentDef of fragmentDefs) {
              const fragName = fragmentDef.name.value;
              if (fragmentNameUsed[fragName] !== true) {
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    `Fragment "${fragName}" is never used.`,
                    {
                      nodes: fragmentDef
                    }
                  )
                );
              }
            }
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/NoUnusedVariablesRule.js
var require_NoUnusedVariablesRule = __commonJS({
  "node_modules/graphql/validation/rules/NoUnusedVariablesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.NoUnusedVariablesRule = NoUnusedVariablesRule;
    var _GraphQLError = require_GraphQLError();
    function NoUnusedVariablesRule(context) {
      let variableDefs = [];
      return {
        OperationDefinition: {
          enter() {
            variableDefs = [];
          },
          leave(operation) {
            const variableNameUsed = /* @__PURE__ */ Object.create(null);
            const usages = context.getRecursiveVariableUsages(operation);
            for (const { node } of usages) {
              variableNameUsed[node.name.value] = true;
            }
            for (const variableDef of variableDefs) {
              const variableName = variableDef.variable.name.value;
              if (variableNameUsed[variableName] !== true) {
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    operation.name ? `Variable "$${variableName}" is never used in operation "${operation.name.value}".` : `Variable "$${variableName}" is never used.`,
                    {
                      nodes: variableDef
                    }
                  )
                );
              }
            }
          }
        },
        VariableDefinition(def) {
          variableDefs.push(def);
        }
      };
    }
  }
});

// node_modules/graphql/utilities/sortValueNode.js
var require_sortValueNode = __commonJS({
  "node_modules/graphql/utilities/sortValueNode.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.sortValueNode = sortValueNode;
    var _naturalCompare = require_naturalCompare();
    var _kinds = require_kinds();
    function sortValueNode(valueNode) {
      switch (valueNode.kind) {
        case _kinds.Kind.OBJECT:
          return { ...valueNode, fields: sortFields(valueNode.fields) };
        case _kinds.Kind.LIST:
          return { ...valueNode, values: valueNode.values.map(sortValueNode) };
        case _kinds.Kind.INT:
        case _kinds.Kind.FLOAT:
        case _kinds.Kind.STRING:
        case _kinds.Kind.BOOLEAN:
        case _kinds.Kind.NULL:
        case _kinds.Kind.ENUM:
        case _kinds.Kind.VARIABLE:
          return valueNode;
      }
    }
    function sortFields(fields) {
      return fields.map((fieldNode) => ({
        ...fieldNode,
        value: sortValueNode(fieldNode.value)
      })).sort(
        (fieldA, fieldB) => (0, _naturalCompare.naturalCompare)(fieldA.name.value, fieldB.name.value)
      );
    }
  }
});

// node_modules/graphql/validation/rules/OverlappingFieldsCanBeMergedRule.js
var require_OverlappingFieldsCanBeMergedRule = __commonJS({
  "node_modules/graphql/validation/rules/OverlappingFieldsCanBeMergedRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.OverlappingFieldsCanBeMergedRule = OverlappingFieldsCanBeMergedRule;
    var _inspect = require_inspect();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var _sortValueNode = require_sortValueNode();
    var _typeFromAST = require_typeFromAST();
    function reasonMessage(reason) {
      if (Array.isArray(reason)) {
        return reason.map(
          ([responseName, subReason]) => `subfields "${responseName}" conflict because ` + reasonMessage(subReason)
        ).join(" and ");
      }
      return reason;
    }
    function OverlappingFieldsCanBeMergedRule(context) {
      const comparedFragmentPairs = new PairSet();
      const cachedFieldsAndFragmentNames = /* @__PURE__ */ new Map();
      return {
        SelectionSet(selectionSet) {
          const conflicts = findConflictsWithinSelectionSet(
            context,
            cachedFieldsAndFragmentNames,
            comparedFragmentPairs,
            context.getParentType(),
            selectionSet
          );
          for (const [[responseName, reason], fields1, fields2] of conflicts) {
            const reasonMsg = reasonMessage(reason);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Fields "${responseName}" conflict because ${reasonMsg}. Use different aliases on the fields to fetch both if this was intentional.`,
                {
                  nodes: fields1.concat(fields2)
                }
              )
            );
          }
        }
      };
    }
    function findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentType, selectionSet) {
      const conflicts = [];
      const [fieldMap, fragmentNames] = getFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        parentType,
        selectionSet
      );
      collectConflictsWithin(
        context,
        conflicts,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        fieldMap
      );
      if (fragmentNames.length !== 0) {
        for (let i = 0; i < fragmentNames.length; i++) {
          collectConflictsBetweenFieldsAndFragment(
            context,
            conflicts,
            cachedFieldsAndFragmentNames,
            comparedFragmentPairs,
            false,
            fieldMap,
            fragmentNames[i]
          );
          for (let j = i + 1; j < fragmentNames.length; j++) {
            collectConflictsBetweenFragments(
              context,
              conflicts,
              cachedFieldsAndFragmentNames,
              comparedFragmentPairs,
              false,
              fragmentNames[i],
              fragmentNames[j]
            );
          }
        }
      }
      return conflicts;
    }
    function collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fieldMap, fragmentName) {
      const fragment = context.getFragment(fragmentName);
      if (!fragment) {
        return;
      }
      const [fieldMap2, referencedFragmentNames] = getReferencedFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        fragment
      );
      if (fieldMap === fieldMap2) {
        return;
      }
      collectConflictsBetween(
        context,
        conflicts,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        areMutuallyExclusive,
        fieldMap,
        fieldMap2
      );
      for (const referencedFragmentName of referencedFragmentNames) {
        if (comparedFragmentPairs.has(
          referencedFragmentName,
          fragmentName,
          areMutuallyExclusive
        )) {
          continue;
        }
        comparedFragmentPairs.add(
          referencedFragmentName,
          fragmentName,
          areMutuallyExclusive
        );
        collectConflictsBetweenFieldsAndFragment(
          context,
          conflicts,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          areMutuallyExclusive,
          fieldMap,
          referencedFragmentName
        );
      }
    }
    function collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, fragmentName1, fragmentName2) {
      if (fragmentName1 === fragmentName2) {
        return;
      }
      if (comparedFragmentPairs.has(
        fragmentName1,
        fragmentName2,
        areMutuallyExclusive
      )) {
        return;
      }
      comparedFragmentPairs.add(fragmentName1, fragmentName2, areMutuallyExclusive);
      const fragment1 = context.getFragment(fragmentName1);
      const fragment2 = context.getFragment(fragmentName2);
      if (!fragment1 || !fragment2) {
        return;
      }
      const [fieldMap1, referencedFragmentNames1] = getReferencedFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        fragment1
      );
      const [fieldMap2, referencedFragmentNames2] = getReferencedFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        fragment2
      );
      collectConflictsBetween(
        context,
        conflicts,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        areMutuallyExclusive,
        fieldMap1,
        fieldMap2
      );
      for (const referencedFragmentName2 of referencedFragmentNames2) {
        collectConflictsBetweenFragments(
          context,
          conflicts,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          areMutuallyExclusive,
          fragmentName1,
          referencedFragmentName2
        );
      }
      for (const referencedFragmentName1 of referencedFragmentNames1) {
        collectConflictsBetweenFragments(
          context,
          conflicts,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          areMutuallyExclusive,
          referencedFragmentName1,
          fragmentName2
        );
      }
    }
    function findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, areMutuallyExclusive, parentType1, selectionSet1, parentType2, selectionSet2) {
      const conflicts = [];
      const [fieldMap1, fragmentNames1] = getFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        parentType1,
        selectionSet1
      );
      const [fieldMap2, fragmentNames2] = getFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        parentType2,
        selectionSet2
      );
      collectConflictsBetween(
        context,
        conflicts,
        cachedFieldsAndFragmentNames,
        comparedFragmentPairs,
        areMutuallyExclusive,
        fieldMap1,
        fieldMap2
      );
      for (const fragmentName2 of fragmentNames2) {
        collectConflictsBetweenFieldsAndFragment(
          context,
          conflicts,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          areMutuallyExclusive,
          fieldMap1,
          fragmentName2
        );
      }
      for (const fragmentName1 of fragmentNames1) {
        collectConflictsBetweenFieldsAndFragment(
          context,
          conflicts,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          areMutuallyExclusive,
          fieldMap2,
          fragmentName1
        );
      }
      for (const fragmentName1 of fragmentNames1) {
        for (const fragmentName2 of fragmentNames2) {
          collectConflictsBetweenFragments(
            context,
            conflicts,
            cachedFieldsAndFragmentNames,
            comparedFragmentPairs,
            areMutuallyExclusive,
            fragmentName1,
            fragmentName2
          );
        }
      }
      return conflicts;
    }
    function collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, fieldMap) {
      for (const [responseName, fields] of Object.entries(fieldMap)) {
        if (fields.length > 1) {
          for (let i = 0; i < fields.length; i++) {
            for (let j = i + 1; j < fields.length; j++) {
              const conflict = findConflict(
                context,
                cachedFieldsAndFragmentNames,
                comparedFragmentPairs,
                false,
                // within one collection is never mutually exclusive
                responseName,
                fields[i],
                fields[j]
              );
              if (conflict) {
                conflicts.push(conflict);
              }
            }
          }
        }
      }
    }
    function collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, fieldMap1, fieldMap2) {
      for (const [responseName, fields1] of Object.entries(fieldMap1)) {
        const fields2 = fieldMap2[responseName];
        if (fields2) {
          for (const field1 of fields1) {
            for (const field2 of fields2) {
              const conflict = findConflict(
                context,
                cachedFieldsAndFragmentNames,
                comparedFragmentPairs,
                parentFieldsAreMutuallyExclusive,
                responseName,
                field1,
                field2
              );
              if (conflict) {
                conflicts.push(conflict);
              }
            }
          }
        }
      }
    }
    function findConflict(context, cachedFieldsAndFragmentNames, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, field1, field2) {
      const [parentType1, node1, def1] = field1;
      const [parentType2, node2, def2] = field2;
      const areMutuallyExclusive = parentFieldsAreMutuallyExclusive || parentType1 !== parentType2 && (0, _definition.isObjectType)(parentType1) && (0, _definition.isObjectType)(parentType2);
      if (!areMutuallyExclusive) {
        const name1 = node1.name.value;
        const name2 = node2.name.value;
        if (name1 !== name2) {
          return [
            [responseName, `"${name1}" and "${name2}" are different fields`],
            [node1],
            [node2]
          ];
        }
        if (!sameArguments(node1, node2)) {
          return [
            [responseName, "they have differing arguments"],
            [node1],
            [node2]
          ];
        }
      }
      const type1 = def1 === null || def1 === void 0 ? void 0 : def1.type;
      const type2 = def2 === null || def2 === void 0 ? void 0 : def2.type;
      if (type1 && type2 && doTypesConflict(type1, type2)) {
        return [
          [
            responseName,
            `they return conflicting types "${(0, _inspect.inspect)(
              type1
            )}" and "${(0, _inspect.inspect)(type2)}"`
          ],
          [node1],
          [node2]
        ];
      }
      const selectionSet1 = node1.selectionSet;
      const selectionSet2 = node2.selectionSet;
      if (selectionSet1 && selectionSet2) {
        const conflicts = findConflictsBetweenSubSelectionSets(
          context,
          cachedFieldsAndFragmentNames,
          comparedFragmentPairs,
          areMutuallyExclusive,
          (0, _definition.getNamedType)(type1),
          selectionSet1,
          (0, _definition.getNamedType)(type2),
          selectionSet2
        );
        return subfieldConflicts(conflicts, responseName, node1, node2);
      }
    }
    function sameArguments(node1, node2) {
      const args1 = node1.arguments;
      const args2 = node2.arguments;
      if (args1 === void 0 || args1.length === 0) {
        return args2 === void 0 || args2.length === 0;
      }
      if (args2 === void 0 || args2.length === 0) {
        return false;
      }
      if (args1.length !== args2.length) {
        return false;
      }
      const values2 = new Map(args2.map(({ name, value }) => [name.value, value]));
      return args1.every((arg1) => {
        const value1 = arg1.value;
        const value2 = values2.get(arg1.name.value);
        if (value2 === void 0) {
          return false;
        }
        return stringifyValue(value1) === stringifyValue(value2);
      });
    }
    function stringifyValue(value) {
      return (0, _printer.print)((0, _sortValueNode.sortValueNode)(value));
    }
    function doTypesConflict(type1, type2) {
      if ((0, _definition.isListType)(type1)) {
        return (0, _definition.isListType)(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
      }
      if ((0, _definition.isListType)(type2)) {
        return true;
      }
      if ((0, _definition.isNonNullType)(type1)) {
        return (0, _definition.isNonNullType)(type2) ? doTypesConflict(type1.ofType, type2.ofType) : true;
      }
      if ((0, _definition.isNonNullType)(type2)) {
        return true;
      }
      if ((0, _definition.isLeafType)(type1) || (0, _definition.isLeafType)(type2)) {
        return type1 !== type2;
      }
      return false;
    }
    function getFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, parentType, selectionSet) {
      const cached = cachedFieldsAndFragmentNames.get(selectionSet);
      if (cached) {
        return cached;
      }
      const nodeAndDefs = /* @__PURE__ */ Object.create(null);
      const fragmentNames = /* @__PURE__ */ Object.create(null);
      _collectFieldsAndFragmentNames(
        context,
        parentType,
        selectionSet,
        nodeAndDefs,
        fragmentNames
      );
      const result = [nodeAndDefs, Object.keys(fragmentNames)];
      cachedFieldsAndFragmentNames.set(selectionSet, result);
      return result;
    }
    function getReferencedFieldsAndFragmentNames(context, cachedFieldsAndFragmentNames, fragment) {
      const cached = cachedFieldsAndFragmentNames.get(fragment.selectionSet);
      if (cached) {
        return cached;
      }
      const fragmentType = (0, _typeFromAST.typeFromAST)(
        context.getSchema(),
        fragment.typeCondition
      );
      return getFieldsAndFragmentNames(
        context,
        cachedFieldsAndFragmentNames,
        fragmentType,
        fragment.selectionSet
      );
    }
    function _collectFieldsAndFragmentNames(context, parentType, selectionSet, nodeAndDefs, fragmentNames) {
      for (const selection of selectionSet.selections) {
        switch (selection.kind) {
          case _kinds.Kind.FIELD: {
            const fieldName = selection.name.value;
            let fieldDef;
            if ((0, _definition.isObjectType)(parentType) || (0, _definition.isInterfaceType)(parentType)) {
              fieldDef = parentType.getFields()[fieldName];
            }
            const responseName = selection.alias ? selection.alias.value : fieldName;
            if (!nodeAndDefs[responseName]) {
              nodeAndDefs[responseName] = [];
            }
            nodeAndDefs[responseName].push([parentType, selection, fieldDef]);
            break;
          }
          case _kinds.Kind.FRAGMENT_SPREAD:
            fragmentNames[selection.name.value] = true;
            break;
          case _kinds.Kind.INLINE_FRAGMENT: {
            const typeCondition = selection.typeCondition;
            const inlineFragmentType = typeCondition ? (0, _typeFromAST.typeFromAST)(context.getSchema(), typeCondition) : parentType;
            _collectFieldsAndFragmentNames(
              context,
              inlineFragmentType,
              selection.selectionSet,
              nodeAndDefs,
              fragmentNames
            );
            break;
          }
        }
      }
    }
    function subfieldConflicts(conflicts, responseName, node1, node2) {
      if (conflicts.length > 0) {
        return [
          [responseName, conflicts.map(([reason]) => reason)],
          [node1, ...conflicts.map(([, fields1]) => fields1).flat()],
          [node2, ...conflicts.map(([, , fields2]) => fields2).flat()]
        ];
      }
    }
    var PairSet = class {
      constructor() {
        this._data = /* @__PURE__ */ new Map();
      }
      has(a, b, areMutuallyExclusive) {
        var _this$_data$get;
        const [key1, key2] = a < b ? [a, b] : [b, a];
        const result = (_this$_data$get = this._data.get(key1)) === null || _this$_data$get === void 0 ? void 0 : _this$_data$get.get(key2);
        if (result === void 0) {
          return false;
        }
        return areMutuallyExclusive ? true : areMutuallyExclusive === result;
      }
      add(a, b, areMutuallyExclusive) {
        const [key1, key2] = a < b ? [a, b] : [b, a];
        const map = this._data.get(key1);
        if (map === void 0) {
          this._data.set(key1, /* @__PURE__ */ new Map([[key2, areMutuallyExclusive]]));
        } else {
          map.set(key2, areMutuallyExclusive);
        }
      }
    };
  }
});

// node_modules/graphql/validation/rules/PossibleFragmentSpreadsRule.js
var require_PossibleFragmentSpreadsRule = __commonJS({
  "node_modules/graphql/validation/rules/PossibleFragmentSpreadsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.PossibleFragmentSpreadsRule = PossibleFragmentSpreadsRule;
    var _inspect = require_inspect();
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    var _typeComparators = require_typeComparators();
    var _typeFromAST = require_typeFromAST();
    function PossibleFragmentSpreadsRule(context) {
      return {
        InlineFragment(node) {
          const fragType = context.getType();
          const parentType = context.getParentType();
          if ((0, _definition.isCompositeType)(fragType) && (0, _definition.isCompositeType)(parentType) && !(0, _typeComparators.doTypesOverlap)(
            context.getSchema(),
            fragType,
            parentType
          )) {
            const parentTypeStr = (0, _inspect.inspect)(parentType);
            const fragTypeStr = (0, _inspect.inspect)(fragType);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Fragment cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
                {
                  nodes: node
                }
              )
            );
          }
        },
        FragmentSpread(node) {
          const fragName = node.name.value;
          const fragType = getFragmentType(context, fragName);
          const parentType = context.getParentType();
          if (fragType && parentType && !(0, _typeComparators.doTypesOverlap)(
            context.getSchema(),
            fragType,
            parentType
          )) {
            const parentTypeStr = (0, _inspect.inspect)(parentType);
            const fragTypeStr = (0, _inspect.inspect)(fragType);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Fragment "${fragName}" cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
                {
                  nodes: node
                }
              )
            );
          }
        }
      };
    }
    function getFragmentType(context, name) {
      const frag = context.getFragment(name);
      if (frag) {
        const type = (0, _typeFromAST.typeFromAST)(
          context.getSchema(),
          frag.typeCondition
        );
        if ((0, _definition.isCompositeType)(type)) {
          return type;
        }
      }
    }
  }
});

// node_modules/graphql/validation/rules/PossibleTypeExtensionsRule.js
var require_PossibleTypeExtensionsRule = __commonJS({
  "node_modules/graphql/validation/rules/PossibleTypeExtensionsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.PossibleTypeExtensionsRule = PossibleTypeExtensionsRule;
    var _didYouMean = require_didYouMean();
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _suggestionList = require_suggestionList();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    var _definition = require_definition();
    function PossibleTypeExtensionsRule(context) {
      const schema = context.getSchema();
      const definedTypes = /* @__PURE__ */ Object.create(null);
      for (const def of context.getDocument().definitions) {
        if ((0, _predicates.isTypeDefinitionNode)(def)) {
          definedTypes[def.name.value] = def;
        }
      }
      return {
        ScalarTypeExtension: checkExtension,
        ObjectTypeExtension: checkExtension,
        InterfaceTypeExtension: checkExtension,
        UnionTypeExtension: checkExtension,
        EnumTypeExtension: checkExtension,
        InputObjectTypeExtension: checkExtension
      };
      function checkExtension(node) {
        const typeName = node.name.value;
        const defNode = definedTypes[typeName];
        const existingType = schema === null || schema === void 0 ? void 0 : schema.getType(typeName);
        let expectedKind;
        if (defNode) {
          expectedKind = defKindToExtKind[defNode.kind];
        } else if (existingType) {
          expectedKind = typeToExtKind(existingType);
        }
        if (expectedKind) {
          if (expectedKind !== node.kind) {
            const kindStr = extensionKindToTypeName(node.kind);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Cannot extend non-${kindStr} type "${typeName}".`,
                {
                  nodes: defNode ? [defNode, node] : node
                }
              )
            );
          }
        } else {
          const allTypeNames = Object.keys({
            ...definedTypes,
            ...schema === null || schema === void 0 ? void 0 : schema.getTypeMap()
          });
          const suggestedTypes = (0, _suggestionList.suggestionList)(
            typeName,
            allTypeNames
          );
          context.reportError(
            new _GraphQLError.GraphQLError(
              `Cannot extend type "${typeName}" because it is not defined.` + (0, _didYouMean.didYouMean)(suggestedTypes),
              {
                nodes: node.name
              }
            )
          );
        }
      }
    }
    var defKindToExtKind = {
      [_kinds.Kind.SCALAR_TYPE_DEFINITION]: _kinds.Kind.SCALAR_TYPE_EXTENSION,
      [_kinds.Kind.OBJECT_TYPE_DEFINITION]: _kinds.Kind.OBJECT_TYPE_EXTENSION,
      [_kinds.Kind.INTERFACE_TYPE_DEFINITION]: _kinds.Kind.INTERFACE_TYPE_EXTENSION,
      [_kinds.Kind.UNION_TYPE_DEFINITION]: _kinds.Kind.UNION_TYPE_EXTENSION,
      [_kinds.Kind.ENUM_TYPE_DEFINITION]: _kinds.Kind.ENUM_TYPE_EXTENSION,
      [_kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION]: _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION
    };
    function typeToExtKind(type) {
      if ((0, _definition.isScalarType)(type)) {
        return _kinds.Kind.SCALAR_TYPE_EXTENSION;
      }
      if ((0, _definition.isObjectType)(type)) {
        return _kinds.Kind.OBJECT_TYPE_EXTENSION;
      }
      if ((0, _definition.isInterfaceType)(type)) {
        return _kinds.Kind.INTERFACE_TYPE_EXTENSION;
      }
      if ((0, _definition.isUnionType)(type)) {
        return _kinds.Kind.UNION_TYPE_EXTENSION;
      }
      if ((0, _definition.isEnumType)(type)) {
        return _kinds.Kind.ENUM_TYPE_EXTENSION;
      }
      if ((0, _definition.isInputObjectType)(type)) {
        return _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION;
      }
      (0, _invariant.invariant)(
        false,
        "Unexpected type: " + (0, _inspect.inspect)(type)
      );
    }
    function extensionKindToTypeName(kind) {
      switch (kind) {
        case _kinds.Kind.SCALAR_TYPE_EXTENSION:
          return "scalar";
        case _kinds.Kind.OBJECT_TYPE_EXTENSION:
          return "object";
        case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
          return "interface";
        case _kinds.Kind.UNION_TYPE_EXTENSION:
          return "union";
        case _kinds.Kind.ENUM_TYPE_EXTENSION:
          return "enum";
        case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
          return "input object";
        default:
          (0, _invariant.invariant)(
            false,
            "Unexpected kind: " + (0, _inspect.inspect)(kind)
          );
      }
    }
  }
});

// node_modules/graphql/validation/rules/ProvidedRequiredArgumentsRule.js
var require_ProvidedRequiredArgumentsRule = __commonJS({
  "node_modules/graphql/validation/rules/ProvidedRequiredArgumentsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.ProvidedRequiredArgumentsOnDirectivesRule = ProvidedRequiredArgumentsOnDirectivesRule;
    exports2.ProvidedRequiredArgumentsRule = ProvidedRequiredArgumentsRule;
    var _inspect = require_inspect();
    var _keyMap = require_keyMap();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var _directives = require_directives();
    function ProvidedRequiredArgumentsRule(context) {
      return {
        // eslint-disable-next-line new-cap
        ...ProvidedRequiredArgumentsOnDirectivesRule(context),
        Field: {
          // Validate on leave to allow for deeper errors to appear first.
          leave(fieldNode) {
            var _fieldNode$arguments;
            const fieldDef = context.getFieldDef();
            if (!fieldDef) {
              return false;
            }
            const providedArgs = new Set(
              // FIXME: https://github.com/graphql/graphql-js/issues/2203
              /* c8 ignore next */
              (_fieldNode$arguments = fieldNode.arguments) === null || _fieldNode$arguments === void 0 ? void 0 : _fieldNode$arguments.map((arg) => arg.name.value)
            );
            for (const argDef of fieldDef.args) {
              if (!providedArgs.has(argDef.name) && (0, _definition.isRequiredArgument)(argDef)) {
                const argTypeStr = (0, _inspect.inspect)(argDef.type);
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    `Field "${fieldDef.name}" argument "${argDef.name}" of type "${argTypeStr}" is required, but it was not provided.`,
                    {
                      nodes: fieldNode
                    }
                  )
                );
              }
            }
          }
        }
      };
    }
    function ProvidedRequiredArgumentsOnDirectivesRule(context) {
      var _schema$getDirectives;
      const requiredArgsMap = /* @__PURE__ */ Object.create(null);
      const schema = context.getSchema();
      const definedDirectives = (_schema$getDirectives = schema === null || schema === void 0 ? void 0 : schema.getDirectives()) !== null && _schema$getDirectives !== void 0 ? _schema$getDirectives : _directives.specifiedDirectives;
      for (const directive of definedDirectives) {
        requiredArgsMap[directive.name] = (0, _keyMap.keyMap)(
          directive.args.filter(_definition.isRequiredArgument),
          (arg) => arg.name
        );
      }
      const astDefinitions = context.getDocument().definitions;
      for (const def of astDefinitions) {
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          var _def$arguments;
          const argNodes = (_def$arguments = def.arguments) !== null && _def$arguments !== void 0 ? _def$arguments : [];
          requiredArgsMap[def.name.value] = (0, _keyMap.keyMap)(
            argNodes.filter(isRequiredArgumentNode),
            (arg) => arg.name.value
          );
        }
      }
      return {
        Directive: {
          // Validate on leave to allow for deeper errors to appear first.
          leave(directiveNode) {
            const directiveName = directiveNode.name.value;
            const requiredArgs = requiredArgsMap[directiveName];
            if (requiredArgs) {
              var _directiveNode$argume;
              const argNodes = (_directiveNode$argume = directiveNode.arguments) !== null && _directiveNode$argume !== void 0 ? _directiveNode$argume : [];
              const argNodeMap = new Set(argNodes.map((arg) => arg.name.value));
              for (const [argName, argDef] of Object.entries(requiredArgs)) {
                if (!argNodeMap.has(argName)) {
                  const argType = (0, _definition.isType)(argDef.type) ? (0, _inspect.inspect)(argDef.type) : (0, _printer.print)(argDef.type);
                  context.reportError(
                    new _GraphQLError.GraphQLError(
                      `Directive "@${directiveName}" argument "${argName}" of type "${argType}" is required, but it was not provided.`,
                      {
                        nodes: directiveNode
                      }
                    )
                  );
                }
              }
            }
          }
        }
      };
    }
    function isRequiredArgumentNode(arg) {
      return arg.type.kind === _kinds.Kind.NON_NULL_TYPE && arg.defaultValue == null;
    }
  }
});

// node_modules/graphql/validation/rules/ScalarLeafsRule.js
var require_ScalarLeafsRule = __commonJS({
  "node_modules/graphql/validation/rules/ScalarLeafsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.ScalarLeafsRule = ScalarLeafsRule;
    var _inspect = require_inspect();
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function ScalarLeafsRule(context) {
      return {
        Field(node) {
          const type = context.getType();
          const selectionSet = node.selectionSet;
          if (type) {
            if ((0, _definition.isLeafType)((0, _definition.getNamedType)(type))) {
              if (selectionSet) {
                const fieldName = node.name.value;
                const typeStr = (0, _inspect.inspect)(type);
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    `Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`,
                    {
                      nodes: selectionSet
                    }
                  )
                );
              }
            } else if (!selectionSet) {
              const fieldName = node.name.value;
              const typeStr = (0, _inspect.inspect)(type);
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`,
                  {
                    nodes: node
                  }
                )
              );
            }
          }
        }
      };
    }
  }
});

// node_modules/graphql/jsutils/printPathArray.js
var require_printPathArray = __commonJS({
  "node_modules/graphql/jsutils/printPathArray.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.printPathArray = printPathArray;
    function printPathArray(path2) {
      return path2.map(
        (key) => typeof key === "number" ? "[" + key.toString() + "]" : "." + key
      ).join("");
    }
  }
});

// node_modules/graphql/jsutils/Path.js
var require_Path = __commonJS({
  "node_modules/graphql/jsutils/Path.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.addPath = addPath;
    exports2.pathToArray = pathToArray;
    function addPath(prev, key, typename) {
      return {
        prev,
        key,
        typename
      };
    }
    function pathToArray(path2) {
      const flattened = [];
      let curr = path2;
      while (curr) {
        flattened.push(curr.key);
        curr = curr.prev;
      }
      return flattened.reverse();
    }
  }
});

// node_modules/graphql/utilities/coerceInputValue.js
var require_coerceInputValue = __commonJS({
  "node_modules/graphql/utilities/coerceInputValue.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.coerceInputValue = coerceInputValue;
    var _didYouMean = require_didYouMean();
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _isIterableObject = require_isIterableObject();
    var _isObjectLike = require_isObjectLike();
    var _Path = require_Path();
    var _printPathArray = require_printPathArray();
    var _suggestionList = require_suggestionList();
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function coerceInputValue(inputValue, type, onError = defaultOnError) {
      return coerceInputValueImpl(inputValue, type, onError, void 0);
    }
    function defaultOnError(path2, invalidValue, error) {
      let errorPrefix = "Invalid value " + (0, _inspect.inspect)(invalidValue);
      if (path2.length > 0) {
        errorPrefix += ` at "value${(0, _printPathArray.printPathArray)(path2)}"`;
      }
      error.message = errorPrefix + ": " + error.message;
      throw error;
    }
    function coerceInputValueImpl(inputValue, type, onError, path2) {
      if ((0, _definition.isNonNullType)(type)) {
        if (inputValue != null) {
          return coerceInputValueImpl(inputValue, type.ofType, onError, path2);
        }
        onError(
          (0, _Path.pathToArray)(path2),
          inputValue,
          new _GraphQLError.GraphQLError(
            `Expected non-nullable type "${(0, _inspect.inspect)(
              type
            )}" not to be null.`
          )
        );
        return;
      }
      if (inputValue == null) {
        return null;
      }
      if ((0, _definition.isListType)(type)) {
        const itemType = type.ofType;
        if ((0, _isIterableObject.isIterableObject)(inputValue)) {
          return Array.from(inputValue, (itemValue, index) => {
            const itemPath = (0, _Path.addPath)(path2, index, void 0);
            return coerceInputValueImpl(itemValue, itemType, onError, itemPath);
          });
        }
        return [coerceInputValueImpl(inputValue, itemType, onError, path2)];
      }
      if ((0, _definition.isInputObjectType)(type)) {
        if (!(0, _isObjectLike.isObjectLike)(inputValue)) {
          onError(
            (0, _Path.pathToArray)(path2),
            inputValue,
            new _GraphQLError.GraphQLError(
              `Expected type "${type.name}" to be an object.`
            )
          );
          return;
        }
        const coercedValue = {};
        const fieldDefs = type.getFields();
        for (const field of Object.values(fieldDefs)) {
          const fieldValue = inputValue[field.name];
          if (fieldValue === void 0) {
            if (field.defaultValue !== void 0) {
              coercedValue[field.name] = field.defaultValue;
            } else if ((0, _definition.isNonNullType)(field.type)) {
              const typeStr = (0, _inspect.inspect)(field.type);
              onError(
                (0, _Path.pathToArray)(path2),
                inputValue,
                new _GraphQLError.GraphQLError(
                  `Field "${field.name}" of required type "${typeStr}" was not provided.`
                )
              );
            }
            continue;
          }
          coercedValue[field.name] = coerceInputValueImpl(
            fieldValue,
            field.type,
            onError,
            (0, _Path.addPath)(path2, field.name, type.name)
          );
        }
        for (const fieldName of Object.keys(inputValue)) {
          if (!fieldDefs[fieldName]) {
            const suggestions = (0, _suggestionList.suggestionList)(
              fieldName,
              Object.keys(type.getFields())
            );
            onError(
              (0, _Path.pathToArray)(path2),
              inputValue,
              new _GraphQLError.GraphQLError(
                `Field "${fieldName}" is not defined by type "${type.name}".` + (0, _didYouMean.didYouMean)(suggestions)
              )
            );
          }
        }
        if (type.isOneOf) {
          const keys = Object.keys(coercedValue);
          if (keys.length !== 1) {
            onError(
              (0, _Path.pathToArray)(path2),
              inputValue,
              new _GraphQLError.GraphQLError(
                `Exactly one key must be specified for OneOf type "${type.name}".`
              )
            );
          }
          const key = keys[0];
          const value = coercedValue[key];
          if (value === null) {
            onError(
              (0, _Path.pathToArray)(path2).concat(key),
              value,
              new _GraphQLError.GraphQLError(`Field "${key}" must be non-null.`)
            );
          }
        }
        return coercedValue;
      }
      if ((0, _definition.isLeafType)(type)) {
        let parseResult;
        try {
          parseResult = type.parseValue(inputValue);
        } catch (error) {
          if (error instanceof _GraphQLError.GraphQLError) {
            onError((0, _Path.pathToArray)(path2), inputValue, error);
          } else {
            onError(
              (0, _Path.pathToArray)(path2),
              inputValue,
              new _GraphQLError.GraphQLError(
                `Expected type "${type.name}". ` + error.message,
                {
                  originalError: error
                }
              )
            );
          }
          return;
        }
        if (parseResult === void 0) {
          onError(
            (0, _Path.pathToArray)(path2),
            inputValue,
            new _GraphQLError.GraphQLError(`Expected type "${type.name}".`)
          );
        }
        return parseResult;
      }
      (0, _invariant.invariant)(
        false,
        "Unexpected input type: " + (0, _inspect.inspect)(type)
      );
    }
  }
});

// node_modules/graphql/utilities/valueFromAST.js
var require_valueFromAST = __commonJS({
  "node_modules/graphql/utilities/valueFromAST.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.valueFromAST = valueFromAST;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _keyMap = require_keyMap();
    var _kinds = require_kinds();
    var _definition = require_definition();
    function valueFromAST(valueNode, type, variables) {
      if (!valueNode) {
        return;
      }
      if (valueNode.kind === _kinds.Kind.VARIABLE) {
        const variableName = valueNode.name.value;
        if (variables == null || variables[variableName] === void 0) {
          return;
        }
        const variableValue = variables[variableName];
        if (variableValue === null && (0, _definition.isNonNullType)(type)) {
          return;
        }
        return variableValue;
      }
      if ((0, _definition.isNonNullType)(type)) {
        if (valueNode.kind === _kinds.Kind.NULL) {
          return;
        }
        return valueFromAST(valueNode, type.ofType, variables);
      }
      if (valueNode.kind === _kinds.Kind.NULL) {
        return null;
      }
      if ((0, _definition.isListType)(type)) {
        const itemType = type.ofType;
        if (valueNode.kind === _kinds.Kind.LIST) {
          const coercedValues = [];
          for (const itemNode of valueNode.values) {
            if (isMissingVariable(itemNode, variables)) {
              if ((0, _definition.isNonNullType)(itemType)) {
                return;
              }
              coercedValues.push(null);
            } else {
              const itemValue = valueFromAST(itemNode, itemType, variables);
              if (itemValue === void 0) {
                return;
              }
              coercedValues.push(itemValue);
            }
          }
          return coercedValues;
        }
        const coercedValue = valueFromAST(valueNode, itemType, variables);
        if (coercedValue === void 0) {
          return;
        }
        return [coercedValue];
      }
      if ((0, _definition.isInputObjectType)(type)) {
        if (valueNode.kind !== _kinds.Kind.OBJECT) {
          return;
        }
        const coercedObj = /* @__PURE__ */ Object.create(null);
        const fieldNodes = (0, _keyMap.keyMap)(
          valueNode.fields,
          (field) => field.name.value
        );
        for (const field of Object.values(type.getFields())) {
          const fieldNode = fieldNodes[field.name];
          if (!fieldNode || isMissingVariable(fieldNode.value, variables)) {
            if (field.defaultValue !== void 0) {
              coercedObj[field.name] = field.defaultValue;
            } else if ((0, _definition.isNonNullType)(field.type)) {
              return;
            }
            continue;
          }
          const fieldValue = valueFromAST(fieldNode.value, field.type, variables);
          if (fieldValue === void 0) {
            return;
          }
          coercedObj[field.name] = fieldValue;
        }
        if (type.isOneOf) {
          const keys = Object.keys(coercedObj);
          if (keys.length !== 1) {
            return;
          }
          if (coercedObj[keys[0]] === null) {
            return;
          }
        }
        return coercedObj;
      }
      if ((0, _definition.isLeafType)(type)) {
        let result;
        try {
          result = type.parseLiteral(valueNode, variables);
        } catch (_error) {
          return;
        }
        if (result === void 0) {
          return;
        }
        return result;
      }
      (0, _invariant.invariant)(
        false,
        "Unexpected input type: " + (0, _inspect.inspect)(type)
      );
    }
    function isMissingVariable(valueNode, variables) {
      return valueNode.kind === _kinds.Kind.VARIABLE && (variables == null || variables[valueNode.name.value] === void 0);
    }
  }
});

// node_modules/graphql/execution/values.js
var require_values = __commonJS({
  "node_modules/graphql/execution/values.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.getArgumentValues = getArgumentValues;
    exports2.getDirectiveValues = getDirectiveValues;
    exports2.getVariableValues = getVariableValues;
    var _inspect = require_inspect();
    var _keyMap = require_keyMap();
    var _printPathArray = require_printPathArray();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var _coerceInputValue = require_coerceInputValue();
    var _typeFromAST = require_typeFromAST();
    var _valueFromAST = require_valueFromAST();
    function getVariableValues(schema, varDefNodes, inputs, options) {
      const errors = [];
      const maxErrors = options === null || options === void 0 ? void 0 : options.maxErrors;
      try {
        const coerced = coerceVariableValues(
          schema,
          varDefNodes,
          inputs,
          (error) => {
            if (maxErrors != null && errors.length >= maxErrors) {
              throw new _GraphQLError.GraphQLError(
                "Too many errors processing variables, error limit reached. Execution aborted."
              );
            }
            errors.push(error);
          }
        );
        if (errors.length === 0) {
          return {
            coerced
          };
        }
      } catch (error) {
        errors.push(error);
      }
      return {
        errors
      };
    }
    function coerceVariableValues(schema, varDefNodes, inputs, onError) {
      const coercedValues = {};
      for (const varDefNode of varDefNodes) {
        const varName = varDefNode.variable.name.value;
        const varType = (0, _typeFromAST.typeFromAST)(schema, varDefNode.type);
        if (!(0, _definition.isInputType)(varType)) {
          const varTypeStr = (0, _printer.print)(varDefNode.type);
          onError(
            new _GraphQLError.GraphQLError(
              `Variable "$${varName}" expected value of type "${varTypeStr}" which cannot be used as an input type.`,
              {
                nodes: varDefNode.type
              }
            )
          );
          continue;
        }
        if (!hasOwnProperty(inputs, varName)) {
          if (varDefNode.defaultValue) {
            coercedValues[varName] = (0, _valueFromAST.valueFromAST)(
              varDefNode.defaultValue,
              varType
            );
          } else if ((0, _definition.isNonNullType)(varType)) {
            const varTypeStr = (0, _inspect.inspect)(varType);
            onError(
              new _GraphQLError.GraphQLError(
                `Variable "$${varName}" of required type "${varTypeStr}" was not provided.`,
                {
                  nodes: varDefNode
                }
              )
            );
          }
          continue;
        }
        const value = inputs[varName];
        if (value === null && (0, _definition.isNonNullType)(varType)) {
          const varTypeStr = (0, _inspect.inspect)(varType);
          onError(
            new _GraphQLError.GraphQLError(
              `Variable "$${varName}" of non-null type "${varTypeStr}" must not be null.`,
              {
                nodes: varDefNode
              }
            )
          );
          continue;
        }
        coercedValues[varName] = (0, _coerceInputValue.coerceInputValue)(
          value,
          varType,
          (path2, invalidValue, error) => {
            let prefix = `Variable "$${varName}" got invalid value ` + (0, _inspect.inspect)(invalidValue);
            if (path2.length > 0) {
              prefix += ` at "${varName}${(0, _printPathArray.printPathArray)(
                path2
              )}"`;
            }
            onError(
              new _GraphQLError.GraphQLError(prefix + "; " + error.message, {
                nodes: varDefNode,
                originalError: error
              })
            );
          }
        );
      }
      return coercedValues;
    }
    function getArgumentValues(def, node, variableValues) {
      var _node$arguments;
      const coercedValues = {};
      const argumentNodes = (_node$arguments = node.arguments) !== null && _node$arguments !== void 0 ? _node$arguments : [];
      const argNodeMap = (0, _keyMap.keyMap)(
        argumentNodes,
        (arg) => arg.name.value
      );
      for (const argDef of def.args) {
        const name = argDef.name;
        const argType = argDef.type;
        const argumentNode = argNodeMap[name];
        if (!argumentNode) {
          if (argDef.defaultValue !== void 0) {
            coercedValues[name] = argDef.defaultValue;
          } else if ((0, _definition.isNonNullType)(argType)) {
            throw new _GraphQLError.GraphQLError(
              `Argument "${name}" of required type "${(0, _inspect.inspect)(
                argType
              )}" was not provided.`,
              {
                nodes: node
              }
            );
          }
          continue;
        }
        const valueNode = argumentNode.value;
        let isNull = valueNode.kind === _kinds.Kind.NULL;
        if (valueNode.kind === _kinds.Kind.VARIABLE) {
          const variableName = valueNode.name.value;
          if (variableValues == null || !hasOwnProperty(variableValues, variableName)) {
            if (argDef.defaultValue !== void 0) {
              coercedValues[name] = argDef.defaultValue;
            } else if ((0, _definition.isNonNullType)(argType)) {
              throw new _GraphQLError.GraphQLError(
                `Argument "${name}" of required type "${(0, _inspect.inspect)(
                  argType
                )}" was provided the variable "$${variableName}" which was not provided a runtime value.`,
                {
                  nodes: valueNode
                }
              );
            }
            continue;
          }
          isNull = variableValues[variableName] == null;
        }
        if (isNull && (0, _definition.isNonNullType)(argType)) {
          throw new _GraphQLError.GraphQLError(
            `Argument "${name}" of non-null type "${(0, _inspect.inspect)(
              argType
            )}" must not be null.`,
            {
              nodes: valueNode
            }
          );
        }
        const coercedValue = (0, _valueFromAST.valueFromAST)(
          valueNode,
          argType,
          variableValues
        );
        if (coercedValue === void 0) {
          throw new _GraphQLError.GraphQLError(
            `Argument "${name}" has invalid value ${(0, _printer.print)(
              valueNode
            )}.`,
            {
              nodes: valueNode
            }
          );
        }
        coercedValues[name] = coercedValue;
      }
      return coercedValues;
    }
    function getDirectiveValues(directiveDef, node, variableValues) {
      var _node$directives;
      const directiveNode = (_node$directives = node.directives) === null || _node$directives === void 0 ? void 0 : _node$directives.find(
        (directive) => directive.name.value === directiveDef.name
      );
      if (directiveNode) {
        return getArgumentValues(directiveDef, directiveNode, variableValues);
      }
    }
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }
  }
});

// node_modules/graphql/execution/collectFields.js
var require_collectFields = __commonJS({
  "node_modules/graphql/execution/collectFields.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.collectFields = collectFields;
    exports2.collectSubfields = collectSubfields;
    var _kinds = require_kinds();
    var _definition = require_definition();
    var _directives = require_directives();
    var _typeFromAST = require_typeFromAST();
    var _values = require_values();
    function collectFields(schema, fragments, variableValues, runtimeType, selectionSet) {
      const fields = /* @__PURE__ */ new Map();
      collectFieldsImpl(
        schema,
        fragments,
        variableValues,
        runtimeType,
        selectionSet,
        fields,
        /* @__PURE__ */ new Set()
      );
      return fields;
    }
    function collectSubfields(schema, fragments, variableValues, returnType, fieldNodes) {
      const subFieldNodes = /* @__PURE__ */ new Map();
      const visitedFragmentNames = /* @__PURE__ */ new Set();
      for (const node of fieldNodes) {
        if (node.selectionSet) {
          collectFieldsImpl(
            schema,
            fragments,
            variableValues,
            returnType,
            node.selectionSet,
            subFieldNodes,
            visitedFragmentNames
          );
        }
      }
      return subFieldNodes;
    }
    function collectFieldsImpl(schema, fragments, variableValues, runtimeType, selectionSet, fields, visitedFragmentNames) {
      for (const selection of selectionSet.selections) {
        switch (selection.kind) {
          case _kinds.Kind.FIELD: {
            if (!shouldIncludeNode(variableValues, selection)) {
              continue;
            }
            const name = getFieldEntryKey(selection);
            const fieldList = fields.get(name);
            if (fieldList !== void 0) {
              fieldList.push(selection);
            } else {
              fields.set(name, [selection]);
            }
            break;
          }
          case _kinds.Kind.INLINE_FRAGMENT: {
            if (!shouldIncludeNode(variableValues, selection) || !doesFragmentConditionMatch(schema, selection, runtimeType)) {
              continue;
            }
            collectFieldsImpl(
              schema,
              fragments,
              variableValues,
              runtimeType,
              selection.selectionSet,
              fields,
              visitedFragmentNames
            );
            break;
          }
          case _kinds.Kind.FRAGMENT_SPREAD: {
            const fragName = selection.name.value;
            if (visitedFragmentNames.has(fragName) || !shouldIncludeNode(variableValues, selection)) {
              continue;
            }
            visitedFragmentNames.add(fragName);
            const fragment = fragments[fragName];
            if (!fragment || !doesFragmentConditionMatch(schema, fragment, runtimeType)) {
              continue;
            }
            collectFieldsImpl(
              schema,
              fragments,
              variableValues,
              runtimeType,
              fragment.selectionSet,
              fields,
              visitedFragmentNames
            );
            break;
          }
        }
      }
    }
    function shouldIncludeNode(variableValues, node) {
      const skip = (0, _values.getDirectiveValues)(
        _directives.GraphQLSkipDirective,
        node,
        variableValues
      );
      if ((skip === null || skip === void 0 ? void 0 : skip.if) === true) {
        return false;
      }
      const include = (0, _values.getDirectiveValues)(
        _directives.GraphQLIncludeDirective,
        node,
        variableValues
      );
      if ((include === null || include === void 0 ? void 0 : include.if) === false) {
        return false;
      }
      return true;
    }
    function doesFragmentConditionMatch(schema, fragment, type) {
      const typeConditionNode = fragment.typeCondition;
      if (!typeConditionNode) {
        return true;
      }
      const conditionalType = (0, _typeFromAST.typeFromAST)(
        schema,
        typeConditionNode
      );
      if (conditionalType === type) {
        return true;
      }
      if ((0, _definition.isAbstractType)(conditionalType)) {
        return schema.isSubType(conditionalType, type);
      }
      return false;
    }
    function getFieldEntryKey(node) {
      return node.alias ? node.alias.value : node.name.value;
    }
  }
});

// node_modules/graphql/validation/rules/SingleFieldSubscriptionsRule.js
var require_SingleFieldSubscriptionsRule = __commonJS({
  "node_modules/graphql/validation/rules/SingleFieldSubscriptionsRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.SingleFieldSubscriptionsRule = SingleFieldSubscriptionsRule;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _collectFields = require_collectFields();
    function SingleFieldSubscriptionsRule(context) {
      return {
        OperationDefinition(node) {
          if (node.operation === "subscription") {
            const schema = context.getSchema();
            const subscriptionType = schema.getSubscriptionType();
            if (subscriptionType) {
              const operationName = node.name ? node.name.value : null;
              const variableValues = /* @__PURE__ */ Object.create(null);
              const document = context.getDocument();
              const fragments = /* @__PURE__ */ Object.create(null);
              for (const definition of document.definitions) {
                if (definition.kind === _kinds.Kind.FRAGMENT_DEFINITION) {
                  fragments[definition.name.value] = definition;
                }
              }
              const fields = (0, _collectFields.collectFields)(
                schema,
                fragments,
                variableValues,
                subscriptionType,
                node.selectionSet
              );
              if (fields.size > 1) {
                const fieldSelectionLists = [...fields.values()];
                const extraFieldSelectionLists = fieldSelectionLists.slice(1);
                const extraFieldSelections = extraFieldSelectionLists.flat();
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    operationName != null ? `Subscription "${operationName}" must select only one top level field.` : "Anonymous Subscription must select only one top level field.",
                    {
                      nodes: extraFieldSelections
                    }
                  )
                );
              }
              for (const fieldNodes of fields.values()) {
                const field = fieldNodes[0];
                const fieldName = field.name.value;
                if (fieldName.startsWith("__")) {
                  context.reportError(
                    new _GraphQLError.GraphQLError(
                      operationName != null ? `Subscription "${operationName}" must not select an introspection top level field.` : "Anonymous Subscription must not select an introspection top level field.",
                      {
                        nodes: fieldNodes
                      }
                    )
                  );
                }
              }
            }
          }
        }
      };
    }
  }
});

// node_modules/graphql/jsutils/groupBy.js
var require_groupBy = __commonJS({
  "node_modules/graphql/jsutils/groupBy.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.groupBy = groupBy;
    function groupBy(list, keyFn) {
      const result = /* @__PURE__ */ new Map();
      for (const item of list) {
        const key = keyFn(item);
        const group = result.get(key);
        if (group === void 0) {
          result.set(key, [item]);
        } else {
          group.push(item);
        }
      }
      return result;
    }
  }
});

// node_modules/graphql/validation/rules/UniqueArgumentDefinitionNamesRule.js
var require_UniqueArgumentDefinitionNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueArgumentDefinitionNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueArgumentDefinitionNamesRule = UniqueArgumentDefinitionNamesRule;
    var _groupBy = require_groupBy();
    var _GraphQLError = require_GraphQLError();
    function UniqueArgumentDefinitionNamesRule(context) {
      return {
        DirectiveDefinition(directiveNode) {
          var _directiveNode$argume;
          const argumentNodes = (_directiveNode$argume = directiveNode.arguments) !== null && _directiveNode$argume !== void 0 ? _directiveNode$argume : [];
          return checkArgUniqueness(`@${directiveNode.name.value}`, argumentNodes);
        },
        InterfaceTypeDefinition: checkArgUniquenessPerField,
        InterfaceTypeExtension: checkArgUniquenessPerField,
        ObjectTypeDefinition: checkArgUniquenessPerField,
        ObjectTypeExtension: checkArgUniquenessPerField
      };
      function checkArgUniquenessPerField(typeNode) {
        var _typeNode$fields;
        const typeName = typeNode.name.value;
        const fieldNodes = (_typeNode$fields = typeNode.fields) !== null && _typeNode$fields !== void 0 ? _typeNode$fields : [];
        for (const fieldDef of fieldNodes) {
          var _fieldDef$arguments;
          const fieldName = fieldDef.name.value;
          const argumentNodes = (_fieldDef$arguments = fieldDef.arguments) !== null && _fieldDef$arguments !== void 0 ? _fieldDef$arguments : [];
          checkArgUniqueness(`${typeName}.${fieldName}`, argumentNodes);
        }
        return false;
      }
      function checkArgUniqueness(parentName, argumentNodes) {
        const seenArgs = (0, _groupBy.groupBy)(
          argumentNodes,
          (arg) => arg.name.value
        );
        for (const [argName, argNodes] of seenArgs) {
          if (argNodes.length > 1) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Argument "${parentName}(${argName}:)" can only be defined once.`,
                {
                  nodes: argNodes.map((node) => node.name)
                }
              )
            );
          }
        }
        return false;
      }
    }
  }
});

// node_modules/graphql/validation/rules/UniqueArgumentNamesRule.js
var require_UniqueArgumentNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueArgumentNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueArgumentNamesRule = UniqueArgumentNamesRule;
    var _groupBy = require_groupBy();
    var _GraphQLError = require_GraphQLError();
    function UniqueArgumentNamesRule(context) {
      return {
        Field: checkArgUniqueness,
        Directive: checkArgUniqueness
      };
      function checkArgUniqueness(parentNode) {
        var _parentNode$arguments;
        const argumentNodes = (_parentNode$arguments = parentNode.arguments) !== null && _parentNode$arguments !== void 0 ? _parentNode$arguments : [];
        const seenArgs = (0, _groupBy.groupBy)(
          argumentNodes,
          (arg) => arg.name.value
        );
        for (const [argName, argNodes] of seenArgs) {
          if (argNodes.length > 1) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `There can be only one argument named "${argName}".`,
                {
                  nodes: argNodes.map((node) => node.name)
                }
              )
            );
          }
        }
      }
    }
  }
});

// node_modules/graphql/validation/rules/UniqueDirectiveNamesRule.js
var require_UniqueDirectiveNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueDirectiveNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueDirectiveNamesRule = UniqueDirectiveNamesRule;
    var _GraphQLError = require_GraphQLError();
    function UniqueDirectiveNamesRule(context) {
      const knownDirectiveNames = /* @__PURE__ */ Object.create(null);
      const schema = context.getSchema();
      return {
        DirectiveDefinition(node) {
          const directiveName = node.name.value;
          if (schema !== null && schema !== void 0 && schema.getDirective(directiveName)) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
                {
                  nodes: node.name
                }
              )
            );
            return;
          }
          if (knownDirectiveNames[directiveName]) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `There can be only one directive named "@${directiveName}".`,
                {
                  nodes: [knownDirectiveNames[directiveName], node.name]
                }
              )
            );
          } else {
            knownDirectiveNames[directiveName] = node.name;
          }
          return false;
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/UniqueDirectivesPerLocationRule.js
var require_UniqueDirectivesPerLocationRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueDirectivesPerLocationRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueDirectivesPerLocationRule = UniqueDirectivesPerLocationRule;
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    var _directives = require_directives();
    function UniqueDirectivesPerLocationRule(context) {
      const uniqueDirectiveMap = /* @__PURE__ */ Object.create(null);
      const schema = context.getSchema();
      const definedDirectives = schema ? schema.getDirectives() : _directives.specifiedDirectives;
      for (const directive of definedDirectives) {
        uniqueDirectiveMap[directive.name] = !directive.isRepeatable;
      }
      const astDefinitions = context.getDocument().definitions;
      for (const def of astDefinitions) {
        if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          uniqueDirectiveMap[def.name.value] = !def.repeatable;
        }
      }
      const schemaDirectives = /* @__PURE__ */ Object.create(null);
      const typeDirectivesMap = /* @__PURE__ */ Object.create(null);
      return {
        // Many different AST nodes may contain directives. Rather than listing
        // them all, just listen for entering any node, and check to see if it
        // defines any directives.
        enter(node) {
          if (!("directives" in node) || !node.directives) {
            return;
          }
          let seenDirectives;
          if (node.kind === _kinds.Kind.SCHEMA_DEFINITION || node.kind === _kinds.Kind.SCHEMA_EXTENSION) {
            seenDirectives = schemaDirectives;
          } else if ((0, _predicates.isTypeDefinitionNode)(node) || (0, _predicates.isTypeExtensionNode)(node)) {
            const typeName = node.name.value;
            seenDirectives = typeDirectivesMap[typeName];
            if (seenDirectives === void 0) {
              typeDirectivesMap[typeName] = seenDirectives = /* @__PURE__ */ Object.create(null);
            }
          } else {
            seenDirectives = /* @__PURE__ */ Object.create(null);
          }
          for (const directive of node.directives) {
            const directiveName = directive.name.value;
            if (uniqueDirectiveMap[directiveName]) {
              if (seenDirectives[directiveName]) {
                context.reportError(
                  new _GraphQLError.GraphQLError(
                    `The directive "@${directiveName}" can only be used once at this location.`,
                    {
                      nodes: [seenDirectives[directiveName], directive]
                    }
                  )
                );
              } else {
                seenDirectives[directiveName] = directive;
              }
            }
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/UniqueEnumValueNamesRule.js
var require_UniqueEnumValueNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueEnumValueNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueEnumValueNamesRule = UniqueEnumValueNamesRule;
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function UniqueEnumValueNamesRule(context) {
      const schema = context.getSchema();
      const existingTypeMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
      const knownValueNames = /* @__PURE__ */ Object.create(null);
      return {
        EnumTypeDefinition: checkValueUniqueness,
        EnumTypeExtension: checkValueUniqueness
      };
      function checkValueUniqueness(node) {
        var _node$values;
        const typeName = node.name.value;
        if (!knownValueNames[typeName]) {
          knownValueNames[typeName] = /* @__PURE__ */ Object.create(null);
        }
        const valueNodes = (_node$values = node.values) !== null && _node$values !== void 0 ? _node$values : [];
        const valueNames = knownValueNames[typeName];
        for (const valueDef of valueNodes) {
          const valueName = valueDef.name.value;
          const existingType = existingTypeMap[typeName];
          if ((0, _definition.isEnumType)(existingType) && existingType.getValue(valueName)) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Enum value "${typeName}.${valueName}" already exists in the schema. It cannot also be defined in this type extension.`,
                {
                  nodes: valueDef.name
                }
              )
            );
          } else if (valueNames[valueName]) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Enum value "${typeName}.${valueName}" can only be defined once.`,
                {
                  nodes: [valueNames[valueName], valueDef.name]
                }
              )
            );
          } else {
            valueNames[valueName] = valueDef.name;
          }
        }
        return false;
      }
    }
  }
});

// node_modules/graphql/validation/rules/UniqueFieldDefinitionNamesRule.js
var require_UniqueFieldDefinitionNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueFieldDefinitionNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueFieldDefinitionNamesRule = UniqueFieldDefinitionNamesRule;
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function UniqueFieldDefinitionNamesRule(context) {
      const schema = context.getSchema();
      const existingTypeMap = schema ? schema.getTypeMap() : /* @__PURE__ */ Object.create(null);
      const knownFieldNames = /* @__PURE__ */ Object.create(null);
      return {
        InputObjectTypeDefinition: checkFieldUniqueness,
        InputObjectTypeExtension: checkFieldUniqueness,
        InterfaceTypeDefinition: checkFieldUniqueness,
        InterfaceTypeExtension: checkFieldUniqueness,
        ObjectTypeDefinition: checkFieldUniqueness,
        ObjectTypeExtension: checkFieldUniqueness
      };
      function checkFieldUniqueness(node) {
        var _node$fields;
        const typeName = node.name.value;
        if (!knownFieldNames[typeName]) {
          knownFieldNames[typeName] = /* @__PURE__ */ Object.create(null);
        }
        const fieldNodes = (_node$fields = node.fields) !== null && _node$fields !== void 0 ? _node$fields : [];
        const fieldNames = knownFieldNames[typeName];
        for (const fieldDef of fieldNodes) {
          const fieldName = fieldDef.name.value;
          if (hasField(existingTypeMap[typeName], fieldName)) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
                {
                  nodes: fieldDef.name
                }
              )
            );
          } else if (fieldNames[fieldName]) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Field "${typeName}.${fieldName}" can only be defined once.`,
                {
                  nodes: [fieldNames[fieldName], fieldDef.name]
                }
              )
            );
          } else {
            fieldNames[fieldName] = fieldDef.name;
          }
        }
        return false;
      }
    }
    function hasField(type, fieldName) {
      if ((0, _definition.isObjectType)(type) || (0, _definition.isInterfaceType)(type) || (0, _definition.isInputObjectType)(type)) {
        return type.getFields()[fieldName] != null;
      }
      return false;
    }
  }
});

// node_modules/graphql/validation/rules/UniqueFragmentNamesRule.js
var require_UniqueFragmentNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueFragmentNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueFragmentNamesRule = UniqueFragmentNamesRule;
    var _GraphQLError = require_GraphQLError();
    function UniqueFragmentNamesRule(context) {
      const knownFragmentNames = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: () => false,
        FragmentDefinition(node) {
          const fragmentName = node.name.value;
          if (knownFragmentNames[fragmentName]) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `There can be only one fragment named "${fragmentName}".`,
                {
                  nodes: [knownFragmentNames[fragmentName], node.name]
                }
              )
            );
          } else {
            knownFragmentNames[fragmentName] = node.name;
          }
          return false;
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/UniqueInputFieldNamesRule.js
var require_UniqueInputFieldNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueInputFieldNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueInputFieldNamesRule = UniqueInputFieldNamesRule;
    var _invariant = require_invariant();
    var _GraphQLError = require_GraphQLError();
    function UniqueInputFieldNamesRule(context) {
      const knownNameStack = [];
      let knownNames = /* @__PURE__ */ Object.create(null);
      return {
        ObjectValue: {
          enter() {
            knownNameStack.push(knownNames);
            knownNames = /* @__PURE__ */ Object.create(null);
          },
          leave() {
            const prevKnownNames = knownNameStack.pop();
            prevKnownNames || (0, _invariant.invariant)(false);
            knownNames = prevKnownNames;
          }
        },
        ObjectField(node) {
          const fieldName = node.name.value;
          if (knownNames[fieldName]) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `There can be only one input field named "${fieldName}".`,
                {
                  nodes: [knownNames[fieldName], node.name]
                }
              )
            );
          } else {
            knownNames[fieldName] = node.name;
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/UniqueOperationNamesRule.js
var require_UniqueOperationNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueOperationNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueOperationNamesRule = UniqueOperationNamesRule;
    var _GraphQLError = require_GraphQLError();
    function UniqueOperationNamesRule(context) {
      const knownOperationNames = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition(node) {
          const operationName = node.name;
          if (operationName) {
            if (knownOperationNames[operationName.value]) {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `There can be only one operation named "${operationName.value}".`,
                  {
                    nodes: [
                      knownOperationNames[operationName.value],
                      operationName
                    ]
                  }
                )
              );
            } else {
              knownOperationNames[operationName.value] = operationName;
            }
          }
          return false;
        },
        FragmentDefinition: () => false
      };
    }
  }
});

// node_modules/graphql/validation/rules/UniqueOperationTypesRule.js
var require_UniqueOperationTypesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueOperationTypesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueOperationTypesRule = UniqueOperationTypesRule;
    var _GraphQLError = require_GraphQLError();
    function UniqueOperationTypesRule(context) {
      const schema = context.getSchema();
      const definedOperationTypes = /* @__PURE__ */ Object.create(null);
      const existingOperationTypes = schema ? {
        query: schema.getQueryType(),
        mutation: schema.getMutationType(),
        subscription: schema.getSubscriptionType()
      } : {};
      return {
        SchemaDefinition: checkOperationTypes,
        SchemaExtension: checkOperationTypes
      };
      function checkOperationTypes(node) {
        var _node$operationTypes;
        const operationTypesNodes = (_node$operationTypes = node.operationTypes) !== null && _node$operationTypes !== void 0 ? _node$operationTypes : [];
        for (const operationType of operationTypesNodes) {
          const operation = operationType.operation;
          const alreadyDefinedOperationType = definedOperationTypes[operation];
          if (existingOperationTypes[operation]) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Type for ${operation} already defined in the schema. It cannot be redefined.`,
                {
                  nodes: operationType
                }
              )
            );
          } else if (alreadyDefinedOperationType) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `There can be only one ${operation} type in schema.`,
                {
                  nodes: [alreadyDefinedOperationType, operationType]
                }
              )
            );
          } else {
            definedOperationTypes[operation] = operationType;
          }
        }
        return false;
      }
    }
  }
});

// node_modules/graphql/validation/rules/UniqueTypeNamesRule.js
var require_UniqueTypeNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueTypeNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueTypeNamesRule = UniqueTypeNamesRule;
    var _GraphQLError = require_GraphQLError();
    function UniqueTypeNamesRule(context) {
      const knownTypeNames = /* @__PURE__ */ Object.create(null);
      const schema = context.getSchema();
      return {
        ScalarTypeDefinition: checkTypeName,
        ObjectTypeDefinition: checkTypeName,
        InterfaceTypeDefinition: checkTypeName,
        UnionTypeDefinition: checkTypeName,
        EnumTypeDefinition: checkTypeName,
        InputObjectTypeDefinition: checkTypeName
      };
      function checkTypeName(node) {
        const typeName = node.name.value;
        if (schema !== null && schema !== void 0 && schema.getType(typeName)) {
          context.reportError(
            new _GraphQLError.GraphQLError(
              `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`,
              {
                nodes: node.name
              }
            )
          );
          return;
        }
        if (knownTypeNames[typeName]) {
          context.reportError(
            new _GraphQLError.GraphQLError(
              `There can be only one type named "${typeName}".`,
              {
                nodes: [knownTypeNames[typeName], node.name]
              }
            )
          );
        } else {
          knownTypeNames[typeName] = node.name;
        }
        return false;
      }
    }
  }
});

// node_modules/graphql/validation/rules/UniqueVariableNamesRule.js
var require_UniqueVariableNamesRule = __commonJS({
  "node_modules/graphql/validation/rules/UniqueVariableNamesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.UniqueVariableNamesRule = UniqueVariableNamesRule;
    var _groupBy = require_groupBy();
    var _GraphQLError = require_GraphQLError();
    function UniqueVariableNamesRule(context) {
      return {
        OperationDefinition(operationNode) {
          var _operationNode$variab;
          const variableDefinitions = (_operationNode$variab = operationNode.variableDefinitions) !== null && _operationNode$variab !== void 0 ? _operationNode$variab : [];
          const seenVariableDefinitions = (0, _groupBy.groupBy)(
            variableDefinitions,
            (node) => node.variable.name.value
          );
          for (const [variableName, variableNodes] of seenVariableDefinitions) {
            if (variableNodes.length > 1) {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `There can be only one variable named "$${variableName}".`,
                  {
                    nodes: variableNodes.map((node) => node.variable.name)
                  }
                )
              );
            }
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/ValuesOfCorrectTypeRule.js
var require_ValuesOfCorrectTypeRule = __commonJS({
  "node_modules/graphql/validation/rules/ValuesOfCorrectTypeRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.ValuesOfCorrectTypeRule = ValuesOfCorrectTypeRule;
    var _didYouMean = require_didYouMean();
    var _inspect = require_inspect();
    var _keyMap = require_keyMap();
    var _suggestionList = require_suggestionList();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    function ValuesOfCorrectTypeRule(context) {
      let variableDefinitions = {};
      return {
        OperationDefinition: {
          enter() {
            variableDefinitions = {};
          }
        },
        VariableDefinition(definition) {
          variableDefinitions[definition.variable.name.value] = definition;
        },
        ListValue(node) {
          const type = (0, _definition.getNullableType)(
            context.getParentInputType()
          );
          if (!(0, _definition.isListType)(type)) {
            isValidValueNode(context, node);
            return false;
          }
        },
        ObjectValue(node) {
          const type = (0, _definition.getNamedType)(context.getInputType());
          if (!(0, _definition.isInputObjectType)(type)) {
            isValidValueNode(context, node);
            return false;
          }
          const fieldNodeMap = (0, _keyMap.keyMap)(
            node.fields,
            (field) => field.name.value
          );
          for (const fieldDef of Object.values(type.getFields())) {
            const fieldNode = fieldNodeMap[fieldDef.name];
            if (!fieldNode && (0, _definition.isRequiredInputField)(fieldDef)) {
              const typeStr = (0, _inspect.inspect)(fieldDef.type);
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Field "${type.name}.${fieldDef.name}" of required type "${typeStr}" was not provided.`,
                  {
                    nodes: node
                  }
                )
              );
            }
          }
          if (type.isOneOf) {
            validateOneOfInputObject(
              context,
              node,
              type,
              fieldNodeMap,
              variableDefinitions
            );
          }
        },
        ObjectField(node) {
          const parentType = (0, _definition.getNamedType)(
            context.getParentInputType()
          );
          const fieldType = context.getInputType();
          if (!fieldType && (0, _definition.isInputObjectType)(parentType)) {
            const suggestions = (0, _suggestionList.suggestionList)(
              node.name.value,
              Object.keys(parentType.getFields())
            );
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Field "${node.name.value}" is not defined by type "${parentType.name}".` + (0, _didYouMean.didYouMean)(suggestions),
                {
                  nodes: node
                }
              )
            );
          }
        },
        NullValue(node) {
          const type = context.getInputType();
          if ((0, _definition.isNonNullType)(type)) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Expected value of type "${(0, _inspect.inspect)(
                  type
                )}", found ${(0, _printer.print)(node)}.`,
                {
                  nodes: node
                }
              )
            );
          }
        },
        EnumValue: (node) => isValidValueNode(context, node),
        IntValue: (node) => isValidValueNode(context, node),
        FloatValue: (node) => isValidValueNode(context, node),
        StringValue: (node) => isValidValueNode(context, node),
        BooleanValue: (node) => isValidValueNode(context, node)
      };
    }
    function isValidValueNode(context, node) {
      const locationType = context.getInputType();
      if (!locationType) {
        return;
      }
      const type = (0, _definition.getNamedType)(locationType);
      if (!(0, _definition.isLeafType)(type)) {
        const typeStr = (0, _inspect.inspect)(locationType);
        context.reportError(
          new _GraphQLError.GraphQLError(
            `Expected value of type "${typeStr}", found ${(0, _printer.print)(
              node
            )}.`,
            {
              nodes: node
            }
          )
        );
        return;
      }
      try {
        const parseResult = type.parseLiteral(
          node,
          void 0
          /* variables */
        );
        if (parseResult === void 0) {
          const typeStr = (0, _inspect.inspect)(locationType);
          context.reportError(
            new _GraphQLError.GraphQLError(
              `Expected value of type "${typeStr}", found ${(0, _printer.print)(
                node
              )}.`,
              {
                nodes: node
              }
            )
          );
        }
      } catch (error) {
        const typeStr = (0, _inspect.inspect)(locationType);
        if (error instanceof _GraphQLError.GraphQLError) {
          context.reportError(error);
        } else {
          context.reportError(
            new _GraphQLError.GraphQLError(
              `Expected value of type "${typeStr}", found ${(0, _printer.print)(
                node
              )}; ` + error.message,
              {
                nodes: node,
                originalError: error
              }
            )
          );
        }
      }
    }
    function validateOneOfInputObject(context, node, type, fieldNodeMap, variableDefinitions) {
      var _fieldNodeMap$keys$;
      const keys = Object.keys(fieldNodeMap);
      const isNotExactlyOneField = keys.length !== 1;
      if (isNotExactlyOneField) {
        context.reportError(
          new _GraphQLError.GraphQLError(
            `OneOf Input Object "${type.name}" must specify exactly one key.`,
            {
              nodes: [node]
            }
          )
        );
        return;
      }
      const value = (_fieldNodeMap$keys$ = fieldNodeMap[keys[0]]) === null || _fieldNodeMap$keys$ === void 0 ? void 0 : _fieldNodeMap$keys$.value;
      const isNullLiteral = !value || value.kind === _kinds.Kind.NULL;
      const isVariable = (value === null || value === void 0 ? void 0 : value.kind) === _kinds.Kind.VARIABLE;
      if (isNullLiteral) {
        context.reportError(
          new _GraphQLError.GraphQLError(
            `Field "${type.name}.${keys[0]}" must be non-null.`,
            {
              nodes: [node]
            }
          )
        );
        return;
      }
      if (isVariable) {
        const variableName = value.name.value;
        const definition = variableDefinitions[variableName];
        const isNullableVariable = definition.type.kind !== _kinds.Kind.NON_NULL_TYPE;
        if (isNullableVariable) {
          context.reportError(
            new _GraphQLError.GraphQLError(
              `Variable "${variableName}" must be non-nullable to be used for OneOf Input Object "${type.name}".`,
              {
                nodes: [node]
              }
            )
          );
        }
      }
    }
  }
});

// node_modules/graphql/validation/rules/VariablesAreInputTypesRule.js
var require_VariablesAreInputTypesRule = __commonJS({
  "node_modules/graphql/validation/rules/VariablesAreInputTypesRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.VariablesAreInputTypesRule = VariablesAreInputTypesRule;
    var _GraphQLError = require_GraphQLError();
    var _printer = require_printer();
    var _definition = require_definition();
    var _typeFromAST = require_typeFromAST();
    function VariablesAreInputTypesRule(context) {
      return {
        VariableDefinition(node) {
          const type = (0, _typeFromAST.typeFromAST)(
            context.getSchema(),
            node.type
          );
          if (type !== void 0 && !(0, _definition.isInputType)(type)) {
            const variableName = node.variable.name.value;
            const typeName = (0, _printer.print)(node.type);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `Variable "$${variableName}" cannot be non-input type "${typeName}".`,
                {
                  nodes: node.type
                }
              )
            );
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/VariablesInAllowedPositionRule.js
var require_VariablesInAllowedPositionRule = __commonJS({
  "node_modules/graphql/validation/rules/VariablesInAllowedPositionRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.VariablesInAllowedPositionRule = VariablesInAllowedPositionRule;
    var _inspect = require_inspect();
    var _GraphQLError = require_GraphQLError();
    var _kinds = require_kinds();
    var _definition = require_definition();
    var _typeComparators = require_typeComparators();
    var _typeFromAST = require_typeFromAST();
    function VariablesInAllowedPositionRule(context) {
      let varDefMap = /* @__PURE__ */ Object.create(null);
      return {
        OperationDefinition: {
          enter() {
            varDefMap = /* @__PURE__ */ Object.create(null);
          },
          leave(operation) {
            const usages = context.getRecursiveVariableUsages(operation);
            for (const { node, type, defaultValue } of usages) {
              const varName = node.name.value;
              const varDef = varDefMap[varName];
              if (varDef && type) {
                const schema = context.getSchema();
                const varType = (0, _typeFromAST.typeFromAST)(schema, varDef.type);
                if (varType && !allowedVariableUsage(
                  schema,
                  varType,
                  varDef.defaultValue,
                  type,
                  defaultValue
                )) {
                  const varTypeStr = (0, _inspect.inspect)(varType);
                  const typeStr = (0, _inspect.inspect)(type);
                  context.reportError(
                    new _GraphQLError.GraphQLError(
                      `Variable "$${varName}" of type "${varTypeStr}" used in position expecting type "${typeStr}".`,
                      {
                        nodes: [varDef, node]
                      }
                    )
                  );
                }
              }
            }
          }
        },
        VariableDefinition(node) {
          varDefMap[node.variable.name.value] = node;
        }
      };
    }
    function allowedVariableUsage(schema, varType, varDefaultValue, locationType, locationDefaultValue) {
      if ((0, _definition.isNonNullType)(locationType) && !(0, _definition.isNonNullType)(varType)) {
        const hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== _kinds.Kind.NULL;
        const hasLocationDefaultValue = locationDefaultValue !== void 0;
        if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
          return false;
        }
        const nullableLocationType = locationType.ofType;
        return (0, _typeComparators.isTypeSubTypeOf)(
          schema,
          varType,
          nullableLocationType
        );
      }
      return (0, _typeComparators.isTypeSubTypeOf)(schema, varType, locationType);
    }
  }
});

// node_modules/graphql/validation/specifiedRules.js
var require_specifiedRules = __commonJS({
  "node_modules/graphql/validation/specifiedRules.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.specifiedSDLRules = exports2.specifiedRules = exports2.recommendedRules = void 0;
    var _ExecutableDefinitionsRule = require_ExecutableDefinitionsRule();
    var _FieldsOnCorrectTypeRule = require_FieldsOnCorrectTypeRule();
    var _FragmentsOnCompositeTypesRule = require_FragmentsOnCompositeTypesRule();
    var _KnownArgumentNamesRule = require_KnownArgumentNamesRule();
    var _KnownDirectivesRule = require_KnownDirectivesRule();
    var _KnownFragmentNamesRule = require_KnownFragmentNamesRule();
    var _KnownTypeNamesRule = require_KnownTypeNamesRule();
    var _LoneAnonymousOperationRule = require_LoneAnonymousOperationRule();
    var _LoneSchemaDefinitionRule = require_LoneSchemaDefinitionRule();
    var _MaxIntrospectionDepthRule = require_MaxIntrospectionDepthRule();
    var _NoFragmentCyclesRule = require_NoFragmentCyclesRule();
    var _NoUndefinedVariablesRule = require_NoUndefinedVariablesRule();
    var _NoUnusedFragmentsRule = require_NoUnusedFragmentsRule();
    var _NoUnusedVariablesRule = require_NoUnusedVariablesRule();
    var _OverlappingFieldsCanBeMergedRule = require_OverlappingFieldsCanBeMergedRule();
    var _PossibleFragmentSpreadsRule = require_PossibleFragmentSpreadsRule();
    var _PossibleTypeExtensionsRule = require_PossibleTypeExtensionsRule();
    var _ProvidedRequiredArgumentsRule = require_ProvidedRequiredArgumentsRule();
    var _ScalarLeafsRule = require_ScalarLeafsRule();
    var _SingleFieldSubscriptionsRule = require_SingleFieldSubscriptionsRule();
    var _UniqueArgumentDefinitionNamesRule = require_UniqueArgumentDefinitionNamesRule();
    var _UniqueArgumentNamesRule = require_UniqueArgumentNamesRule();
    var _UniqueDirectiveNamesRule = require_UniqueDirectiveNamesRule();
    var _UniqueDirectivesPerLocationRule = require_UniqueDirectivesPerLocationRule();
    var _UniqueEnumValueNamesRule = require_UniqueEnumValueNamesRule();
    var _UniqueFieldDefinitionNamesRule = require_UniqueFieldDefinitionNamesRule();
    var _UniqueFragmentNamesRule = require_UniqueFragmentNamesRule();
    var _UniqueInputFieldNamesRule = require_UniqueInputFieldNamesRule();
    var _UniqueOperationNamesRule = require_UniqueOperationNamesRule();
    var _UniqueOperationTypesRule = require_UniqueOperationTypesRule();
    var _UniqueTypeNamesRule = require_UniqueTypeNamesRule();
    var _UniqueVariableNamesRule = require_UniqueVariableNamesRule();
    var _ValuesOfCorrectTypeRule = require_ValuesOfCorrectTypeRule();
    var _VariablesAreInputTypesRule = require_VariablesAreInputTypesRule();
    var _VariablesInAllowedPositionRule = require_VariablesInAllowedPositionRule();
    var recommendedRules = Object.freeze([
      _MaxIntrospectionDepthRule.MaxIntrospectionDepthRule
    ]);
    exports2.recommendedRules = recommendedRules;
    var specifiedRules = Object.freeze([
      _ExecutableDefinitionsRule.ExecutableDefinitionsRule,
      _UniqueOperationNamesRule.UniqueOperationNamesRule,
      _LoneAnonymousOperationRule.LoneAnonymousOperationRule,
      _SingleFieldSubscriptionsRule.SingleFieldSubscriptionsRule,
      _KnownTypeNamesRule.KnownTypeNamesRule,
      _FragmentsOnCompositeTypesRule.FragmentsOnCompositeTypesRule,
      _VariablesAreInputTypesRule.VariablesAreInputTypesRule,
      _ScalarLeafsRule.ScalarLeafsRule,
      _FieldsOnCorrectTypeRule.FieldsOnCorrectTypeRule,
      _UniqueFragmentNamesRule.UniqueFragmentNamesRule,
      _KnownFragmentNamesRule.KnownFragmentNamesRule,
      _NoUnusedFragmentsRule.NoUnusedFragmentsRule,
      _PossibleFragmentSpreadsRule.PossibleFragmentSpreadsRule,
      _NoFragmentCyclesRule.NoFragmentCyclesRule,
      _UniqueVariableNamesRule.UniqueVariableNamesRule,
      _NoUndefinedVariablesRule.NoUndefinedVariablesRule,
      _NoUnusedVariablesRule.NoUnusedVariablesRule,
      _KnownDirectivesRule.KnownDirectivesRule,
      _UniqueDirectivesPerLocationRule.UniqueDirectivesPerLocationRule,
      _KnownArgumentNamesRule.KnownArgumentNamesRule,
      _UniqueArgumentNamesRule.UniqueArgumentNamesRule,
      _ValuesOfCorrectTypeRule.ValuesOfCorrectTypeRule,
      _ProvidedRequiredArgumentsRule.ProvidedRequiredArgumentsRule,
      _VariablesInAllowedPositionRule.VariablesInAllowedPositionRule,
      _OverlappingFieldsCanBeMergedRule.OverlappingFieldsCanBeMergedRule,
      _UniqueInputFieldNamesRule.UniqueInputFieldNamesRule,
      ...recommendedRules
    ]);
    exports2.specifiedRules = specifiedRules;
    var specifiedSDLRules = Object.freeze([
      _LoneSchemaDefinitionRule.LoneSchemaDefinitionRule,
      _UniqueOperationTypesRule.UniqueOperationTypesRule,
      _UniqueTypeNamesRule.UniqueTypeNamesRule,
      _UniqueEnumValueNamesRule.UniqueEnumValueNamesRule,
      _UniqueFieldDefinitionNamesRule.UniqueFieldDefinitionNamesRule,
      _UniqueArgumentDefinitionNamesRule.UniqueArgumentDefinitionNamesRule,
      _UniqueDirectiveNamesRule.UniqueDirectiveNamesRule,
      _KnownTypeNamesRule.KnownTypeNamesRule,
      _KnownDirectivesRule.KnownDirectivesRule,
      _UniqueDirectivesPerLocationRule.UniqueDirectivesPerLocationRule,
      _PossibleTypeExtensionsRule.PossibleTypeExtensionsRule,
      _KnownArgumentNamesRule.KnownArgumentNamesOnDirectivesRule,
      _UniqueArgumentNamesRule.UniqueArgumentNamesRule,
      _UniqueInputFieldNamesRule.UniqueInputFieldNamesRule,
      _ProvidedRequiredArgumentsRule.ProvidedRequiredArgumentsOnDirectivesRule
    ]);
    exports2.specifiedSDLRules = specifiedSDLRules;
  }
});

// node_modules/graphql/validation/ValidationContext.js
var require_ValidationContext = __commonJS({
  "node_modules/graphql/validation/ValidationContext.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.ValidationContext = exports2.SDLValidationContext = exports2.ASTValidationContext = void 0;
    var _kinds = require_kinds();
    var _visitor = require_visitor();
    var _TypeInfo = require_TypeInfo();
    var ASTValidationContext = class {
      constructor(ast, onError) {
        this._ast = ast;
        this._fragments = void 0;
        this._fragmentSpreads = /* @__PURE__ */ new Map();
        this._recursivelyReferencedFragments = /* @__PURE__ */ new Map();
        this._onError = onError;
      }
      get [Symbol.toStringTag]() {
        return "ASTValidationContext";
      }
      reportError(error) {
        this._onError(error);
      }
      getDocument() {
        return this._ast;
      }
      getFragment(name) {
        let fragments;
        if (this._fragments) {
          fragments = this._fragments;
        } else {
          fragments = /* @__PURE__ */ Object.create(null);
          for (const defNode of this.getDocument().definitions) {
            if (defNode.kind === _kinds.Kind.FRAGMENT_DEFINITION) {
              fragments[defNode.name.value] = defNode;
            }
          }
          this._fragments = fragments;
        }
        return fragments[name];
      }
      getFragmentSpreads(node) {
        let spreads = this._fragmentSpreads.get(node);
        if (!spreads) {
          spreads = [];
          const setsToVisit = [node];
          let set;
          while (set = setsToVisit.pop()) {
            for (const selection of set.selections) {
              if (selection.kind === _kinds.Kind.FRAGMENT_SPREAD) {
                spreads.push(selection);
              } else if (selection.selectionSet) {
                setsToVisit.push(selection.selectionSet);
              }
            }
          }
          this._fragmentSpreads.set(node, spreads);
        }
        return spreads;
      }
      getRecursivelyReferencedFragments(operation) {
        let fragments = this._recursivelyReferencedFragments.get(operation);
        if (!fragments) {
          fragments = [];
          const collectedNames = /* @__PURE__ */ Object.create(null);
          const nodesToVisit = [operation.selectionSet];
          let node;
          while (node = nodesToVisit.pop()) {
            for (const spread of this.getFragmentSpreads(node)) {
              const fragName = spread.name.value;
              if (collectedNames[fragName] !== true) {
                collectedNames[fragName] = true;
                const fragment = this.getFragment(fragName);
                if (fragment) {
                  fragments.push(fragment);
                  nodesToVisit.push(fragment.selectionSet);
                }
              }
            }
          }
          this._recursivelyReferencedFragments.set(operation, fragments);
        }
        return fragments;
      }
    };
    exports2.ASTValidationContext = ASTValidationContext;
    var SDLValidationContext = class extends ASTValidationContext {
      constructor(ast, schema, onError) {
        super(ast, onError);
        this._schema = schema;
      }
      get [Symbol.toStringTag]() {
        return "SDLValidationContext";
      }
      getSchema() {
        return this._schema;
      }
    };
    exports2.SDLValidationContext = SDLValidationContext;
    var ValidationContext = class extends ASTValidationContext {
      constructor(schema, ast, typeInfo, onError) {
        super(ast, onError);
        this._schema = schema;
        this._typeInfo = typeInfo;
        this._variableUsages = /* @__PURE__ */ new Map();
        this._recursiveVariableUsages = /* @__PURE__ */ new Map();
      }
      get [Symbol.toStringTag]() {
        return "ValidationContext";
      }
      getSchema() {
        return this._schema;
      }
      getVariableUsages(node) {
        let usages = this._variableUsages.get(node);
        if (!usages) {
          const newUsages = [];
          const typeInfo = new _TypeInfo.TypeInfo(this._schema);
          (0, _visitor.visit)(
            node,
            (0, _TypeInfo.visitWithTypeInfo)(typeInfo, {
              VariableDefinition: () => false,
              Variable(variable) {
                newUsages.push({
                  node: variable,
                  type: typeInfo.getInputType(),
                  defaultValue: typeInfo.getDefaultValue()
                });
              }
            })
          );
          usages = newUsages;
          this._variableUsages.set(node, usages);
        }
        return usages;
      }
      getRecursiveVariableUsages(operation) {
        let usages = this._recursiveVariableUsages.get(operation);
        if (!usages) {
          usages = this.getVariableUsages(operation);
          for (const frag of this.getRecursivelyReferencedFragments(operation)) {
            usages = usages.concat(this.getVariableUsages(frag));
          }
          this._recursiveVariableUsages.set(operation, usages);
        }
        return usages;
      }
      getType() {
        return this._typeInfo.getType();
      }
      getParentType() {
        return this._typeInfo.getParentType();
      }
      getInputType() {
        return this._typeInfo.getInputType();
      }
      getParentInputType() {
        return this._typeInfo.getParentInputType();
      }
      getFieldDef() {
        return this._typeInfo.getFieldDef();
      }
      getDirective() {
        return this._typeInfo.getDirective();
      }
      getArgument() {
        return this._typeInfo.getArgument();
      }
      getEnumValue() {
        return this._typeInfo.getEnumValue();
      }
    };
    exports2.ValidationContext = ValidationContext;
  }
});

// node_modules/graphql/validation/validate.js
var require_validate2 = __commonJS({
  "node_modules/graphql/validation/validate.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.assertValidSDL = assertValidSDL;
    exports2.assertValidSDLExtension = assertValidSDLExtension;
    exports2.validate = validate;
    exports2.validateSDL = validateSDL;
    var _devAssert = require_devAssert();
    var _GraphQLError = require_GraphQLError();
    var _visitor = require_visitor();
    var _validate = require_validate();
    var _TypeInfo = require_TypeInfo();
    var _specifiedRules = require_specifiedRules();
    var _ValidationContext = require_ValidationContext();
    function validate(schema, documentAST, rules = _specifiedRules.specifiedRules, options, typeInfo = new _TypeInfo.TypeInfo(schema)) {
      var _options$maxErrors;
      const maxErrors = (_options$maxErrors = options === null || options === void 0 ? void 0 : options.maxErrors) !== null && _options$maxErrors !== void 0 ? _options$maxErrors : 100;
      documentAST || (0, _devAssert.devAssert)(false, "Must provide document.");
      (0, _validate.assertValidSchema)(schema);
      const abortObj = Object.freeze({});
      const errors = [];
      const context = new _ValidationContext.ValidationContext(
        schema,
        documentAST,
        typeInfo,
        (error) => {
          if (errors.length >= maxErrors) {
            errors.push(
              new _GraphQLError.GraphQLError(
                "Too many validation errors, error limit reached. Validation aborted."
              )
            );
            throw abortObj;
          }
          errors.push(error);
        }
      );
      const visitor = (0, _visitor.visitInParallel)(
        rules.map((rule) => rule(context))
      );
      try {
        (0, _visitor.visit)(
          documentAST,
          (0, _TypeInfo.visitWithTypeInfo)(typeInfo, visitor)
        );
      } catch (e) {
        if (e !== abortObj) {
          throw e;
        }
      }
      return errors;
    }
    function validateSDL(documentAST, schemaToExtend, rules = _specifiedRules.specifiedSDLRules) {
      const errors = [];
      const context = new _ValidationContext.SDLValidationContext(
        documentAST,
        schemaToExtend,
        (error) => {
          errors.push(error);
        }
      );
      const visitors = rules.map((rule) => rule(context));
      (0, _visitor.visit)(documentAST, (0, _visitor.visitInParallel)(visitors));
      return errors;
    }
    function assertValidSDL(documentAST) {
      const errors = validateSDL(documentAST);
      if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join("\n\n"));
      }
    }
    function assertValidSDLExtension(documentAST, schema) {
      const errors = validateSDL(documentAST, schema);
      if (errors.length !== 0) {
        throw new Error(errors.map((error) => error.message).join("\n\n"));
      }
    }
  }
});

// node_modules/graphql/jsutils/memoize3.js
var require_memoize3 = __commonJS({
  "node_modules/graphql/jsutils/memoize3.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.memoize3 = memoize3;
    function memoize3(fn) {
      let cache0;
      return function memoized(a1, a2, a3) {
        if (cache0 === void 0) {
          cache0 = /* @__PURE__ */ new WeakMap();
        }
        let cache1 = cache0.get(a1);
        if (cache1 === void 0) {
          cache1 = /* @__PURE__ */ new WeakMap();
          cache0.set(a1, cache1);
        }
        let cache2 = cache1.get(a2);
        if (cache2 === void 0) {
          cache2 = /* @__PURE__ */ new WeakMap();
          cache1.set(a2, cache2);
        }
        let fnResult = cache2.get(a3);
        if (fnResult === void 0) {
          fnResult = fn(a1, a2, a3);
          cache2.set(a3, fnResult);
        }
        return fnResult;
      };
    }
  }
});

// node_modules/graphql/jsutils/promiseForObject.js
var require_promiseForObject = __commonJS({
  "node_modules/graphql/jsutils/promiseForObject.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.promiseForObject = promiseForObject;
    function promiseForObject(object) {
      return Promise.all(Object.values(object)).then((resolvedValues) => {
        const resolvedObject = /* @__PURE__ */ Object.create(null);
        for (const [i, key] of Object.keys(object).entries()) {
          resolvedObject[key] = resolvedValues[i];
        }
        return resolvedObject;
      });
    }
  }
});

// node_modules/graphql/jsutils/promiseReduce.js
var require_promiseReduce = __commonJS({
  "node_modules/graphql/jsutils/promiseReduce.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.promiseReduce = promiseReduce;
    var _isPromise = require_isPromise();
    function promiseReduce(values, callbackFn, initialValue) {
      let accumulator = initialValue;
      for (const value of values) {
        accumulator = (0, _isPromise.isPromise)(accumulator) ? accumulator.then((resolved) => callbackFn(resolved, value)) : callbackFn(accumulator, value);
      }
      return accumulator;
    }
  }
});

// node_modules/graphql/jsutils/toError.js
var require_toError = __commonJS({
  "node_modules/graphql/jsutils/toError.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.toError = toError;
    var _inspect = require_inspect();
    function toError(thrownValue) {
      return thrownValue instanceof Error ? thrownValue : new NonErrorThrown(thrownValue);
    }
    var NonErrorThrown = class extends Error {
      constructor(thrownValue) {
        super("Unexpected error value: " + (0, _inspect.inspect)(thrownValue));
        this.name = "NonErrorThrown";
        this.thrownValue = thrownValue;
      }
    };
  }
});

// node_modules/graphql/error/locatedError.js
var require_locatedError = __commonJS({
  "node_modules/graphql/error/locatedError.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.locatedError = locatedError;
    var _toError = require_toError();
    var _GraphQLError = require_GraphQLError();
    function locatedError(rawOriginalError, nodes, path2) {
      var _nodes;
      const originalError = (0, _toError.toError)(rawOriginalError);
      if (isLocatedGraphQLError(originalError)) {
        return originalError;
      }
      return new _GraphQLError.GraphQLError(originalError.message, {
        nodes: (_nodes = originalError.nodes) !== null && _nodes !== void 0 ? _nodes : nodes,
        source: originalError.source,
        positions: originalError.positions,
        path: path2,
        originalError
      });
    }
    function isLocatedGraphQLError(error) {
      return Array.isArray(error.path);
    }
  }
});

// node_modules/graphql/execution/execute.js
var require_execute = __commonJS({
  "node_modules/graphql/execution/execute.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.assertValidExecutionArguments = assertValidExecutionArguments;
    exports2.buildExecutionContext = buildExecutionContext;
    exports2.buildResolveInfo = buildResolveInfo;
    exports2.defaultTypeResolver = exports2.defaultFieldResolver = void 0;
    exports2.execute = execute;
    exports2.executeSync = executeSync;
    exports2.getFieldDef = getFieldDef;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _isIterableObject = require_isIterableObject();
    var _isObjectLike = require_isObjectLike();
    var _isPromise = require_isPromise();
    var _memoize = require_memoize3();
    var _Path = require_Path();
    var _promiseForObject = require_promiseForObject();
    var _promiseReduce = require_promiseReduce();
    var _GraphQLError = require_GraphQLError();
    var _locatedError = require_locatedError();
    var _ast = require_ast();
    var _kinds = require_kinds();
    var _definition = require_definition();
    var _introspection = require_introspection();
    var _validate = require_validate();
    var _collectFields = require_collectFields();
    var _values = require_values();
    var collectSubfields = (0, _memoize.memoize3)(
      (exeContext, returnType, fieldNodes) => (0, _collectFields.collectSubfields)(
        exeContext.schema,
        exeContext.fragments,
        exeContext.variableValues,
        returnType,
        fieldNodes
      )
    );
    function execute(args) {
      arguments.length < 2 || (0, _devAssert.devAssert)(
        false,
        "graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead."
      );
      const { schema, document, variableValues, rootValue } = args;
      assertValidExecutionArguments(schema, document, variableValues);
      const exeContext = buildExecutionContext(args);
      if (!("schema" in exeContext)) {
        return {
          errors: exeContext
        };
      }
      try {
        const { operation } = exeContext;
        const result = executeOperation(exeContext, operation, rootValue);
        if ((0, _isPromise.isPromise)(result)) {
          return result.then(
            (data) => buildResponse(data, exeContext.errors),
            (error) => {
              exeContext.errors.push(error);
              return buildResponse(null, exeContext.errors);
            }
          );
        }
        return buildResponse(result, exeContext.errors);
      } catch (error) {
        exeContext.errors.push(error);
        return buildResponse(null, exeContext.errors);
      }
    }
    function executeSync(args) {
      const result = execute(args);
      if ((0, _isPromise.isPromise)(result)) {
        throw new Error("GraphQL execution failed to complete synchronously.");
      }
      return result;
    }
    function buildResponse(data, errors) {
      return errors.length === 0 ? {
        data
      } : {
        errors,
        data
      };
    }
    function assertValidExecutionArguments(schema, document, rawVariableValues) {
      document || (0, _devAssert.devAssert)(false, "Must provide document.");
      (0, _validate.assertValidSchema)(schema);
      rawVariableValues == null || (0, _isObjectLike.isObjectLike)(rawVariableValues) || (0, _devAssert.devAssert)(
        false,
        "Variables must be provided as an Object where each property is a variable value. Perhaps look to see if an unparsed JSON string was provided."
      );
    }
    function buildExecutionContext(args) {
      var _definition$name, _operation$variableDe;
      const {
        schema,
        document,
        rootValue,
        contextValue,
        variableValues: rawVariableValues,
        operationName,
        fieldResolver,
        typeResolver,
        subscribeFieldResolver
      } = args;
      let operation;
      const fragments = /* @__PURE__ */ Object.create(null);
      for (const definition of document.definitions) {
        switch (definition.kind) {
          case _kinds.Kind.OPERATION_DEFINITION:
            if (operationName == null) {
              if (operation !== void 0) {
                return [
                  new _GraphQLError.GraphQLError(
                    "Must provide operation name if query contains multiple operations."
                  )
                ];
              }
              operation = definition;
            } else if (((_definition$name = definition.name) === null || _definition$name === void 0 ? void 0 : _definition$name.value) === operationName) {
              operation = definition;
            }
            break;
          case _kinds.Kind.FRAGMENT_DEFINITION:
            fragments[definition.name.value] = definition;
            break;
          default:
        }
      }
      if (!operation) {
        if (operationName != null) {
          return [
            new _GraphQLError.GraphQLError(
              `Unknown operation named "${operationName}".`
            )
          ];
        }
        return [new _GraphQLError.GraphQLError("Must provide an operation.")];
      }
      const variableDefinitions = (_operation$variableDe = operation.variableDefinitions) !== null && _operation$variableDe !== void 0 ? _operation$variableDe : [];
      const coercedVariableValues = (0, _values.getVariableValues)(
        schema,
        variableDefinitions,
        rawVariableValues !== null && rawVariableValues !== void 0 ? rawVariableValues : {},
        {
          maxErrors: 50
        }
      );
      if (coercedVariableValues.errors) {
        return coercedVariableValues.errors;
      }
      return {
        schema,
        fragments,
        rootValue,
        contextValue,
        operation,
        variableValues: coercedVariableValues.coerced,
        fieldResolver: fieldResolver !== null && fieldResolver !== void 0 ? fieldResolver : defaultFieldResolver,
        typeResolver: typeResolver !== null && typeResolver !== void 0 ? typeResolver : defaultTypeResolver,
        subscribeFieldResolver: subscribeFieldResolver !== null && subscribeFieldResolver !== void 0 ? subscribeFieldResolver : defaultFieldResolver,
        errors: []
      };
    }
    function executeOperation(exeContext, operation, rootValue) {
      const rootType = exeContext.schema.getRootType(operation.operation);
      if (rootType == null) {
        throw new _GraphQLError.GraphQLError(
          `Schema is not configured to execute ${operation.operation} operation.`,
          {
            nodes: operation
          }
        );
      }
      const rootFields = (0, _collectFields.collectFields)(
        exeContext.schema,
        exeContext.fragments,
        exeContext.variableValues,
        rootType,
        operation.selectionSet
      );
      const path2 = void 0;
      switch (operation.operation) {
        case _ast.OperationTypeNode.QUERY:
          return executeFields(exeContext, rootType, rootValue, path2, rootFields);
        case _ast.OperationTypeNode.MUTATION:
          return executeFieldsSerially(
            exeContext,
            rootType,
            rootValue,
            path2,
            rootFields
          );
        case _ast.OperationTypeNode.SUBSCRIPTION:
          return executeFields(exeContext, rootType, rootValue, path2, rootFields);
      }
    }
    function executeFieldsSerially(exeContext, parentType, sourceValue, path2, fields) {
      return (0, _promiseReduce.promiseReduce)(
        fields.entries(),
        (results, [responseName, fieldNodes]) => {
          const fieldPath = (0, _Path.addPath)(path2, responseName, parentType.name);
          const result = executeField(
            exeContext,
            parentType,
            sourceValue,
            fieldNodes,
            fieldPath
          );
          if (result === void 0) {
            return results;
          }
          if ((0, _isPromise.isPromise)(result)) {
            return result.then((resolvedResult) => {
              results[responseName] = resolvedResult;
              return results;
            });
          }
          results[responseName] = result;
          return results;
        },
        /* @__PURE__ */ Object.create(null)
      );
    }
    function executeFields(exeContext, parentType, sourceValue, path2, fields) {
      const results = /* @__PURE__ */ Object.create(null);
      let containsPromise = false;
      try {
        for (const [responseName, fieldNodes] of fields.entries()) {
          const fieldPath = (0, _Path.addPath)(path2, responseName, parentType.name);
          const result = executeField(
            exeContext,
            parentType,
            sourceValue,
            fieldNodes,
            fieldPath
          );
          if (result !== void 0) {
            results[responseName] = result;
            if ((0, _isPromise.isPromise)(result)) {
              containsPromise = true;
            }
          }
        }
      } catch (error) {
        if (containsPromise) {
          return (0, _promiseForObject.promiseForObject)(results).finally(() => {
            throw error;
          });
        }
        throw error;
      }
      if (!containsPromise) {
        return results;
      }
      return (0, _promiseForObject.promiseForObject)(results);
    }
    function executeField(exeContext, parentType, source, fieldNodes, path2) {
      var _fieldDef$resolve;
      const fieldDef = getFieldDef(exeContext.schema, parentType, fieldNodes[0]);
      if (!fieldDef) {
        return;
      }
      const returnType = fieldDef.type;
      const resolveFn = (_fieldDef$resolve = fieldDef.resolve) !== null && _fieldDef$resolve !== void 0 ? _fieldDef$resolve : exeContext.fieldResolver;
      const info = buildResolveInfo(
        exeContext,
        fieldDef,
        fieldNodes,
        parentType,
        path2
      );
      try {
        const args = (0, _values.getArgumentValues)(
          fieldDef,
          fieldNodes[0],
          exeContext.variableValues
        );
        const contextValue = exeContext.contextValue;
        const result = resolveFn(source, args, contextValue, info);
        let completed;
        if ((0, _isPromise.isPromise)(result)) {
          completed = result.then(
            (resolved) => completeValue(exeContext, returnType, fieldNodes, info, path2, resolved)
          );
        } else {
          completed = completeValue(
            exeContext,
            returnType,
            fieldNodes,
            info,
            path2,
            result
          );
        }
        if ((0, _isPromise.isPromise)(completed)) {
          return completed.then(void 0, (rawError) => {
            const error = (0, _locatedError.locatedError)(
              rawError,
              fieldNodes,
              (0, _Path.pathToArray)(path2)
            );
            return handleFieldError(error, returnType, exeContext);
          });
        }
        return completed;
      } catch (rawError) {
        const error = (0, _locatedError.locatedError)(
          rawError,
          fieldNodes,
          (0, _Path.pathToArray)(path2)
        );
        return handleFieldError(error, returnType, exeContext);
      }
    }
    function buildResolveInfo(exeContext, fieldDef, fieldNodes, parentType, path2) {
      return {
        fieldName: fieldDef.name,
        fieldNodes,
        returnType: fieldDef.type,
        parentType,
        path: path2,
        schema: exeContext.schema,
        fragments: exeContext.fragments,
        rootValue: exeContext.rootValue,
        operation: exeContext.operation,
        variableValues: exeContext.variableValues
      };
    }
    function handleFieldError(error, returnType, exeContext) {
      if ((0, _definition.isNonNullType)(returnType)) {
        throw error;
      }
      exeContext.errors.push(error);
      return null;
    }
    function completeValue(exeContext, returnType, fieldNodes, info, path2, result) {
      if (result instanceof Error) {
        throw result;
      }
      if ((0, _definition.isNonNullType)(returnType)) {
        const completed = completeValue(
          exeContext,
          returnType.ofType,
          fieldNodes,
          info,
          path2,
          result
        );
        if (completed === null) {
          throw new Error(
            `Cannot return null for non-nullable field ${info.parentType.name}.${info.fieldName}.`
          );
        }
        return completed;
      }
      if (result == null) {
        return null;
      }
      if ((0, _definition.isListType)(returnType)) {
        return completeListValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path2,
          result
        );
      }
      if ((0, _definition.isLeafType)(returnType)) {
        return completeLeafValue(returnType, result);
      }
      if ((0, _definition.isAbstractType)(returnType)) {
        return completeAbstractValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path2,
          result
        );
      }
      if ((0, _definition.isObjectType)(returnType)) {
        return completeObjectValue(
          exeContext,
          returnType,
          fieldNodes,
          info,
          path2,
          result
        );
      }
      (0, _invariant.invariant)(
        false,
        "Cannot complete value of unexpected output type: " + (0, _inspect.inspect)(returnType)
      );
    }
    function completeListValue(exeContext, returnType, fieldNodes, info, path2, result) {
      if (!(0, _isIterableObject.isIterableObject)(result)) {
        throw new _GraphQLError.GraphQLError(
          `Expected Iterable, but did not find one for field "${info.parentType.name}.${info.fieldName}".`
        );
      }
      const itemType = returnType.ofType;
      let containsPromise = false;
      const completedResults = Array.from(result, (item, index) => {
        const itemPath = (0, _Path.addPath)(path2, index, void 0);
        try {
          let completedItem;
          if ((0, _isPromise.isPromise)(item)) {
            completedItem = item.then(
              (resolved) => completeValue(
                exeContext,
                itemType,
                fieldNodes,
                info,
                itemPath,
                resolved
              )
            );
          } else {
            completedItem = completeValue(
              exeContext,
              itemType,
              fieldNodes,
              info,
              itemPath,
              item
            );
          }
          if ((0, _isPromise.isPromise)(completedItem)) {
            containsPromise = true;
            return completedItem.then(void 0, (rawError) => {
              const error = (0, _locatedError.locatedError)(
                rawError,
                fieldNodes,
                (0, _Path.pathToArray)(itemPath)
              );
              return handleFieldError(error, itemType, exeContext);
            });
          }
          return completedItem;
        } catch (rawError) {
          const error = (0, _locatedError.locatedError)(
            rawError,
            fieldNodes,
            (0, _Path.pathToArray)(itemPath)
          );
          return handleFieldError(error, itemType, exeContext);
        }
      });
      return containsPromise ? Promise.all(completedResults) : completedResults;
    }
    function completeLeafValue(returnType, result) {
      const serializedResult = returnType.serialize(result);
      if (serializedResult == null) {
        throw new Error(
          `Expected \`${(0, _inspect.inspect)(returnType)}.serialize(${(0, _inspect.inspect)(result)})\` to return non-nullable value, returned: ${(0, _inspect.inspect)(
            serializedResult
          )}`
        );
      }
      return serializedResult;
    }
    function completeAbstractValue(exeContext, returnType, fieldNodes, info, path2, result) {
      var _returnType$resolveTy;
      const resolveTypeFn = (_returnType$resolveTy = returnType.resolveType) !== null && _returnType$resolveTy !== void 0 ? _returnType$resolveTy : exeContext.typeResolver;
      const contextValue = exeContext.contextValue;
      const runtimeType = resolveTypeFn(result, contextValue, info, returnType);
      if ((0, _isPromise.isPromise)(runtimeType)) {
        return runtimeType.then(
          (resolvedRuntimeType) => completeObjectValue(
            exeContext,
            ensureValidRuntimeType(
              resolvedRuntimeType,
              exeContext,
              returnType,
              fieldNodes,
              info,
              result
            ),
            fieldNodes,
            info,
            path2,
            result
          )
        );
      }
      return completeObjectValue(
        exeContext,
        ensureValidRuntimeType(
          runtimeType,
          exeContext,
          returnType,
          fieldNodes,
          info,
          result
        ),
        fieldNodes,
        info,
        path2,
        result
      );
    }
    function ensureValidRuntimeType(runtimeTypeName, exeContext, returnType, fieldNodes, info, result) {
      if (runtimeTypeName == null) {
        throw new _GraphQLError.GraphQLError(
          `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}". Either the "${returnType.name}" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.`,
          fieldNodes
        );
      }
      if ((0, _definition.isObjectType)(runtimeTypeName)) {
        throw new _GraphQLError.GraphQLError(
          "Support for returning GraphQLObjectType from resolveType was removed in graphql-js@16.0.0 please return type name instead."
        );
      }
      if (typeof runtimeTypeName !== "string") {
        throw new _GraphQLError.GraphQLError(
          `Abstract type "${returnType.name}" must resolve to an Object type at runtime for field "${info.parentType.name}.${info.fieldName}" with value ${(0, _inspect.inspect)(result)}, received "${(0, _inspect.inspect)(runtimeTypeName)}".`
        );
      }
      const runtimeType = exeContext.schema.getType(runtimeTypeName);
      if (runtimeType == null) {
        throw new _GraphQLError.GraphQLError(
          `Abstract type "${returnType.name}" was resolved to a type "${runtimeTypeName}" that does not exist inside the schema.`,
          {
            nodes: fieldNodes
          }
        );
      }
      if (!(0, _definition.isObjectType)(runtimeType)) {
        throw new _GraphQLError.GraphQLError(
          `Abstract type "${returnType.name}" was resolved to a non-object type "${runtimeTypeName}".`,
          {
            nodes: fieldNodes
          }
        );
      }
      if (!exeContext.schema.isSubType(returnType, runtimeType)) {
        throw new _GraphQLError.GraphQLError(
          `Runtime Object type "${runtimeType.name}" is not a possible type for "${returnType.name}".`,
          {
            nodes: fieldNodes
          }
        );
      }
      return runtimeType;
    }
    function completeObjectValue(exeContext, returnType, fieldNodes, info, path2, result) {
      const subFieldNodes = collectSubfields(exeContext, returnType, fieldNodes);
      if (returnType.isTypeOf) {
        const isTypeOf = returnType.isTypeOf(result, exeContext.contextValue, info);
        if ((0, _isPromise.isPromise)(isTypeOf)) {
          return isTypeOf.then((resolvedIsTypeOf) => {
            if (!resolvedIsTypeOf) {
              throw invalidReturnTypeError(returnType, result, fieldNodes);
            }
            return executeFields(
              exeContext,
              returnType,
              result,
              path2,
              subFieldNodes
            );
          });
        }
        if (!isTypeOf) {
          throw invalidReturnTypeError(returnType, result, fieldNodes);
        }
      }
      return executeFields(exeContext, returnType, result, path2, subFieldNodes);
    }
    function invalidReturnTypeError(returnType, result, fieldNodes) {
      return new _GraphQLError.GraphQLError(
        `Expected value of type "${returnType.name}" but got: ${(0, _inspect.inspect)(result)}.`,
        {
          nodes: fieldNodes
        }
      );
    }
    var defaultTypeResolver = function(value, contextValue, info, abstractType) {
      if ((0, _isObjectLike.isObjectLike)(value) && typeof value.__typename === "string") {
        return value.__typename;
      }
      const possibleTypes = info.schema.getPossibleTypes(abstractType);
      const promisedIsTypeOfResults = [];
      for (let i = 0; i < possibleTypes.length; i++) {
        const type = possibleTypes[i];
        if (type.isTypeOf) {
          const isTypeOfResult = type.isTypeOf(value, contextValue, info);
          if ((0, _isPromise.isPromise)(isTypeOfResult)) {
            promisedIsTypeOfResults[i] = isTypeOfResult;
          } else if (isTypeOfResult) {
            return type.name;
          }
        }
      }
      if (promisedIsTypeOfResults.length) {
        return Promise.all(promisedIsTypeOfResults).then((isTypeOfResults) => {
          for (let i = 0; i < isTypeOfResults.length; i++) {
            if (isTypeOfResults[i]) {
              return possibleTypes[i].name;
            }
          }
        });
      }
    };
    exports2.defaultTypeResolver = defaultTypeResolver;
    var defaultFieldResolver = function(source, args, contextValue, info) {
      if ((0, _isObjectLike.isObjectLike)(source) || typeof source === "function") {
        const property = source[info.fieldName];
        if (typeof property === "function") {
          return source[info.fieldName](args, contextValue, info);
        }
        return property;
      }
    };
    exports2.defaultFieldResolver = defaultFieldResolver;
    function getFieldDef(schema, parentType, fieldNode) {
      const fieldName = fieldNode.name.value;
      if (fieldName === _introspection.SchemaMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.SchemaMetaFieldDef;
      } else if (fieldName === _introspection.TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
        return _introspection.TypeMetaFieldDef;
      } else if (fieldName === _introspection.TypeNameMetaFieldDef.name) {
        return _introspection.TypeNameMetaFieldDef;
      }
      return parentType.getFields()[fieldName];
    }
  }
});

// node_modules/graphql/graphql.js
var require_graphql = __commonJS({
  "node_modules/graphql/graphql.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.graphql = graphql;
    exports2.graphqlSync = graphqlSync;
    var _devAssert = require_devAssert();
    var _isPromise = require_isPromise();
    var _parser = require_parser();
    var _validate = require_validate();
    var _validate2 = require_validate2();
    var _execute = require_execute();
    function graphql(args) {
      return new Promise((resolve) => resolve(graphqlImpl(args)));
    }
    function graphqlSync(args) {
      const result = graphqlImpl(args);
      if ((0, _isPromise.isPromise)(result)) {
        throw new Error("GraphQL execution failed to complete synchronously.");
      }
      return result;
    }
    function graphqlImpl(args) {
      arguments.length < 2 || (0, _devAssert.devAssert)(
        false,
        "graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead."
      );
      const {
        schema,
        source,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
      } = args;
      const schemaValidationErrors = (0, _validate.validateSchema)(schema);
      if (schemaValidationErrors.length > 0) {
        return {
          errors: schemaValidationErrors
        };
      }
      let document;
      try {
        document = (0, _parser.parse)(source);
      } catch (syntaxError) {
        return {
          errors: [syntaxError]
        };
      }
      const validationErrors = (0, _validate2.validate)(schema, document);
      if (validationErrors.length > 0) {
        return {
          errors: validationErrors
        };
      }
      return (0, _execute.execute)({
        schema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver
      });
    }
  }
});

// node_modules/graphql/type/index.js
var require_type = __commonJS({
  "node_modules/graphql/type/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "DEFAULT_DEPRECATION_REASON", {
      enumerable: true,
      get: function() {
        return _directives.DEFAULT_DEPRECATION_REASON;
      }
    });
    Object.defineProperty(exports2, "GRAPHQL_MAX_INT", {
      enumerable: true,
      get: function() {
        return _scalars.GRAPHQL_MAX_INT;
      }
    });
    Object.defineProperty(exports2, "GRAPHQL_MIN_INT", {
      enumerable: true,
      get: function() {
        return _scalars.GRAPHQL_MIN_INT;
      }
    });
    Object.defineProperty(exports2, "GraphQLBoolean", {
      enumerable: true,
      get: function() {
        return _scalars.GraphQLBoolean;
      }
    });
    Object.defineProperty(exports2, "GraphQLDeprecatedDirective", {
      enumerable: true,
      get: function() {
        return _directives.GraphQLDeprecatedDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLDirective", {
      enumerable: true,
      get: function() {
        return _directives.GraphQLDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLEnumType", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLEnumType;
      }
    });
    Object.defineProperty(exports2, "GraphQLFloat", {
      enumerable: true,
      get: function() {
        return _scalars.GraphQLFloat;
      }
    });
    Object.defineProperty(exports2, "GraphQLID", {
      enumerable: true,
      get: function() {
        return _scalars.GraphQLID;
      }
    });
    Object.defineProperty(exports2, "GraphQLIncludeDirective", {
      enumerable: true,
      get: function() {
        return _directives.GraphQLIncludeDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLInputObjectType", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLInputObjectType;
      }
    });
    Object.defineProperty(exports2, "GraphQLInt", {
      enumerable: true,
      get: function() {
        return _scalars.GraphQLInt;
      }
    });
    Object.defineProperty(exports2, "GraphQLInterfaceType", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLInterfaceType;
      }
    });
    Object.defineProperty(exports2, "GraphQLList", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLList;
      }
    });
    Object.defineProperty(exports2, "GraphQLNonNull", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLNonNull;
      }
    });
    Object.defineProperty(exports2, "GraphQLObjectType", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLObjectType;
      }
    });
    Object.defineProperty(exports2, "GraphQLOneOfDirective", {
      enumerable: true,
      get: function() {
        return _directives.GraphQLOneOfDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLScalarType", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLScalarType;
      }
    });
    Object.defineProperty(exports2, "GraphQLSchema", {
      enumerable: true,
      get: function() {
        return _schema.GraphQLSchema;
      }
    });
    Object.defineProperty(exports2, "GraphQLSkipDirective", {
      enumerable: true,
      get: function() {
        return _directives.GraphQLSkipDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLSpecifiedByDirective", {
      enumerable: true,
      get: function() {
        return _directives.GraphQLSpecifiedByDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLString", {
      enumerable: true,
      get: function() {
        return _scalars.GraphQLString;
      }
    });
    Object.defineProperty(exports2, "GraphQLUnionType", {
      enumerable: true,
      get: function() {
        return _definition.GraphQLUnionType;
      }
    });
    Object.defineProperty(exports2, "SchemaMetaFieldDef", {
      enumerable: true,
      get: function() {
        return _introspection.SchemaMetaFieldDef;
      }
    });
    Object.defineProperty(exports2, "TypeKind", {
      enumerable: true,
      get: function() {
        return _introspection.TypeKind;
      }
    });
    Object.defineProperty(exports2, "TypeMetaFieldDef", {
      enumerable: true,
      get: function() {
        return _introspection.TypeMetaFieldDef;
      }
    });
    Object.defineProperty(exports2, "TypeNameMetaFieldDef", {
      enumerable: true,
      get: function() {
        return _introspection.TypeNameMetaFieldDef;
      }
    });
    Object.defineProperty(exports2, "__Directive", {
      enumerable: true,
      get: function() {
        return _introspection.__Directive;
      }
    });
    Object.defineProperty(exports2, "__DirectiveLocation", {
      enumerable: true,
      get: function() {
        return _introspection.__DirectiveLocation;
      }
    });
    Object.defineProperty(exports2, "__EnumValue", {
      enumerable: true,
      get: function() {
        return _introspection.__EnumValue;
      }
    });
    Object.defineProperty(exports2, "__Field", {
      enumerable: true,
      get: function() {
        return _introspection.__Field;
      }
    });
    Object.defineProperty(exports2, "__InputValue", {
      enumerable: true,
      get: function() {
        return _introspection.__InputValue;
      }
    });
    Object.defineProperty(exports2, "__Schema", {
      enumerable: true,
      get: function() {
        return _introspection.__Schema;
      }
    });
    Object.defineProperty(exports2, "__Type", {
      enumerable: true,
      get: function() {
        return _introspection.__Type;
      }
    });
    Object.defineProperty(exports2, "__TypeKind", {
      enumerable: true,
      get: function() {
        return _introspection.__TypeKind;
      }
    });
    Object.defineProperty(exports2, "assertAbstractType", {
      enumerable: true,
      get: function() {
        return _definition.assertAbstractType;
      }
    });
    Object.defineProperty(exports2, "assertCompositeType", {
      enumerable: true,
      get: function() {
        return _definition.assertCompositeType;
      }
    });
    Object.defineProperty(exports2, "assertDirective", {
      enumerable: true,
      get: function() {
        return _directives.assertDirective;
      }
    });
    Object.defineProperty(exports2, "assertEnumType", {
      enumerable: true,
      get: function() {
        return _definition.assertEnumType;
      }
    });
    Object.defineProperty(exports2, "assertEnumValueName", {
      enumerable: true,
      get: function() {
        return _assertName.assertEnumValueName;
      }
    });
    Object.defineProperty(exports2, "assertInputObjectType", {
      enumerable: true,
      get: function() {
        return _definition.assertInputObjectType;
      }
    });
    Object.defineProperty(exports2, "assertInputType", {
      enumerable: true,
      get: function() {
        return _definition.assertInputType;
      }
    });
    Object.defineProperty(exports2, "assertInterfaceType", {
      enumerable: true,
      get: function() {
        return _definition.assertInterfaceType;
      }
    });
    Object.defineProperty(exports2, "assertLeafType", {
      enumerable: true,
      get: function() {
        return _definition.assertLeafType;
      }
    });
    Object.defineProperty(exports2, "assertListType", {
      enumerable: true,
      get: function() {
        return _definition.assertListType;
      }
    });
    Object.defineProperty(exports2, "assertName", {
      enumerable: true,
      get: function() {
        return _assertName.assertName;
      }
    });
    Object.defineProperty(exports2, "assertNamedType", {
      enumerable: true,
      get: function() {
        return _definition.assertNamedType;
      }
    });
    Object.defineProperty(exports2, "assertNonNullType", {
      enumerable: true,
      get: function() {
        return _definition.assertNonNullType;
      }
    });
    Object.defineProperty(exports2, "assertNullableType", {
      enumerable: true,
      get: function() {
        return _definition.assertNullableType;
      }
    });
    Object.defineProperty(exports2, "assertObjectType", {
      enumerable: true,
      get: function() {
        return _definition.assertObjectType;
      }
    });
    Object.defineProperty(exports2, "assertOutputType", {
      enumerable: true,
      get: function() {
        return _definition.assertOutputType;
      }
    });
    Object.defineProperty(exports2, "assertScalarType", {
      enumerable: true,
      get: function() {
        return _definition.assertScalarType;
      }
    });
    Object.defineProperty(exports2, "assertSchema", {
      enumerable: true,
      get: function() {
        return _schema.assertSchema;
      }
    });
    Object.defineProperty(exports2, "assertType", {
      enumerable: true,
      get: function() {
        return _definition.assertType;
      }
    });
    Object.defineProperty(exports2, "assertUnionType", {
      enumerable: true,
      get: function() {
        return _definition.assertUnionType;
      }
    });
    Object.defineProperty(exports2, "assertValidSchema", {
      enumerable: true,
      get: function() {
        return _validate.assertValidSchema;
      }
    });
    Object.defineProperty(exports2, "assertWrappingType", {
      enumerable: true,
      get: function() {
        return _definition.assertWrappingType;
      }
    });
    Object.defineProperty(exports2, "getNamedType", {
      enumerable: true,
      get: function() {
        return _definition.getNamedType;
      }
    });
    Object.defineProperty(exports2, "getNullableType", {
      enumerable: true,
      get: function() {
        return _definition.getNullableType;
      }
    });
    Object.defineProperty(exports2, "introspectionTypes", {
      enumerable: true,
      get: function() {
        return _introspection.introspectionTypes;
      }
    });
    Object.defineProperty(exports2, "isAbstractType", {
      enumerable: true,
      get: function() {
        return _definition.isAbstractType;
      }
    });
    Object.defineProperty(exports2, "isCompositeType", {
      enumerable: true,
      get: function() {
        return _definition.isCompositeType;
      }
    });
    Object.defineProperty(exports2, "isDirective", {
      enumerable: true,
      get: function() {
        return _directives.isDirective;
      }
    });
    Object.defineProperty(exports2, "isEnumType", {
      enumerable: true,
      get: function() {
        return _definition.isEnumType;
      }
    });
    Object.defineProperty(exports2, "isInputObjectType", {
      enumerable: true,
      get: function() {
        return _definition.isInputObjectType;
      }
    });
    Object.defineProperty(exports2, "isInputType", {
      enumerable: true,
      get: function() {
        return _definition.isInputType;
      }
    });
    Object.defineProperty(exports2, "isInterfaceType", {
      enumerable: true,
      get: function() {
        return _definition.isInterfaceType;
      }
    });
    Object.defineProperty(exports2, "isIntrospectionType", {
      enumerable: true,
      get: function() {
        return _introspection.isIntrospectionType;
      }
    });
    Object.defineProperty(exports2, "isLeafType", {
      enumerable: true,
      get: function() {
        return _definition.isLeafType;
      }
    });
    Object.defineProperty(exports2, "isListType", {
      enumerable: true,
      get: function() {
        return _definition.isListType;
      }
    });
    Object.defineProperty(exports2, "isNamedType", {
      enumerable: true,
      get: function() {
        return _definition.isNamedType;
      }
    });
    Object.defineProperty(exports2, "isNonNullType", {
      enumerable: true,
      get: function() {
        return _definition.isNonNullType;
      }
    });
    Object.defineProperty(exports2, "isNullableType", {
      enumerable: true,
      get: function() {
        return _definition.isNullableType;
      }
    });
    Object.defineProperty(exports2, "isObjectType", {
      enumerable: true,
      get: function() {
        return _definition.isObjectType;
      }
    });
    Object.defineProperty(exports2, "isOutputType", {
      enumerable: true,
      get: function() {
        return _definition.isOutputType;
      }
    });
    Object.defineProperty(exports2, "isRequiredArgument", {
      enumerable: true,
      get: function() {
        return _definition.isRequiredArgument;
      }
    });
    Object.defineProperty(exports2, "isRequiredInputField", {
      enumerable: true,
      get: function() {
        return _definition.isRequiredInputField;
      }
    });
    Object.defineProperty(exports2, "isScalarType", {
      enumerable: true,
      get: function() {
        return _definition.isScalarType;
      }
    });
    Object.defineProperty(exports2, "isSchema", {
      enumerable: true,
      get: function() {
        return _schema.isSchema;
      }
    });
    Object.defineProperty(exports2, "isSpecifiedDirective", {
      enumerable: true,
      get: function() {
        return _directives.isSpecifiedDirective;
      }
    });
    Object.defineProperty(exports2, "isSpecifiedScalarType", {
      enumerable: true,
      get: function() {
        return _scalars.isSpecifiedScalarType;
      }
    });
    Object.defineProperty(exports2, "isType", {
      enumerable: true,
      get: function() {
        return _definition.isType;
      }
    });
    Object.defineProperty(exports2, "isUnionType", {
      enumerable: true,
      get: function() {
        return _definition.isUnionType;
      }
    });
    Object.defineProperty(exports2, "isWrappingType", {
      enumerable: true,
      get: function() {
        return _definition.isWrappingType;
      }
    });
    Object.defineProperty(exports2, "resolveObjMapThunk", {
      enumerable: true,
      get: function() {
        return _definition.resolveObjMapThunk;
      }
    });
    Object.defineProperty(exports2, "resolveReadonlyArrayThunk", {
      enumerable: true,
      get: function() {
        return _definition.resolveReadonlyArrayThunk;
      }
    });
    Object.defineProperty(exports2, "specifiedDirectives", {
      enumerable: true,
      get: function() {
        return _directives.specifiedDirectives;
      }
    });
    Object.defineProperty(exports2, "specifiedScalarTypes", {
      enumerable: true,
      get: function() {
        return _scalars.specifiedScalarTypes;
      }
    });
    Object.defineProperty(exports2, "validateSchema", {
      enumerable: true,
      get: function() {
        return _validate.validateSchema;
      }
    });
    var _schema = require_schema();
    var _definition = require_definition();
    var _directives = require_directives();
    var _scalars = require_scalars();
    var _introspection = require_introspection();
    var _validate = require_validate();
    var _assertName = require_assertName();
  }
});

// node_modules/graphql/language/index.js
var require_language = __commonJS({
  "node_modules/graphql/language/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "BREAK", {
      enumerable: true,
      get: function() {
        return _visitor.BREAK;
      }
    });
    Object.defineProperty(exports2, "DirectiveLocation", {
      enumerable: true,
      get: function() {
        return _directiveLocation.DirectiveLocation;
      }
    });
    Object.defineProperty(exports2, "Kind", {
      enumerable: true,
      get: function() {
        return _kinds.Kind;
      }
    });
    Object.defineProperty(exports2, "Lexer", {
      enumerable: true,
      get: function() {
        return _lexer.Lexer;
      }
    });
    Object.defineProperty(exports2, "Location", {
      enumerable: true,
      get: function() {
        return _ast.Location;
      }
    });
    Object.defineProperty(exports2, "OperationTypeNode", {
      enumerable: true,
      get: function() {
        return _ast.OperationTypeNode;
      }
    });
    Object.defineProperty(exports2, "Source", {
      enumerable: true,
      get: function() {
        return _source.Source;
      }
    });
    Object.defineProperty(exports2, "Token", {
      enumerable: true,
      get: function() {
        return _ast.Token;
      }
    });
    Object.defineProperty(exports2, "TokenKind", {
      enumerable: true,
      get: function() {
        return _tokenKind.TokenKind;
      }
    });
    Object.defineProperty(exports2, "getEnterLeaveForKind", {
      enumerable: true,
      get: function() {
        return _visitor.getEnterLeaveForKind;
      }
    });
    Object.defineProperty(exports2, "getLocation", {
      enumerable: true,
      get: function() {
        return _location.getLocation;
      }
    });
    Object.defineProperty(exports2, "getVisitFn", {
      enumerable: true,
      get: function() {
        return _visitor.getVisitFn;
      }
    });
    Object.defineProperty(exports2, "isConstValueNode", {
      enumerable: true,
      get: function() {
        return _predicates.isConstValueNode;
      }
    });
    Object.defineProperty(exports2, "isDefinitionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isExecutableDefinitionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isExecutableDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isSelectionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isSelectionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeDefinitionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isTypeDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeExtensionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isTypeExtensionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeNode", {
      enumerable: true,
      get: function() {
        return _predicates.isTypeNode;
      }
    });
    Object.defineProperty(exports2, "isTypeSystemDefinitionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isTypeSystemDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeSystemExtensionNode", {
      enumerable: true,
      get: function() {
        return _predicates.isTypeSystemExtensionNode;
      }
    });
    Object.defineProperty(exports2, "isValueNode", {
      enumerable: true,
      get: function() {
        return _predicates.isValueNode;
      }
    });
    Object.defineProperty(exports2, "parse", {
      enumerable: true,
      get: function() {
        return _parser.parse;
      }
    });
    Object.defineProperty(exports2, "parseConstValue", {
      enumerable: true,
      get: function() {
        return _parser.parseConstValue;
      }
    });
    Object.defineProperty(exports2, "parseType", {
      enumerable: true,
      get: function() {
        return _parser.parseType;
      }
    });
    Object.defineProperty(exports2, "parseValue", {
      enumerable: true,
      get: function() {
        return _parser.parseValue;
      }
    });
    Object.defineProperty(exports2, "print", {
      enumerable: true,
      get: function() {
        return _printer.print;
      }
    });
    Object.defineProperty(exports2, "printLocation", {
      enumerable: true,
      get: function() {
        return _printLocation.printLocation;
      }
    });
    Object.defineProperty(exports2, "printSourceLocation", {
      enumerable: true,
      get: function() {
        return _printLocation.printSourceLocation;
      }
    });
    Object.defineProperty(exports2, "visit", {
      enumerable: true,
      get: function() {
        return _visitor.visit;
      }
    });
    Object.defineProperty(exports2, "visitInParallel", {
      enumerable: true,
      get: function() {
        return _visitor.visitInParallel;
      }
    });
    var _source = require_source();
    var _location = require_location();
    var _printLocation = require_printLocation();
    var _kinds = require_kinds();
    var _tokenKind = require_tokenKind();
    var _lexer = require_lexer();
    var _parser = require_parser();
    var _printer = require_printer();
    var _visitor = require_visitor();
    var _ast = require_ast();
    var _predicates = require_predicates();
    var _directiveLocation = require_directiveLocation();
  }
});

// node_modules/graphql/jsutils/isAsyncIterable.js
var require_isAsyncIterable = __commonJS({
  "node_modules/graphql/jsutils/isAsyncIterable.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.isAsyncIterable = isAsyncIterable;
    function isAsyncIterable(maybeAsyncIterable) {
      return typeof (maybeAsyncIterable === null || maybeAsyncIterable === void 0 ? void 0 : maybeAsyncIterable[Symbol.asyncIterator]) === "function";
    }
  }
});

// node_modules/graphql/execution/mapAsyncIterator.js
var require_mapAsyncIterator = __commonJS({
  "node_modules/graphql/execution/mapAsyncIterator.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.mapAsyncIterator = mapAsyncIterator;
    function mapAsyncIterator(iterable, callback) {
      const iterator = iterable[Symbol.asyncIterator]();
      async function mapResult(result) {
        if (result.done) {
          return result;
        }
        try {
          return {
            value: await callback(result.value),
            done: false
          };
        } catch (error) {
          if (typeof iterator.return === "function") {
            try {
              await iterator.return();
            } catch (_e) {
            }
          }
          throw error;
        }
      }
      return {
        async next() {
          return mapResult(await iterator.next());
        },
        async return() {
          return typeof iterator.return === "function" ? mapResult(await iterator.return()) : {
            value: void 0,
            done: true
          };
        },
        async throw(error) {
          if (typeof iterator.throw === "function") {
            return mapResult(await iterator.throw(error));
          }
          throw error;
        },
        [Symbol.asyncIterator]() {
          return this;
        }
      };
    }
  }
});

// node_modules/graphql/execution/subscribe.js
var require_subscribe = __commonJS({
  "node_modules/graphql/execution/subscribe.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.createSourceEventStream = createSourceEventStream;
    exports2.subscribe = subscribe;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _isAsyncIterable = require_isAsyncIterable();
    var _Path = require_Path();
    var _GraphQLError = require_GraphQLError();
    var _locatedError = require_locatedError();
    var _collectFields = require_collectFields();
    var _execute = require_execute();
    var _mapAsyncIterator = require_mapAsyncIterator();
    var _values = require_values();
    async function subscribe(args) {
      arguments.length < 2 || (0, _devAssert.devAssert)(
        false,
        "graphql@16 dropped long-deprecated support for positional arguments, please pass an object instead."
      );
      const resultOrStream = await createSourceEventStream(args);
      if (!(0, _isAsyncIterable.isAsyncIterable)(resultOrStream)) {
        return resultOrStream;
      }
      const mapSourceToResponse = (payload) => (0, _execute.execute)({ ...args, rootValue: payload });
      return (0, _mapAsyncIterator.mapAsyncIterator)(
        resultOrStream,
        mapSourceToResponse
      );
    }
    function toNormalizedArgs(args) {
      const firstArg = args[0];
      if (firstArg && "document" in firstArg) {
        return firstArg;
      }
      return {
        schema: firstArg,
        // FIXME: when underlying TS bug fixed, see https://github.com/microsoft/TypeScript/issues/31613
        document: args[1],
        rootValue: args[2],
        contextValue: args[3],
        variableValues: args[4],
        operationName: args[5],
        subscribeFieldResolver: args[6]
      };
    }
    async function createSourceEventStream(...rawArgs) {
      const args = toNormalizedArgs(rawArgs);
      const { schema, document, variableValues } = args;
      (0, _execute.assertValidExecutionArguments)(schema, document, variableValues);
      const exeContext = (0, _execute.buildExecutionContext)(args);
      if (!("schema" in exeContext)) {
        return {
          errors: exeContext
        };
      }
      try {
        const eventStream = await executeSubscription(exeContext);
        if (!(0, _isAsyncIterable.isAsyncIterable)(eventStream)) {
          throw new Error(
            `Subscription field must return Async Iterable. Received: ${(0, _inspect.inspect)(eventStream)}.`
          );
        }
        return eventStream;
      } catch (error) {
        if (error instanceof _GraphQLError.GraphQLError) {
          return {
            errors: [error]
          };
        }
        throw error;
      }
    }
    async function executeSubscription(exeContext) {
      const { schema, fragments, operation, variableValues, rootValue } = exeContext;
      const rootType = schema.getSubscriptionType();
      if (rootType == null) {
        throw new _GraphQLError.GraphQLError(
          "Schema is not configured to execute subscription operation.",
          {
            nodes: operation
          }
        );
      }
      const rootFields = (0, _collectFields.collectFields)(
        schema,
        fragments,
        variableValues,
        rootType,
        operation.selectionSet
      );
      const [responseName, fieldNodes] = [...rootFields.entries()][0];
      const fieldDef = (0, _execute.getFieldDef)(schema, rootType, fieldNodes[0]);
      if (!fieldDef) {
        const fieldName = fieldNodes[0].name.value;
        throw new _GraphQLError.GraphQLError(
          `The subscription field "${fieldName}" is not defined.`,
          {
            nodes: fieldNodes
          }
        );
      }
      const path2 = (0, _Path.addPath)(void 0, responseName, rootType.name);
      const info = (0, _execute.buildResolveInfo)(
        exeContext,
        fieldDef,
        fieldNodes,
        rootType,
        path2
      );
      try {
        var _fieldDef$subscribe;
        const args = (0, _values.getArgumentValues)(
          fieldDef,
          fieldNodes[0],
          variableValues
        );
        const contextValue = exeContext.contextValue;
        const resolveFn = (_fieldDef$subscribe = fieldDef.subscribe) !== null && _fieldDef$subscribe !== void 0 ? _fieldDef$subscribe : exeContext.subscribeFieldResolver;
        const eventStream = await resolveFn(rootValue, args, contextValue, info);
        if (eventStream instanceof Error) {
          throw eventStream;
        }
        return eventStream;
      } catch (error) {
        throw (0, _locatedError.locatedError)(
          error,
          fieldNodes,
          (0, _Path.pathToArray)(path2)
        );
      }
    }
  }
});

// node_modules/graphql/execution/index.js
var require_execution = __commonJS({
  "node_modules/graphql/execution/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "createSourceEventStream", {
      enumerable: true,
      get: function() {
        return _subscribe.createSourceEventStream;
      }
    });
    Object.defineProperty(exports2, "defaultFieldResolver", {
      enumerable: true,
      get: function() {
        return _execute.defaultFieldResolver;
      }
    });
    Object.defineProperty(exports2, "defaultTypeResolver", {
      enumerable: true,
      get: function() {
        return _execute.defaultTypeResolver;
      }
    });
    Object.defineProperty(exports2, "execute", {
      enumerable: true,
      get: function() {
        return _execute.execute;
      }
    });
    Object.defineProperty(exports2, "executeSync", {
      enumerable: true,
      get: function() {
        return _execute.executeSync;
      }
    });
    Object.defineProperty(exports2, "getArgumentValues", {
      enumerable: true,
      get: function() {
        return _values.getArgumentValues;
      }
    });
    Object.defineProperty(exports2, "getDirectiveValues", {
      enumerable: true,
      get: function() {
        return _values.getDirectiveValues;
      }
    });
    Object.defineProperty(exports2, "getVariableValues", {
      enumerable: true,
      get: function() {
        return _values.getVariableValues;
      }
    });
    Object.defineProperty(exports2, "responsePathAsArray", {
      enumerable: true,
      get: function() {
        return _Path.pathToArray;
      }
    });
    Object.defineProperty(exports2, "subscribe", {
      enumerable: true,
      get: function() {
        return _subscribe.subscribe;
      }
    });
    var _Path = require_Path();
    var _execute = require_execute();
    var _subscribe = require_subscribe();
    var _values = require_values();
  }
});

// node_modules/graphql/validation/rules/custom/NoDeprecatedCustomRule.js
var require_NoDeprecatedCustomRule = __commonJS({
  "node_modules/graphql/validation/rules/custom/NoDeprecatedCustomRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.NoDeprecatedCustomRule = NoDeprecatedCustomRule;
    var _invariant = require_invariant();
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    function NoDeprecatedCustomRule(context) {
      return {
        Field(node) {
          const fieldDef = context.getFieldDef();
          const deprecationReason = fieldDef === null || fieldDef === void 0 ? void 0 : fieldDef.deprecationReason;
          if (fieldDef && deprecationReason != null) {
            const parentType = context.getParentType();
            parentType != null || (0, _invariant.invariant)(false);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `The field ${parentType.name}.${fieldDef.name} is deprecated. ${deprecationReason}`,
                {
                  nodes: node
                }
              )
            );
          }
        },
        Argument(node) {
          const argDef = context.getArgument();
          const deprecationReason = argDef === null || argDef === void 0 ? void 0 : argDef.deprecationReason;
          if (argDef && deprecationReason != null) {
            const directiveDef = context.getDirective();
            if (directiveDef != null) {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Directive "@${directiveDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
                  {
                    nodes: node
                  }
                )
              );
            } else {
              const parentType = context.getParentType();
              const fieldDef = context.getFieldDef();
              parentType != null && fieldDef != null || (0, _invariant.invariant)(false);
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `Field "${parentType.name}.${fieldDef.name}" argument "${argDef.name}" is deprecated. ${deprecationReason}`,
                  {
                    nodes: node
                  }
                )
              );
            }
          }
        },
        ObjectField(node) {
          const inputObjectDef = (0, _definition.getNamedType)(
            context.getParentInputType()
          );
          if ((0, _definition.isInputObjectType)(inputObjectDef)) {
            const inputFieldDef = inputObjectDef.getFields()[node.name.value];
            const deprecationReason = inputFieldDef === null || inputFieldDef === void 0 ? void 0 : inputFieldDef.deprecationReason;
            if (deprecationReason != null) {
              context.reportError(
                new _GraphQLError.GraphQLError(
                  `The input field ${inputObjectDef.name}.${inputFieldDef.name} is deprecated. ${deprecationReason}`,
                  {
                    nodes: node
                  }
                )
              );
            }
          }
        },
        EnumValue(node) {
          const enumValueDef = context.getEnumValue();
          const deprecationReason = enumValueDef === null || enumValueDef === void 0 ? void 0 : enumValueDef.deprecationReason;
          if (enumValueDef && deprecationReason != null) {
            const enumTypeDef = (0, _definition.getNamedType)(
              context.getInputType()
            );
            enumTypeDef != null || (0, _invariant.invariant)(false);
            context.reportError(
              new _GraphQLError.GraphQLError(
                `The enum value "${enumTypeDef.name}.${enumValueDef.name}" is deprecated. ${deprecationReason}`,
                {
                  nodes: node
                }
              )
            );
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/rules/custom/NoSchemaIntrospectionCustomRule.js
var require_NoSchemaIntrospectionCustomRule = __commonJS({
  "node_modules/graphql/validation/rules/custom/NoSchemaIntrospectionCustomRule.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.NoSchemaIntrospectionCustomRule = NoSchemaIntrospectionCustomRule;
    var _GraphQLError = require_GraphQLError();
    var _definition = require_definition();
    var _introspection = require_introspection();
    function NoSchemaIntrospectionCustomRule(context) {
      return {
        Field(node) {
          const type = (0, _definition.getNamedType)(context.getType());
          if (type && (0, _introspection.isIntrospectionType)(type)) {
            context.reportError(
              new _GraphQLError.GraphQLError(
                `GraphQL introspection has been disabled, but the requested query contained the field "${node.name.value}".`,
                {
                  nodes: node
                }
              )
            );
          }
        }
      };
    }
  }
});

// node_modules/graphql/validation/index.js
var require_validation = __commonJS({
  "node_modules/graphql/validation/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "ExecutableDefinitionsRule", {
      enumerable: true,
      get: function() {
        return _ExecutableDefinitionsRule.ExecutableDefinitionsRule;
      }
    });
    Object.defineProperty(exports2, "FieldsOnCorrectTypeRule", {
      enumerable: true,
      get: function() {
        return _FieldsOnCorrectTypeRule.FieldsOnCorrectTypeRule;
      }
    });
    Object.defineProperty(exports2, "FragmentsOnCompositeTypesRule", {
      enumerable: true,
      get: function() {
        return _FragmentsOnCompositeTypesRule.FragmentsOnCompositeTypesRule;
      }
    });
    Object.defineProperty(exports2, "KnownArgumentNamesRule", {
      enumerable: true,
      get: function() {
        return _KnownArgumentNamesRule.KnownArgumentNamesRule;
      }
    });
    Object.defineProperty(exports2, "KnownDirectivesRule", {
      enumerable: true,
      get: function() {
        return _KnownDirectivesRule.KnownDirectivesRule;
      }
    });
    Object.defineProperty(exports2, "KnownFragmentNamesRule", {
      enumerable: true,
      get: function() {
        return _KnownFragmentNamesRule.KnownFragmentNamesRule;
      }
    });
    Object.defineProperty(exports2, "KnownTypeNamesRule", {
      enumerable: true,
      get: function() {
        return _KnownTypeNamesRule.KnownTypeNamesRule;
      }
    });
    Object.defineProperty(exports2, "LoneAnonymousOperationRule", {
      enumerable: true,
      get: function() {
        return _LoneAnonymousOperationRule.LoneAnonymousOperationRule;
      }
    });
    Object.defineProperty(exports2, "LoneSchemaDefinitionRule", {
      enumerable: true,
      get: function() {
        return _LoneSchemaDefinitionRule.LoneSchemaDefinitionRule;
      }
    });
    Object.defineProperty(exports2, "MaxIntrospectionDepthRule", {
      enumerable: true,
      get: function() {
        return _MaxIntrospectionDepthRule.MaxIntrospectionDepthRule;
      }
    });
    Object.defineProperty(exports2, "NoDeprecatedCustomRule", {
      enumerable: true,
      get: function() {
        return _NoDeprecatedCustomRule.NoDeprecatedCustomRule;
      }
    });
    Object.defineProperty(exports2, "NoFragmentCyclesRule", {
      enumerable: true,
      get: function() {
        return _NoFragmentCyclesRule.NoFragmentCyclesRule;
      }
    });
    Object.defineProperty(exports2, "NoSchemaIntrospectionCustomRule", {
      enumerable: true,
      get: function() {
        return _NoSchemaIntrospectionCustomRule.NoSchemaIntrospectionCustomRule;
      }
    });
    Object.defineProperty(exports2, "NoUndefinedVariablesRule", {
      enumerable: true,
      get: function() {
        return _NoUndefinedVariablesRule.NoUndefinedVariablesRule;
      }
    });
    Object.defineProperty(exports2, "NoUnusedFragmentsRule", {
      enumerable: true,
      get: function() {
        return _NoUnusedFragmentsRule.NoUnusedFragmentsRule;
      }
    });
    Object.defineProperty(exports2, "NoUnusedVariablesRule", {
      enumerable: true,
      get: function() {
        return _NoUnusedVariablesRule.NoUnusedVariablesRule;
      }
    });
    Object.defineProperty(exports2, "OverlappingFieldsCanBeMergedRule", {
      enumerable: true,
      get: function() {
        return _OverlappingFieldsCanBeMergedRule.OverlappingFieldsCanBeMergedRule;
      }
    });
    Object.defineProperty(exports2, "PossibleFragmentSpreadsRule", {
      enumerable: true,
      get: function() {
        return _PossibleFragmentSpreadsRule.PossibleFragmentSpreadsRule;
      }
    });
    Object.defineProperty(exports2, "PossibleTypeExtensionsRule", {
      enumerable: true,
      get: function() {
        return _PossibleTypeExtensionsRule.PossibleTypeExtensionsRule;
      }
    });
    Object.defineProperty(exports2, "ProvidedRequiredArgumentsRule", {
      enumerable: true,
      get: function() {
        return _ProvidedRequiredArgumentsRule.ProvidedRequiredArgumentsRule;
      }
    });
    Object.defineProperty(exports2, "ScalarLeafsRule", {
      enumerable: true,
      get: function() {
        return _ScalarLeafsRule.ScalarLeafsRule;
      }
    });
    Object.defineProperty(exports2, "SingleFieldSubscriptionsRule", {
      enumerable: true,
      get: function() {
        return _SingleFieldSubscriptionsRule.SingleFieldSubscriptionsRule;
      }
    });
    Object.defineProperty(exports2, "UniqueArgumentDefinitionNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueArgumentDefinitionNamesRule.UniqueArgumentDefinitionNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueArgumentNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueArgumentNamesRule.UniqueArgumentNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueDirectiveNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueDirectiveNamesRule.UniqueDirectiveNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueDirectivesPerLocationRule", {
      enumerable: true,
      get: function() {
        return _UniqueDirectivesPerLocationRule.UniqueDirectivesPerLocationRule;
      }
    });
    Object.defineProperty(exports2, "UniqueEnumValueNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueEnumValueNamesRule.UniqueEnumValueNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueFieldDefinitionNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueFieldDefinitionNamesRule.UniqueFieldDefinitionNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueFragmentNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueFragmentNamesRule.UniqueFragmentNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueInputFieldNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueInputFieldNamesRule.UniqueInputFieldNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueOperationNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueOperationNamesRule.UniqueOperationNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueOperationTypesRule", {
      enumerable: true,
      get: function() {
        return _UniqueOperationTypesRule.UniqueOperationTypesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueTypeNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueTypeNamesRule.UniqueTypeNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueVariableNamesRule", {
      enumerable: true,
      get: function() {
        return _UniqueVariableNamesRule.UniqueVariableNamesRule;
      }
    });
    Object.defineProperty(exports2, "ValidationContext", {
      enumerable: true,
      get: function() {
        return _ValidationContext.ValidationContext;
      }
    });
    Object.defineProperty(exports2, "ValuesOfCorrectTypeRule", {
      enumerable: true,
      get: function() {
        return _ValuesOfCorrectTypeRule.ValuesOfCorrectTypeRule;
      }
    });
    Object.defineProperty(exports2, "VariablesAreInputTypesRule", {
      enumerable: true,
      get: function() {
        return _VariablesAreInputTypesRule.VariablesAreInputTypesRule;
      }
    });
    Object.defineProperty(exports2, "VariablesInAllowedPositionRule", {
      enumerable: true,
      get: function() {
        return _VariablesInAllowedPositionRule.VariablesInAllowedPositionRule;
      }
    });
    Object.defineProperty(exports2, "recommendedRules", {
      enumerable: true,
      get: function() {
        return _specifiedRules.recommendedRules;
      }
    });
    Object.defineProperty(exports2, "specifiedRules", {
      enumerable: true,
      get: function() {
        return _specifiedRules.specifiedRules;
      }
    });
    Object.defineProperty(exports2, "validate", {
      enumerable: true,
      get: function() {
        return _validate.validate;
      }
    });
    var _validate = require_validate2();
    var _ValidationContext = require_ValidationContext();
    var _specifiedRules = require_specifiedRules();
    var _ExecutableDefinitionsRule = require_ExecutableDefinitionsRule();
    var _FieldsOnCorrectTypeRule = require_FieldsOnCorrectTypeRule();
    var _FragmentsOnCompositeTypesRule = require_FragmentsOnCompositeTypesRule();
    var _KnownArgumentNamesRule = require_KnownArgumentNamesRule();
    var _KnownDirectivesRule = require_KnownDirectivesRule();
    var _KnownFragmentNamesRule = require_KnownFragmentNamesRule();
    var _KnownTypeNamesRule = require_KnownTypeNamesRule();
    var _LoneAnonymousOperationRule = require_LoneAnonymousOperationRule();
    var _NoFragmentCyclesRule = require_NoFragmentCyclesRule();
    var _NoUndefinedVariablesRule = require_NoUndefinedVariablesRule();
    var _NoUnusedFragmentsRule = require_NoUnusedFragmentsRule();
    var _NoUnusedVariablesRule = require_NoUnusedVariablesRule();
    var _OverlappingFieldsCanBeMergedRule = require_OverlappingFieldsCanBeMergedRule();
    var _PossibleFragmentSpreadsRule = require_PossibleFragmentSpreadsRule();
    var _ProvidedRequiredArgumentsRule = require_ProvidedRequiredArgumentsRule();
    var _ScalarLeafsRule = require_ScalarLeafsRule();
    var _SingleFieldSubscriptionsRule = require_SingleFieldSubscriptionsRule();
    var _UniqueArgumentNamesRule = require_UniqueArgumentNamesRule();
    var _UniqueDirectivesPerLocationRule = require_UniqueDirectivesPerLocationRule();
    var _UniqueFragmentNamesRule = require_UniqueFragmentNamesRule();
    var _UniqueInputFieldNamesRule = require_UniqueInputFieldNamesRule();
    var _UniqueOperationNamesRule = require_UniqueOperationNamesRule();
    var _UniqueVariableNamesRule = require_UniqueVariableNamesRule();
    var _ValuesOfCorrectTypeRule = require_ValuesOfCorrectTypeRule();
    var _VariablesAreInputTypesRule = require_VariablesAreInputTypesRule();
    var _VariablesInAllowedPositionRule = require_VariablesInAllowedPositionRule();
    var _MaxIntrospectionDepthRule = require_MaxIntrospectionDepthRule();
    var _LoneSchemaDefinitionRule = require_LoneSchemaDefinitionRule();
    var _UniqueOperationTypesRule = require_UniqueOperationTypesRule();
    var _UniqueTypeNamesRule = require_UniqueTypeNamesRule();
    var _UniqueEnumValueNamesRule = require_UniqueEnumValueNamesRule();
    var _UniqueFieldDefinitionNamesRule = require_UniqueFieldDefinitionNamesRule();
    var _UniqueArgumentDefinitionNamesRule = require_UniqueArgumentDefinitionNamesRule();
    var _UniqueDirectiveNamesRule = require_UniqueDirectiveNamesRule();
    var _PossibleTypeExtensionsRule = require_PossibleTypeExtensionsRule();
    var _NoDeprecatedCustomRule = require_NoDeprecatedCustomRule();
    var _NoSchemaIntrospectionCustomRule = require_NoSchemaIntrospectionCustomRule();
  }
});

// node_modules/graphql/error/index.js
var require_error = __commonJS({
  "node_modules/graphql/error/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "GraphQLError", {
      enumerable: true,
      get: function() {
        return _GraphQLError.GraphQLError;
      }
    });
    Object.defineProperty(exports2, "formatError", {
      enumerable: true,
      get: function() {
        return _GraphQLError.formatError;
      }
    });
    Object.defineProperty(exports2, "locatedError", {
      enumerable: true,
      get: function() {
        return _locatedError.locatedError;
      }
    });
    Object.defineProperty(exports2, "printError", {
      enumerable: true,
      get: function() {
        return _GraphQLError.printError;
      }
    });
    Object.defineProperty(exports2, "syntaxError", {
      enumerable: true,
      get: function() {
        return _syntaxError.syntaxError;
      }
    });
    var _GraphQLError = require_GraphQLError();
    var _syntaxError = require_syntaxError();
    var _locatedError = require_locatedError();
  }
});

// node_modules/graphql/utilities/getIntrospectionQuery.js
var require_getIntrospectionQuery = __commonJS({
  "node_modules/graphql/utilities/getIntrospectionQuery.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.getIntrospectionQuery = getIntrospectionQuery;
    function getIntrospectionQuery(options) {
      const optionsWithDefault = {
        descriptions: true,
        specifiedByUrl: false,
        directiveIsRepeatable: false,
        schemaDescription: false,
        inputValueDeprecation: false,
        oneOf: false,
        ...options
      };
      const descriptions = optionsWithDefault.descriptions ? "description" : "";
      const specifiedByUrl = optionsWithDefault.specifiedByUrl ? "specifiedByURL" : "";
      const directiveIsRepeatable = optionsWithDefault.directiveIsRepeatable ? "isRepeatable" : "";
      const schemaDescription = optionsWithDefault.schemaDescription ? descriptions : "";
      function inputDeprecation(str) {
        return optionsWithDefault.inputValueDeprecation ? str : "";
      }
      const oneOf = optionsWithDefault.oneOf ? "isOneOf" : "";
      return `
    query IntrospectionQuery {
      __schema {
        ${schemaDescription}
        queryType { name }
        mutationType { name }
        subscriptionType { name }
        types {
          ...FullType
        }
        directives {
          name
          ${descriptions}
          ${directiveIsRepeatable}
          locations
          args${inputDeprecation("(includeDeprecated: true)")} {
            ...InputValue
          }
        }
      }
    }

    fragment FullType on __Type {
      kind
      name
      ${descriptions}
      ${specifiedByUrl}
      ${oneOf}
      fields(includeDeprecated: true) {
        name
        ${descriptions}
        args${inputDeprecation("(includeDeprecated: true)")} {
          ...InputValue
        }
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }
      inputFields${inputDeprecation("(includeDeprecated: true)")} {
        ...InputValue
      }
      interfaces {
        ...TypeRef
      }
      enumValues(includeDeprecated: true) {
        name
        ${descriptions}
        isDeprecated
        deprecationReason
      }
      possibleTypes {
        ...TypeRef
      }
    }

    fragment InputValue on __InputValue {
      name
      ${descriptions}
      type { ...TypeRef }
      defaultValue
      ${inputDeprecation("isDeprecated")}
      ${inputDeprecation("deprecationReason")}
    }

    fragment TypeRef on __Type {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
    }
  }
});

// node_modules/graphql/utilities/getOperationAST.js
var require_getOperationAST = __commonJS({
  "node_modules/graphql/utilities/getOperationAST.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.getOperationAST = getOperationAST;
    var _kinds = require_kinds();
    function getOperationAST(documentAST, operationName) {
      let operation = null;
      for (const definition of documentAST.definitions) {
        if (definition.kind === _kinds.Kind.OPERATION_DEFINITION) {
          var _definition$name;
          if (operationName == null) {
            if (operation) {
              return null;
            }
            operation = definition;
          } else if (((_definition$name = definition.name) === null || _definition$name === void 0 ? void 0 : _definition$name.value) === operationName) {
            return definition;
          }
        }
      }
      return operation;
    }
  }
});

// node_modules/graphql/utilities/getOperationRootType.js
var require_getOperationRootType = __commonJS({
  "node_modules/graphql/utilities/getOperationRootType.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.getOperationRootType = getOperationRootType;
    var _GraphQLError = require_GraphQLError();
    function getOperationRootType(schema, operation) {
      if (operation.operation === "query") {
        const queryType = schema.getQueryType();
        if (!queryType) {
          throw new _GraphQLError.GraphQLError(
            "Schema does not define the required query root type.",
            {
              nodes: operation
            }
          );
        }
        return queryType;
      }
      if (operation.operation === "mutation") {
        const mutationType = schema.getMutationType();
        if (!mutationType) {
          throw new _GraphQLError.GraphQLError(
            "Schema is not configured for mutations.",
            {
              nodes: operation
            }
          );
        }
        return mutationType;
      }
      if (operation.operation === "subscription") {
        const subscriptionType = schema.getSubscriptionType();
        if (!subscriptionType) {
          throw new _GraphQLError.GraphQLError(
            "Schema is not configured for subscriptions.",
            {
              nodes: operation
            }
          );
        }
        return subscriptionType;
      }
      throw new _GraphQLError.GraphQLError(
        "Can only have query, mutation and subscription operations.",
        {
          nodes: operation
        }
      );
    }
  }
});

// node_modules/graphql/utilities/introspectionFromSchema.js
var require_introspectionFromSchema = __commonJS({
  "node_modules/graphql/utilities/introspectionFromSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.introspectionFromSchema = introspectionFromSchema;
    var _invariant = require_invariant();
    var _parser = require_parser();
    var _execute = require_execute();
    var _getIntrospectionQuery = require_getIntrospectionQuery();
    function introspectionFromSchema(schema, options) {
      const optionsWithDefaults = {
        specifiedByUrl: true,
        directiveIsRepeatable: true,
        schemaDescription: true,
        inputValueDeprecation: true,
        oneOf: true,
        ...options
      };
      const document = (0, _parser.parse)(
        (0, _getIntrospectionQuery.getIntrospectionQuery)(optionsWithDefaults)
      );
      const result = (0, _execute.executeSync)({
        schema,
        document
      });
      !result.errors && result.data || (0, _invariant.invariant)(false);
      return result.data;
    }
  }
});

// node_modules/graphql/utilities/buildClientSchema.js
var require_buildClientSchema = __commonJS({
  "node_modules/graphql/utilities/buildClientSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.buildClientSchema = buildClientSchema;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _isObjectLike = require_isObjectLike();
    var _keyValMap = require_keyValMap();
    var _parser = require_parser();
    var _definition = require_definition();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _scalars = require_scalars();
    var _schema = require_schema();
    var _valueFromAST = require_valueFromAST();
    function buildClientSchema(introspection, options) {
      (0, _isObjectLike.isObjectLike)(introspection) && (0, _isObjectLike.isObjectLike)(introspection.__schema) || (0, _devAssert.devAssert)(
        false,
        `Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ${(0, _inspect.inspect)(introspection)}.`
      );
      const schemaIntrospection = introspection.__schema;
      const typeMap = (0, _keyValMap.keyValMap)(
        schemaIntrospection.types,
        (typeIntrospection) => typeIntrospection.name,
        (typeIntrospection) => buildType(typeIntrospection)
      );
      for (const stdType of [
        ..._scalars.specifiedScalarTypes,
        ..._introspection.introspectionTypes
      ]) {
        if (typeMap[stdType.name]) {
          typeMap[stdType.name] = stdType;
        }
      }
      const queryType = schemaIntrospection.queryType ? getObjectType(schemaIntrospection.queryType) : null;
      const mutationType = schemaIntrospection.mutationType ? getObjectType(schemaIntrospection.mutationType) : null;
      const subscriptionType = schemaIntrospection.subscriptionType ? getObjectType(schemaIntrospection.subscriptionType) : null;
      const directives = schemaIntrospection.directives ? schemaIntrospection.directives.map(buildDirective) : [];
      return new _schema.GraphQLSchema({
        description: schemaIntrospection.description,
        query: queryType,
        mutation: mutationType,
        subscription: subscriptionType,
        types: Object.values(typeMap),
        directives,
        assumeValid: options === null || options === void 0 ? void 0 : options.assumeValid
      });
      function getType(typeRef) {
        if (typeRef.kind === _introspection.TypeKind.LIST) {
          const itemRef = typeRef.ofType;
          if (!itemRef) {
            throw new Error("Decorated type deeper than introspection query.");
          }
          return new _definition.GraphQLList(getType(itemRef));
        }
        if (typeRef.kind === _introspection.TypeKind.NON_NULL) {
          const nullableRef = typeRef.ofType;
          if (!nullableRef) {
            throw new Error("Decorated type deeper than introspection query.");
          }
          const nullableType = getType(nullableRef);
          return new _definition.GraphQLNonNull(
            (0, _definition.assertNullableType)(nullableType)
          );
        }
        return getNamedType(typeRef);
      }
      function getNamedType(typeRef) {
        const typeName = typeRef.name;
        if (!typeName) {
          throw new Error(
            `Unknown type reference: ${(0, _inspect.inspect)(typeRef)}.`
          );
        }
        const type = typeMap[typeName];
        if (!type) {
          throw new Error(
            `Invalid or incomplete schema, unknown type: ${typeName}. Ensure that a full introspection query is used in order to build a client schema.`
          );
        }
        return type;
      }
      function getObjectType(typeRef) {
        return (0, _definition.assertObjectType)(getNamedType(typeRef));
      }
      function getInterfaceType(typeRef) {
        return (0, _definition.assertInterfaceType)(getNamedType(typeRef));
      }
      function buildType(type) {
        if (type != null && type.name != null && type.kind != null) {
          switch (type.kind) {
            case _introspection.TypeKind.SCALAR:
              return buildScalarDef(type);
            case _introspection.TypeKind.OBJECT:
              return buildObjectDef(type);
            case _introspection.TypeKind.INTERFACE:
              return buildInterfaceDef(type);
            case _introspection.TypeKind.UNION:
              return buildUnionDef(type);
            case _introspection.TypeKind.ENUM:
              return buildEnumDef(type);
            case _introspection.TypeKind.INPUT_OBJECT:
              return buildInputObjectDef(type);
          }
        }
        const typeStr = (0, _inspect.inspect)(type);
        throw new Error(
          `Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: ${typeStr}.`
        );
      }
      function buildScalarDef(scalarIntrospection) {
        return new _definition.GraphQLScalarType({
          name: scalarIntrospection.name,
          description: scalarIntrospection.description,
          specifiedByURL: scalarIntrospection.specifiedByURL
        });
      }
      function buildImplementationsList(implementingIntrospection) {
        if (implementingIntrospection.interfaces === null && implementingIntrospection.kind === _introspection.TypeKind.INTERFACE) {
          return [];
        }
        if (!implementingIntrospection.interfaces) {
          const implementingIntrospectionStr = (0, _inspect.inspect)(
            implementingIntrospection
          );
          throw new Error(
            `Introspection result missing interfaces: ${implementingIntrospectionStr}.`
          );
        }
        return implementingIntrospection.interfaces.map(getInterfaceType);
      }
      function buildObjectDef(objectIntrospection) {
        return new _definition.GraphQLObjectType({
          name: objectIntrospection.name,
          description: objectIntrospection.description,
          interfaces: () => buildImplementationsList(objectIntrospection),
          fields: () => buildFieldDefMap(objectIntrospection)
        });
      }
      function buildInterfaceDef(interfaceIntrospection) {
        return new _definition.GraphQLInterfaceType({
          name: interfaceIntrospection.name,
          description: interfaceIntrospection.description,
          interfaces: () => buildImplementationsList(interfaceIntrospection),
          fields: () => buildFieldDefMap(interfaceIntrospection)
        });
      }
      function buildUnionDef(unionIntrospection) {
        if (!unionIntrospection.possibleTypes) {
          const unionIntrospectionStr = (0, _inspect.inspect)(unionIntrospection);
          throw new Error(
            `Introspection result missing possibleTypes: ${unionIntrospectionStr}.`
          );
        }
        return new _definition.GraphQLUnionType({
          name: unionIntrospection.name,
          description: unionIntrospection.description,
          types: () => unionIntrospection.possibleTypes.map(getObjectType)
        });
      }
      function buildEnumDef(enumIntrospection) {
        if (!enumIntrospection.enumValues) {
          const enumIntrospectionStr = (0, _inspect.inspect)(enumIntrospection);
          throw new Error(
            `Introspection result missing enumValues: ${enumIntrospectionStr}.`
          );
        }
        return new _definition.GraphQLEnumType({
          name: enumIntrospection.name,
          description: enumIntrospection.description,
          values: (0, _keyValMap.keyValMap)(
            enumIntrospection.enumValues,
            (valueIntrospection) => valueIntrospection.name,
            (valueIntrospection) => ({
              description: valueIntrospection.description,
              deprecationReason: valueIntrospection.deprecationReason
            })
          )
        });
      }
      function buildInputObjectDef(inputObjectIntrospection) {
        if (!inputObjectIntrospection.inputFields) {
          const inputObjectIntrospectionStr = (0, _inspect.inspect)(
            inputObjectIntrospection
          );
          throw new Error(
            `Introspection result missing inputFields: ${inputObjectIntrospectionStr}.`
          );
        }
        return new _definition.GraphQLInputObjectType({
          name: inputObjectIntrospection.name,
          description: inputObjectIntrospection.description,
          fields: () => buildInputValueDefMap(inputObjectIntrospection.inputFields),
          isOneOf: inputObjectIntrospection.isOneOf
        });
      }
      function buildFieldDefMap(typeIntrospection) {
        if (!typeIntrospection.fields) {
          throw new Error(
            `Introspection result missing fields: ${(0, _inspect.inspect)(
              typeIntrospection
            )}.`
          );
        }
        return (0, _keyValMap.keyValMap)(
          typeIntrospection.fields,
          (fieldIntrospection) => fieldIntrospection.name,
          buildField
        );
      }
      function buildField(fieldIntrospection) {
        const type = getType(fieldIntrospection.type);
        if (!(0, _definition.isOutputType)(type)) {
          const typeStr = (0, _inspect.inspect)(type);
          throw new Error(
            `Introspection must provide output type for fields, but received: ${typeStr}.`
          );
        }
        if (!fieldIntrospection.args) {
          const fieldIntrospectionStr = (0, _inspect.inspect)(fieldIntrospection);
          throw new Error(
            `Introspection result missing field args: ${fieldIntrospectionStr}.`
          );
        }
        return {
          description: fieldIntrospection.description,
          deprecationReason: fieldIntrospection.deprecationReason,
          type,
          args: buildInputValueDefMap(fieldIntrospection.args)
        };
      }
      function buildInputValueDefMap(inputValueIntrospections) {
        return (0, _keyValMap.keyValMap)(
          inputValueIntrospections,
          (inputValue) => inputValue.name,
          buildInputValue
        );
      }
      function buildInputValue(inputValueIntrospection) {
        const type = getType(inputValueIntrospection.type);
        if (!(0, _definition.isInputType)(type)) {
          const typeStr = (0, _inspect.inspect)(type);
          throw new Error(
            `Introspection must provide input type for arguments, but received: ${typeStr}.`
          );
        }
        const defaultValue = inputValueIntrospection.defaultValue != null ? (0, _valueFromAST.valueFromAST)(
          (0, _parser.parseValue)(inputValueIntrospection.defaultValue),
          type
        ) : void 0;
        return {
          description: inputValueIntrospection.description,
          type,
          defaultValue,
          deprecationReason: inputValueIntrospection.deprecationReason
        };
      }
      function buildDirective(directiveIntrospection) {
        if (!directiveIntrospection.args) {
          const directiveIntrospectionStr = (0, _inspect.inspect)(
            directiveIntrospection
          );
          throw new Error(
            `Introspection result missing directive args: ${directiveIntrospectionStr}.`
          );
        }
        if (!directiveIntrospection.locations) {
          const directiveIntrospectionStr = (0, _inspect.inspect)(
            directiveIntrospection
          );
          throw new Error(
            `Introspection result missing directive locations: ${directiveIntrospectionStr}.`
          );
        }
        return new _directives.GraphQLDirective({
          name: directiveIntrospection.name,
          description: directiveIntrospection.description,
          isRepeatable: directiveIntrospection.isRepeatable,
          locations: directiveIntrospection.locations.slice(),
          args: buildInputValueDefMap(directiveIntrospection.args)
        });
      }
    }
  }
});

// node_modules/graphql/utilities/extendSchema.js
var require_extendSchema = __commonJS({
  "node_modules/graphql/utilities/extendSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.extendSchema = extendSchema;
    exports2.extendSchemaImpl = extendSchemaImpl;
    var _devAssert = require_devAssert();
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _keyMap = require_keyMap();
    var _mapValue = require_mapValue();
    var _kinds = require_kinds();
    var _predicates = require_predicates();
    var _definition = require_definition();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _scalars = require_scalars();
    var _schema = require_schema();
    var _validate = require_validate2();
    var _values = require_values();
    var _valueFromAST = require_valueFromAST();
    function extendSchema(schema, documentAST, options) {
      (0, _schema.assertSchema)(schema);
      documentAST != null && documentAST.kind === _kinds.Kind.DOCUMENT || (0, _devAssert.devAssert)(false, "Must provide valid Document AST.");
      if ((options === null || options === void 0 ? void 0 : options.assumeValid) !== true && (options === null || options === void 0 ? void 0 : options.assumeValidSDL) !== true) {
        (0, _validate.assertValidSDLExtension)(documentAST, schema);
      }
      const schemaConfig = schema.toConfig();
      const extendedConfig = extendSchemaImpl(schemaConfig, documentAST, options);
      return schemaConfig === extendedConfig ? schema : new _schema.GraphQLSchema(extendedConfig);
    }
    function extendSchemaImpl(schemaConfig, documentAST, options) {
      var _schemaDef, _schemaDef$descriptio, _schemaDef2, _options$assumeValid;
      const typeDefs = [];
      const typeExtensionsMap = /* @__PURE__ */ Object.create(null);
      const directiveDefs = [];
      let schemaDef;
      const schemaExtensions = [];
      for (const def of documentAST.definitions) {
        if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
          schemaDef = def;
        } else if (def.kind === _kinds.Kind.SCHEMA_EXTENSION) {
          schemaExtensions.push(def);
        } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
          typeDefs.push(def);
        } else if ((0, _predicates.isTypeExtensionNode)(def)) {
          const extendedTypeName = def.name.value;
          const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
          typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
        } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
          directiveDefs.push(def);
        }
      }
      if (Object.keys(typeExtensionsMap).length === 0 && typeDefs.length === 0 && directiveDefs.length === 0 && schemaExtensions.length === 0 && schemaDef == null) {
        return schemaConfig;
      }
      const typeMap = /* @__PURE__ */ Object.create(null);
      for (const existingType of schemaConfig.types) {
        typeMap[existingType.name] = extendNamedType(existingType);
      }
      for (const typeNode of typeDefs) {
        var _stdTypeMap$name;
        const name = typeNode.name.value;
        typeMap[name] = (_stdTypeMap$name = stdTypeMap[name]) !== null && _stdTypeMap$name !== void 0 ? _stdTypeMap$name : buildType(typeNode);
      }
      const operationTypes = {
        // Get the extended root operation types.
        query: schemaConfig.query && replaceNamedType(schemaConfig.query),
        mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
        subscription: schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
        // Then, incorporate schema definition and all schema extensions.
        ...schemaDef && getOperationTypes([schemaDef]),
        ...getOperationTypes(schemaExtensions)
      };
      return {
        description: (_schemaDef = schemaDef) === null || _schemaDef === void 0 ? void 0 : (_schemaDef$descriptio = _schemaDef.description) === null || _schemaDef$descriptio === void 0 ? void 0 : _schemaDef$descriptio.value,
        ...operationTypes,
        types: Object.values(typeMap),
        directives: [
          ...schemaConfig.directives.map(replaceDirective),
          ...directiveDefs.map(buildDirective)
        ],
        extensions: /* @__PURE__ */ Object.create(null),
        astNode: (_schemaDef2 = schemaDef) !== null && _schemaDef2 !== void 0 ? _schemaDef2 : schemaConfig.astNode,
        extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
        assumeValid: (_options$assumeValid = options === null || options === void 0 ? void 0 : options.assumeValid) !== null && _options$assumeValid !== void 0 ? _options$assumeValid : false
      };
      function replaceType(type) {
        if ((0, _definition.isListType)(type)) {
          return new _definition.GraphQLList(replaceType(type.ofType));
        }
        if ((0, _definition.isNonNullType)(type)) {
          return new _definition.GraphQLNonNull(replaceType(type.ofType));
        }
        return replaceNamedType(type);
      }
      function replaceNamedType(type) {
        return typeMap[type.name];
      }
      function replaceDirective(directive) {
        const config = directive.toConfig();
        return new _directives.GraphQLDirective({
          ...config,
          args: (0, _mapValue.mapValue)(config.args, extendArg)
        });
      }
      function extendNamedType(type) {
        if ((0, _introspection.isIntrospectionType)(type) || (0, _scalars.isSpecifiedScalarType)(type)) {
          return type;
        }
        if ((0, _definition.isScalarType)(type)) {
          return extendScalarType(type);
        }
        if ((0, _definition.isObjectType)(type)) {
          return extendObjectType(type);
        }
        if ((0, _definition.isInterfaceType)(type)) {
          return extendInterfaceType(type);
        }
        if ((0, _definition.isUnionType)(type)) {
          return extendUnionType(type);
        }
        if ((0, _definition.isEnumType)(type)) {
          return extendEnumType(type);
        }
        if ((0, _definition.isInputObjectType)(type)) {
          return extendInputObjectType(type);
        }
        (0, _invariant.invariant)(
          false,
          "Unexpected type: " + (0, _inspect.inspect)(type)
        );
      }
      function extendInputObjectType(type) {
        var _typeExtensionsMap$co;
        const config = type.toConfig();
        const extensions = (_typeExtensionsMap$co = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co !== void 0 ? _typeExtensionsMap$co : [];
        return new _definition.GraphQLInputObjectType({
          ...config,
          fields: () => ({
            ...(0, _mapValue.mapValue)(config.fields, (field) => ({
              ...field,
              type: replaceType(field.type)
            })),
            ...buildInputFieldMap(extensions)
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
      }
      function extendEnumType(type) {
        var _typeExtensionsMap$ty;
        const config = type.toConfig();
        const extensions = (_typeExtensionsMap$ty = typeExtensionsMap[type.name]) !== null && _typeExtensionsMap$ty !== void 0 ? _typeExtensionsMap$ty : [];
        return new _definition.GraphQLEnumType({
          ...config,
          values: { ...config.values, ...buildEnumValueMap(extensions) },
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
      }
      function extendScalarType(type) {
        var _typeExtensionsMap$co2;
        const config = type.toConfig();
        const extensions = (_typeExtensionsMap$co2 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co2 !== void 0 ? _typeExtensionsMap$co2 : [];
        let specifiedByURL = config.specifiedByURL;
        for (const extensionNode of extensions) {
          var _getSpecifiedByURL;
          specifiedByURL = (_getSpecifiedByURL = getSpecifiedByURL(extensionNode)) !== null && _getSpecifiedByURL !== void 0 ? _getSpecifiedByURL : specifiedByURL;
        }
        return new _definition.GraphQLScalarType({
          ...config,
          specifiedByURL,
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
      }
      function extendObjectType(type) {
        var _typeExtensionsMap$co3;
        const config = type.toConfig();
        const extensions = (_typeExtensionsMap$co3 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co3 !== void 0 ? _typeExtensionsMap$co3 : [];
        return new _definition.GraphQLObjectType({
          ...config,
          interfaces: () => [
            ...type.getInterfaces().map(replaceNamedType),
            ...buildInterfaces(extensions)
          ],
          fields: () => ({
            ...(0, _mapValue.mapValue)(config.fields, extendField),
            ...buildFieldMap(extensions)
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
      }
      function extendInterfaceType(type) {
        var _typeExtensionsMap$co4;
        const config = type.toConfig();
        const extensions = (_typeExtensionsMap$co4 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co4 !== void 0 ? _typeExtensionsMap$co4 : [];
        return new _definition.GraphQLInterfaceType({
          ...config,
          interfaces: () => [
            ...type.getInterfaces().map(replaceNamedType),
            ...buildInterfaces(extensions)
          ],
          fields: () => ({
            ...(0, _mapValue.mapValue)(config.fields, extendField),
            ...buildFieldMap(extensions)
          }),
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
      }
      function extendUnionType(type) {
        var _typeExtensionsMap$co5;
        const config = type.toConfig();
        const extensions = (_typeExtensionsMap$co5 = typeExtensionsMap[config.name]) !== null && _typeExtensionsMap$co5 !== void 0 ? _typeExtensionsMap$co5 : [];
        return new _definition.GraphQLUnionType({
          ...config,
          types: () => [
            ...type.getTypes().map(replaceNamedType),
            ...buildUnionTypes(extensions)
          ],
          extensionASTNodes: config.extensionASTNodes.concat(extensions)
        });
      }
      function extendField(field) {
        return {
          ...field,
          type: replaceType(field.type),
          args: field.args && (0, _mapValue.mapValue)(field.args, extendArg)
        };
      }
      function extendArg(arg) {
        return { ...arg, type: replaceType(arg.type) };
      }
      function getOperationTypes(nodes) {
        const opTypes = {};
        for (const node of nodes) {
          var _node$operationTypes;
          const operationTypesNodes = (
            /* c8 ignore next */
            (_node$operationTypes = node.operationTypes) !== null && _node$operationTypes !== void 0 ? _node$operationTypes : []
          );
          for (const operationType of operationTypesNodes) {
            opTypes[operationType.operation] = getNamedType(operationType.type);
          }
        }
        return opTypes;
      }
      function getNamedType(node) {
        var _stdTypeMap$name2;
        const name = node.name.value;
        const type = (_stdTypeMap$name2 = stdTypeMap[name]) !== null && _stdTypeMap$name2 !== void 0 ? _stdTypeMap$name2 : typeMap[name];
        if (type === void 0) {
          throw new Error(`Unknown type: "${name}".`);
        }
        return type;
      }
      function getWrappedType(node) {
        if (node.kind === _kinds.Kind.LIST_TYPE) {
          return new _definition.GraphQLList(getWrappedType(node.type));
        }
        if (node.kind === _kinds.Kind.NON_NULL_TYPE) {
          return new _definition.GraphQLNonNull(getWrappedType(node.type));
        }
        return getNamedType(node);
      }
      function buildDirective(node) {
        var _node$description;
        return new _directives.GraphQLDirective({
          name: node.name.value,
          description: (_node$description = node.description) === null || _node$description === void 0 ? void 0 : _node$description.value,
          // @ts-expect-error
          locations: node.locations.map(({ value }) => value),
          isRepeatable: node.repeatable,
          args: buildArgumentMap(node.arguments),
          astNode: node
        });
      }
      function buildFieldMap(nodes) {
        const fieldConfigMap = /* @__PURE__ */ Object.create(null);
        for (const node of nodes) {
          var _node$fields;
          const nodeFields = (
            /* c8 ignore next */
            (_node$fields = node.fields) !== null && _node$fields !== void 0 ? _node$fields : []
          );
          for (const field of nodeFields) {
            var _field$description;
            fieldConfigMap[field.name.value] = {
              // Note: While this could make assertions to get the correctly typed
              // value, that would throw immediately while type system validation
              // with validateSchema() will produce more actionable results.
              type: getWrappedType(field.type),
              description: (_field$description = field.description) === null || _field$description === void 0 ? void 0 : _field$description.value,
              args: buildArgumentMap(field.arguments),
              deprecationReason: getDeprecationReason(field),
              astNode: field
            };
          }
        }
        return fieldConfigMap;
      }
      function buildArgumentMap(args) {
        const argsNodes = (
          /* c8 ignore next */
          args !== null && args !== void 0 ? args : []
        );
        const argConfigMap = /* @__PURE__ */ Object.create(null);
        for (const arg of argsNodes) {
          var _arg$description;
          const type = getWrappedType(arg.type);
          argConfigMap[arg.name.value] = {
            type,
            description: (_arg$description = arg.description) === null || _arg$description === void 0 ? void 0 : _arg$description.value,
            defaultValue: (0, _valueFromAST.valueFromAST)(arg.defaultValue, type),
            deprecationReason: getDeprecationReason(arg),
            astNode: arg
          };
        }
        return argConfigMap;
      }
      function buildInputFieldMap(nodes) {
        const inputFieldMap = /* @__PURE__ */ Object.create(null);
        for (const node of nodes) {
          var _node$fields2;
          const fieldsNodes = (
            /* c8 ignore next */
            (_node$fields2 = node.fields) !== null && _node$fields2 !== void 0 ? _node$fields2 : []
          );
          for (const field of fieldsNodes) {
            var _field$description2;
            const type = getWrappedType(field.type);
            inputFieldMap[field.name.value] = {
              type,
              description: (_field$description2 = field.description) === null || _field$description2 === void 0 ? void 0 : _field$description2.value,
              defaultValue: (0, _valueFromAST.valueFromAST)(
                field.defaultValue,
                type
              ),
              deprecationReason: getDeprecationReason(field),
              astNode: field
            };
          }
        }
        return inputFieldMap;
      }
      function buildEnumValueMap(nodes) {
        const enumValueMap = /* @__PURE__ */ Object.create(null);
        for (const node of nodes) {
          var _node$values;
          const valuesNodes = (
            /* c8 ignore next */
            (_node$values = node.values) !== null && _node$values !== void 0 ? _node$values : []
          );
          for (const value of valuesNodes) {
            var _value$description;
            enumValueMap[value.name.value] = {
              description: (_value$description = value.description) === null || _value$description === void 0 ? void 0 : _value$description.value,
              deprecationReason: getDeprecationReason(value),
              astNode: value
            };
          }
        }
        return enumValueMap;
      }
      function buildInterfaces(nodes) {
        return nodes.flatMap(
          // FIXME: https://github.com/graphql/graphql-js/issues/2203
          (node) => {
            var _node$interfaces$map, _node$interfaces;
            return (
              /* c8 ignore next */
              (_node$interfaces$map = (_node$interfaces = node.interfaces) === null || _node$interfaces === void 0 ? void 0 : _node$interfaces.map(getNamedType)) !== null && _node$interfaces$map !== void 0 ? _node$interfaces$map : []
            );
          }
        );
      }
      function buildUnionTypes(nodes) {
        return nodes.flatMap(
          // FIXME: https://github.com/graphql/graphql-js/issues/2203
          (node) => {
            var _node$types$map, _node$types;
            return (
              /* c8 ignore next */
              (_node$types$map = (_node$types = node.types) === null || _node$types === void 0 ? void 0 : _node$types.map(getNamedType)) !== null && _node$types$map !== void 0 ? _node$types$map : []
            );
          }
        );
      }
      function buildType(astNode) {
        var _typeExtensionsMap$na;
        const name = astNode.name.value;
        const extensionASTNodes = (_typeExtensionsMap$na = typeExtensionsMap[name]) !== null && _typeExtensionsMap$na !== void 0 ? _typeExtensionsMap$na : [];
        switch (astNode.kind) {
          case _kinds.Kind.OBJECT_TYPE_DEFINITION: {
            var _astNode$description;
            const allNodes = [astNode, ...extensionASTNodes];
            return new _definition.GraphQLObjectType({
              name,
              description: (_astNode$description = astNode.description) === null || _astNode$description === void 0 ? void 0 : _astNode$description.value,
              interfaces: () => buildInterfaces(allNodes),
              fields: () => buildFieldMap(allNodes),
              astNode,
              extensionASTNodes
            });
          }
          case _kinds.Kind.INTERFACE_TYPE_DEFINITION: {
            var _astNode$description2;
            const allNodes = [astNode, ...extensionASTNodes];
            return new _definition.GraphQLInterfaceType({
              name,
              description: (_astNode$description2 = astNode.description) === null || _astNode$description2 === void 0 ? void 0 : _astNode$description2.value,
              interfaces: () => buildInterfaces(allNodes),
              fields: () => buildFieldMap(allNodes),
              astNode,
              extensionASTNodes
            });
          }
          case _kinds.Kind.ENUM_TYPE_DEFINITION: {
            var _astNode$description3;
            const allNodes = [astNode, ...extensionASTNodes];
            return new _definition.GraphQLEnumType({
              name,
              description: (_astNode$description3 = astNode.description) === null || _astNode$description3 === void 0 ? void 0 : _astNode$description3.value,
              values: buildEnumValueMap(allNodes),
              astNode,
              extensionASTNodes
            });
          }
          case _kinds.Kind.UNION_TYPE_DEFINITION: {
            var _astNode$description4;
            const allNodes = [astNode, ...extensionASTNodes];
            return new _definition.GraphQLUnionType({
              name,
              description: (_astNode$description4 = astNode.description) === null || _astNode$description4 === void 0 ? void 0 : _astNode$description4.value,
              types: () => buildUnionTypes(allNodes),
              astNode,
              extensionASTNodes
            });
          }
          case _kinds.Kind.SCALAR_TYPE_DEFINITION: {
            var _astNode$description5;
            return new _definition.GraphQLScalarType({
              name,
              description: (_astNode$description5 = astNode.description) === null || _astNode$description5 === void 0 ? void 0 : _astNode$description5.value,
              specifiedByURL: getSpecifiedByURL(astNode),
              astNode,
              extensionASTNodes
            });
          }
          case _kinds.Kind.INPUT_OBJECT_TYPE_DEFINITION: {
            var _astNode$description6;
            const allNodes = [astNode, ...extensionASTNodes];
            return new _definition.GraphQLInputObjectType({
              name,
              description: (_astNode$description6 = astNode.description) === null || _astNode$description6 === void 0 ? void 0 : _astNode$description6.value,
              fields: () => buildInputFieldMap(allNodes),
              astNode,
              extensionASTNodes,
              isOneOf: isOneOf(astNode)
            });
          }
        }
      }
    }
    var stdTypeMap = (0, _keyMap.keyMap)(
      [..._scalars.specifiedScalarTypes, ..._introspection.introspectionTypes],
      (type) => type.name
    );
    function getDeprecationReason(node) {
      const deprecated = (0, _values.getDirectiveValues)(
        _directives.GraphQLDeprecatedDirective,
        node
      );
      return deprecated === null || deprecated === void 0 ? void 0 : deprecated.reason;
    }
    function getSpecifiedByURL(node) {
      const specifiedBy = (0, _values.getDirectiveValues)(
        _directives.GraphQLSpecifiedByDirective,
        node
      );
      return specifiedBy === null || specifiedBy === void 0 ? void 0 : specifiedBy.url;
    }
    function isOneOf(node) {
      return Boolean(
        (0, _values.getDirectiveValues)(_directives.GraphQLOneOfDirective, node)
      );
    }
  }
});

// node_modules/graphql/utilities/buildASTSchema.js
var require_buildASTSchema = __commonJS({
  "node_modules/graphql/utilities/buildASTSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.buildASTSchema = buildASTSchema;
    exports2.buildSchema = buildSchema;
    var _devAssert = require_devAssert();
    var _kinds = require_kinds();
    var _parser = require_parser();
    var _directives = require_directives();
    var _schema = require_schema();
    var _validate = require_validate2();
    var _extendSchema = require_extendSchema();
    function buildASTSchema(documentAST, options) {
      documentAST != null && documentAST.kind === _kinds.Kind.DOCUMENT || (0, _devAssert.devAssert)(false, "Must provide valid Document AST.");
      if ((options === null || options === void 0 ? void 0 : options.assumeValid) !== true && (options === null || options === void 0 ? void 0 : options.assumeValidSDL) !== true) {
        (0, _validate.assertValidSDL)(documentAST);
      }
      const emptySchemaConfig = {
        description: void 0,
        types: [],
        directives: [],
        extensions: /* @__PURE__ */ Object.create(null),
        extensionASTNodes: [],
        assumeValid: false
      };
      const config = (0, _extendSchema.extendSchemaImpl)(
        emptySchemaConfig,
        documentAST,
        options
      );
      if (config.astNode == null) {
        for (const type of config.types) {
          switch (type.name) {
            case "Query":
              config.query = type;
              break;
            case "Mutation":
              config.mutation = type;
              break;
            case "Subscription":
              config.subscription = type;
              break;
          }
        }
      }
      const directives = [
        ...config.directives,
        // If specified directives were not explicitly declared, add them.
        ..._directives.specifiedDirectives.filter(
          (stdDirective) => config.directives.every(
            (directive) => directive.name !== stdDirective.name
          )
        )
      ];
      return new _schema.GraphQLSchema({ ...config, directives });
    }
    function buildSchema(source, options) {
      const document = (0, _parser.parse)(source, {
        noLocation: options === null || options === void 0 ? void 0 : options.noLocation,
        allowLegacyFragmentVariables: options === null || options === void 0 ? void 0 : options.allowLegacyFragmentVariables
      });
      return buildASTSchema(document, {
        assumeValidSDL: options === null || options === void 0 ? void 0 : options.assumeValidSDL,
        assumeValid: options === null || options === void 0 ? void 0 : options.assumeValid
      });
    }
  }
});

// node_modules/graphql/utilities/lexicographicSortSchema.js
var require_lexicographicSortSchema = __commonJS({
  "node_modules/graphql/utilities/lexicographicSortSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.lexicographicSortSchema = lexicographicSortSchema;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _keyValMap = require_keyValMap();
    var _naturalCompare = require_naturalCompare();
    var _definition = require_definition();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _schema = require_schema();
    function lexicographicSortSchema(schema) {
      const schemaConfig = schema.toConfig();
      const typeMap = (0, _keyValMap.keyValMap)(
        sortByName(schemaConfig.types),
        (type) => type.name,
        sortNamedType
      );
      return new _schema.GraphQLSchema({
        ...schemaConfig,
        types: Object.values(typeMap),
        directives: sortByName(schemaConfig.directives).map(sortDirective),
        query: replaceMaybeType(schemaConfig.query),
        mutation: replaceMaybeType(schemaConfig.mutation),
        subscription: replaceMaybeType(schemaConfig.subscription)
      });
      function replaceType(type) {
        if ((0, _definition.isListType)(type)) {
          return new _definition.GraphQLList(replaceType(type.ofType));
        } else if ((0, _definition.isNonNullType)(type)) {
          return new _definition.GraphQLNonNull(replaceType(type.ofType));
        }
        return replaceNamedType(type);
      }
      function replaceNamedType(type) {
        return typeMap[type.name];
      }
      function replaceMaybeType(maybeType) {
        return maybeType && replaceNamedType(maybeType);
      }
      function sortDirective(directive) {
        const config = directive.toConfig();
        return new _directives.GraphQLDirective({
          ...config,
          locations: sortBy(config.locations, (x) => x),
          args: sortArgs(config.args)
        });
      }
      function sortArgs(args) {
        return sortObjMap(args, (arg) => ({ ...arg, type: replaceType(arg.type) }));
      }
      function sortFields(fieldsMap) {
        return sortObjMap(fieldsMap, (field) => ({
          ...field,
          type: replaceType(field.type),
          args: field.args && sortArgs(field.args)
        }));
      }
      function sortInputFields(fieldsMap) {
        return sortObjMap(fieldsMap, (field) => ({
          ...field,
          type: replaceType(field.type)
        }));
      }
      function sortTypes(array) {
        return sortByName(array).map(replaceNamedType);
      }
      function sortNamedType(type) {
        if ((0, _definition.isScalarType)(type) || (0, _introspection.isIntrospectionType)(type)) {
          return type;
        }
        if ((0, _definition.isObjectType)(type)) {
          const config = type.toConfig();
          return new _definition.GraphQLObjectType({
            ...config,
            interfaces: () => sortTypes(config.interfaces),
            fields: () => sortFields(config.fields)
          });
        }
        if ((0, _definition.isInterfaceType)(type)) {
          const config = type.toConfig();
          return new _definition.GraphQLInterfaceType({
            ...config,
            interfaces: () => sortTypes(config.interfaces),
            fields: () => sortFields(config.fields)
          });
        }
        if ((0, _definition.isUnionType)(type)) {
          const config = type.toConfig();
          return new _definition.GraphQLUnionType({
            ...config,
            types: () => sortTypes(config.types)
          });
        }
        if ((0, _definition.isEnumType)(type)) {
          const config = type.toConfig();
          return new _definition.GraphQLEnumType({
            ...config,
            values: sortObjMap(config.values, (value) => value)
          });
        }
        if ((0, _definition.isInputObjectType)(type)) {
          const config = type.toConfig();
          return new _definition.GraphQLInputObjectType({
            ...config,
            fields: () => sortInputFields(config.fields)
          });
        }
        (0, _invariant.invariant)(
          false,
          "Unexpected type: " + (0, _inspect.inspect)(type)
        );
      }
    }
    function sortObjMap(map, sortValueFn) {
      const sortedMap = /* @__PURE__ */ Object.create(null);
      for (const key of Object.keys(map).sort(_naturalCompare.naturalCompare)) {
        sortedMap[key] = sortValueFn(map[key]);
      }
      return sortedMap;
    }
    function sortByName(array) {
      return sortBy(array, (obj) => obj.name);
    }
    function sortBy(array, mapToKey) {
      return array.slice().sort((obj1, obj2) => {
        const key1 = mapToKey(obj1);
        const key2 = mapToKey(obj2);
        return (0, _naturalCompare.naturalCompare)(key1, key2);
      });
    }
  }
});

// node_modules/graphql/utilities/printSchema.js
var require_printSchema = __commonJS({
  "node_modules/graphql/utilities/printSchema.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.printIntrospectionSchema = printIntrospectionSchema;
    exports2.printSchema = printSchema;
    exports2.printType = printType;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _blockString = require_blockString();
    var _kinds = require_kinds();
    var _printer = require_printer();
    var _definition = require_definition();
    var _directives = require_directives();
    var _introspection = require_introspection();
    var _scalars = require_scalars();
    var _astFromValue = require_astFromValue();
    function printSchema(schema) {
      return printFilteredSchema(
        schema,
        (n) => !(0, _directives.isSpecifiedDirective)(n),
        isDefinedType
      );
    }
    function printIntrospectionSchema(schema) {
      return printFilteredSchema(
        schema,
        _directives.isSpecifiedDirective,
        _introspection.isIntrospectionType
      );
    }
    function isDefinedType(type) {
      return !(0, _scalars.isSpecifiedScalarType)(type) && !(0, _introspection.isIntrospectionType)(type);
    }
    function printFilteredSchema(schema, directiveFilter, typeFilter) {
      const directives = schema.getDirectives().filter(directiveFilter);
      const types = Object.values(schema.getTypeMap()).filter(typeFilter);
      return [
        printSchemaDefinition(schema),
        ...directives.map((directive) => printDirective(directive)),
        ...types.map((type) => printType(type))
      ].filter(Boolean).join("\n\n");
    }
    function printSchemaDefinition(schema) {
      if (schema.description == null && isSchemaOfCommonNames(schema)) {
        return;
      }
      const operationTypes = [];
      const queryType = schema.getQueryType();
      if (queryType) {
        operationTypes.push(`  query: ${queryType.name}`);
      }
      const mutationType = schema.getMutationType();
      if (mutationType) {
        operationTypes.push(`  mutation: ${mutationType.name}`);
      }
      const subscriptionType = schema.getSubscriptionType();
      if (subscriptionType) {
        operationTypes.push(`  subscription: ${subscriptionType.name}`);
      }
      return printDescription(schema) + `schema {
${operationTypes.join("\n")}
}`;
    }
    function isSchemaOfCommonNames(schema) {
      const queryType = schema.getQueryType();
      if (queryType && queryType.name !== "Query") {
        return false;
      }
      const mutationType = schema.getMutationType();
      if (mutationType && mutationType.name !== "Mutation") {
        return false;
      }
      const subscriptionType = schema.getSubscriptionType();
      if (subscriptionType && subscriptionType.name !== "Subscription") {
        return false;
      }
      return true;
    }
    function printType(type) {
      if ((0, _definition.isScalarType)(type)) {
        return printScalar(type);
      }
      if ((0, _definition.isObjectType)(type)) {
        return printObject(type);
      }
      if ((0, _definition.isInterfaceType)(type)) {
        return printInterface(type);
      }
      if ((0, _definition.isUnionType)(type)) {
        return printUnion(type);
      }
      if ((0, _definition.isEnumType)(type)) {
        return printEnum(type);
      }
      if ((0, _definition.isInputObjectType)(type)) {
        return printInputObject(type);
      }
      (0, _invariant.invariant)(
        false,
        "Unexpected type: " + (0, _inspect.inspect)(type)
      );
    }
    function printScalar(type) {
      return printDescription(type) + `scalar ${type.name}` + printSpecifiedByURL(type);
    }
    function printImplementedInterfaces(type) {
      const interfaces = type.getInterfaces();
      return interfaces.length ? " implements " + interfaces.map((i) => i.name).join(" & ") : "";
    }
    function printObject(type) {
      return printDescription(type) + `type ${type.name}` + printImplementedInterfaces(type) + printFields(type);
    }
    function printInterface(type) {
      return printDescription(type) + `interface ${type.name}` + printImplementedInterfaces(type) + printFields(type);
    }
    function printUnion(type) {
      const types = type.getTypes();
      const possibleTypes = types.length ? " = " + types.join(" | ") : "";
      return printDescription(type) + "union " + type.name + possibleTypes;
    }
    function printEnum(type) {
      const values = type.getValues().map(
        (value, i) => printDescription(value, "  ", !i) + "  " + value.name + printDeprecated(value.deprecationReason)
      );
      return printDescription(type) + `enum ${type.name}` + printBlock(values);
    }
    function printInputObject(type) {
      const fields = Object.values(type.getFields()).map(
        (f, i) => printDescription(f, "  ", !i) + "  " + printInputValue(f)
      );
      return printDescription(type) + `input ${type.name}` + (type.isOneOf ? " @oneOf" : "") + printBlock(fields);
    }
    function printFields(type) {
      const fields = Object.values(type.getFields()).map(
        (f, i) => printDescription(f, "  ", !i) + "  " + f.name + printArgs(f.args, "  ") + ": " + String(f.type) + printDeprecated(f.deprecationReason)
      );
      return printBlock(fields);
    }
    function printBlock(items) {
      return items.length !== 0 ? " {\n" + items.join("\n") + "\n}" : "";
    }
    function printArgs(args, indentation = "") {
      if (args.length === 0) {
        return "";
      }
      if (args.every((arg) => !arg.description)) {
        return "(" + args.map(printInputValue).join(", ") + ")";
      }
      return "(\n" + args.map(
        (arg, i) => printDescription(arg, "  " + indentation, !i) + "  " + indentation + printInputValue(arg)
      ).join("\n") + "\n" + indentation + ")";
    }
    function printInputValue(arg) {
      const defaultAST = (0, _astFromValue.astFromValue)(
        arg.defaultValue,
        arg.type
      );
      let argDecl = arg.name + ": " + String(arg.type);
      if (defaultAST) {
        argDecl += ` = ${(0, _printer.print)(defaultAST)}`;
      }
      return argDecl + printDeprecated(arg.deprecationReason);
    }
    function printDirective(directive) {
      return printDescription(directive) + "directive @" + directive.name + printArgs(directive.args) + (directive.isRepeatable ? " repeatable" : "") + " on " + directive.locations.join(" | ");
    }
    function printDeprecated(reason) {
      if (reason == null) {
        return "";
      }
      if (reason !== _directives.DEFAULT_DEPRECATION_REASON) {
        const astValue = (0, _printer.print)({
          kind: _kinds.Kind.STRING,
          value: reason
        });
        return ` @deprecated(reason: ${astValue})`;
      }
      return " @deprecated";
    }
    function printSpecifiedByURL(scalar) {
      if (scalar.specifiedByURL == null) {
        return "";
      }
      const astValue = (0, _printer.print)({
        kind: _kinds.Kind.STRING,
        value: scalar.specifiedByURL
      });
      return ` @specifiedBy(url: ${astValue})`;
    }
    function printDescription(def, indentation = "", firstInBlock = true) {
      const { description } = def;
      if (description == null) {
        return "";
      }
      const blockString = (0, _printer.print)({
        kind: _kinds.Kind.STRING,
        value: description,
        block: (0, _blockString.isPrintableAsBlockString)(description)
      });
      const prefix = indentation && !firstInBlock ? "\n" + indentation : indentation;
      return prefix + blockString.replace(/\n/g, "\n" + indentation) + "\n";
    }
  }
});

// node_modules/graphql/utilities/concatAST.js
var require_concatAST = __commonJS({
  "node_modules/graphql/utilities/concatAST.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.concatAST = concatAST;
    var _kinds = require_kinds();
    function concatAST(documents) {
      const definitions = [];
      for (const doc of documents) {
        definitions.push(...doc.definitions);
      }
      return {
        kind: _kinds.Kind.DOCUMENT,
        definitions
      };
    }
  }
});

// node_modules/graphql/utilities/separateOperations.js
var require_separateOperations = __commonJS({
  "node_modules/graphql/utilities/separateOperations.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.separateOperations = separateOperations;
    var _kinds = require_kinds();
    var _visitor = require_visitor();
    function separateOperations(documentAST) {
      const operations = [];
      const depGraph = /* @__PURE__ */ Object.create(null);
      for (const definitionNode of documentAST.definitions) {
        switch (definitionNode.kind) {
          case _kinds.Kind.OPERATION_DEFINITION:
            operations.push(definitionNode);
            break;
          case _kinds.Kind.FRAGMENT_DEFINITION:
            depGraph[definitionNode.name.value] = collectDependencies(
              definitionNode.selectionSet
            );
            break;
          default:
        }
      }
      const separatedDocumentASTs = /* @__PURE__ */ Object.create(null);
      for (const operation of operations) {
        const dependencies = /* @__PURE__ */ new Set();
        for (const fragmentName of collectDependencies(operation.selectionSet)) {
          collectTransitiveDependencies(dependencies, depGraph, fragmentName);
        }
        const operationName = operation.name ? operation.name.value : "";
        separatedDocumentASTs[operationName] = {
          kind: _kinds.Kind.DOCUMENT,
          definitions: documentAST.definitions.filter(
            (node) => node === operation || node.kind === _kinds.Kind.FRAGMENT_DEFINITION && dependencies.has(node.name.value)
          )
        };
      }
      return separatedDocumentASTs;
    }
    function collectTransitiveDependencies(collected, depGraph, fromName) {
      if (!collected.has(fromName)) {
        collected.add(fromName);
        const immediateDeps = depGraph[fromName];
        if (immediateDeps !== void 0) {
          for (const toName of immediateDeps) {
            collectTransitiveDependencies(collected, depGraph, toName);
          }
        }
      }
    }
    function collectDependencies(selectionSet) {
      const dependencies = [];
      (0, _visitor.visit)(selectionSet, {
        FragmentSpread(node) {
          dependencies.push(node.name.value);
        }
      });
      return dependencies;
    }
  }
});

// node_modules/graphql/utilities/stripIgnoredCharacters.js
var require_stripIgnoredCharacters = __commonJS({
  "node_modules/graphql/utilities/stripIgnoredCharacters.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.stripIgnoredCharacters = stripIgnoredCharacters;
    var _blockString = require_blockString();
    var _lexer = require_lexer();
    var _source = require_source();
    var _tokenKind = require_tokenKind();
    function stripIgnoredCharacters(source) {
      const sourceObj = (0, _source.isSource)(source) ? source : new _source.Source(source);
      const body = sourceObj.body;
      const lexer = new _lexer.Lexer(sourceObj);
      let strippedBody = "";
      let wasLastAddedTokenNonPunctuator = false;
      while (lexer.advance().kind !== _tokenKind.TokenKind.EOF) {
        const currentToken = lexer.token;
        const tokenKind = currentToken.kind;
        const isNonPunctuator = !(0, _lexer.isPunctuatorTokenKind)(
          currentToken.kind
        );
        if (wasLastAddedTokenNonPunctuator) {
          if (isNonPunctuator || currentToken.kind === _tokenKind.TokenKind.SPREAD) {
            strippedBody += " ";
          }
        }
        const tokenBody = body.slice(currentToken.start, currentToken.end);
        if (tokenKind === _tokenKind.TokenKind.BLOCK_STRING) {
          strippedBody += (0, _blockString.printBlockString)(currentToken.value, {
            minimize: true
          });
        } else {
          strippedBody += tokenBody;
        }
        wasLastAddedTokenNonPunctuator = isNonPunctuator;
      }
      return strippedBody;
    }
  }
});

// node_modules/graphql/utilities/assertValidName.js
var require_assertValidName = __commonJS({
  "node_modules/graphql/utilities/assertValidName.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.assertValidName = assertValidName;
    exports2.isValidNameError = isValidNameError;
    var _devAssert = require_devAssert();
    var _GraphQLError = require_GraphQLError();
    var _assertName = require_assertName();
    function assertValidName(name) {
      const error = isValidNameError(name);
      if (error) {
        throw error;
      }
      return name;
    }
    function isValidNameError(name) {
      typeof name === "string" || (0, _devAssert.devAssert)(false, "Expected name to be a string.");
      if (name.startsWith("__")) {
        return new _GraphQLError.GraphQLError(
          `Name "${name}" must not begin with "__", which is reserved by GraphQL introspection.`
        );
      }
      try {
        (0, _assertName.assertName)(name);
      } catch (error) {
        return error;
      }
    }
  }
});

// node_modules/graphql/utilities/findBreakingChanges.js
var require_findBreakingChanges = __commonJS({
  "node_modules/graphql/utilities/findBreakingChanges.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    exports2.DangerousChangeType = exports2.BreakingChangeType = void 0;
    exports2.findBreakingChanges = findBreakingChanges;
    exports2.findDangerousChanges = findDangerousChanges;
    var _inspect = require_inspect();
    var _invariant = require_invariant();
    var _keyMap = require_keyMap();
    var _printer = require_printer();
    var _definition = require_definition();
    var _scalars = require_scalars();
    var _astFromValue = require_astFromValue();
    var _sortValueNode = require_sortValueNode();
    var BreakingChangeType;
    exports2.BreakingChangeType = BreakingChangeType;
    (function(BreakingChangeType2) {
      BreakingChangeType2["TYPE_REMOVED"] = "TYPE_REMOVED";
      BreakingChangeType2["TYPE_CHANGED_KIND"] = "TYPE_CHANGED_KIND";
      BreakingChangeType2["TYPE_REMOVED_FROM_UNION"] = "TYPE_REMOVED_FROM_UNION";
      BreakingChangeType2["VALUE_REMOVED_FROM_ENUM"] = "VALUE_REMOVED_FROM_ENUM";
      BreakingChangeType2["REQUIRED_INPUT_FIELD_ADDED"] = "REQUIRED_INPUT_FIELD_ADDED";
      BreakingChangeType2["IMPLEMENTED_INTERFACE_REMOVED"] = "IMPLEMENTED_INTERFACE_REMOVED";
      BreakingChangeType2["FIELD_REMOVED"] = "FIELD_REMOVED";
      BreakingChangeType2["FIELD_CHANGED_KIND"] = "FIELD_CHANGED_KIND";
      BreakingChangeType2["REQUIRED_ARG_ADDED"] = "REQUIRED_ARG_ADDED";
      BreakingChangeType2["ARG_REMOVED"] = "ARG_REMOVED";
      BreakingChangeType2["ARG_CHANGED_KIND"] = "ARG_CHANGED_KIND";
      BreakingChangeType2["DIRECTIVE_REMOVED"] = "DIRECTIVE_REMOVED";
      BreakingChangeType2["DIRECTIVE_ARG_REMOVED"] = "DIRECTIVE_ARG_REMOVED";
      BreakingChangeType2["REQUIRED_DIRECTIVE_ARG_ADDED"] = "REQUIRED_DIRECTIVE_ARG_ADDED";
      BreakingChangeType2["DIRECTIVE_REPEATABLE_REMOVED"] = "DIRECTIVE_REPEATABLE_REMOVED";
      BreakingChangeType2["DIRECTIVE_LOCATION_REMOVED"] = "DIRECTIVE_LOCATION_REMOVED";
    })(
      BreakingChangeType || (exports2.BreakingChangeType = BreakingChangeType = {})
    );
    var DangerousChangeType;
    exports2.DangerousChangeType = DangerousChangeType;
    (function(DangerousChangeType2) {
      DangerousChangeType2["VALUE_ADDED_TO_ENUM"] = "VALUE_ADDED_TO_ENUM";
      DangerousChangeType2["TYPE_ADDED_TO_UNION"] = "TYPE_ADDED_TO_UNION";
      DangerousChangeType2["OPTIONAL_INPUT_FIELD_ADDED"] = "OPTIONAL_INPUT_FIELD_ADDED";
      DangerousChangeType2["OPTIONAL_ARG_ADDED"] = "OPTIONAL_ARG_ADDED";
      DangerousChangeType2["IMPLEMENTED_INTERFACE_ADDED"] = "IMPLEMENTED_INTERFACE_ADDED";
      DangerousChangeType2["ARG_DEFAULT_VALUE_CHANGE"] = "ARG_DEFAULT_VALUE_CHANGE";
    })(
      DangerousChangeType || (exports2.DangerousChangeType = DangerousChangeType = {})
    );
    function findBreakingChanges(oldSchema, newSchema) {
      return findSchemaChanges(oldSchema, newSchema).filter(
        (change) => change.type in BreakingChangeType
      );
    }
    function findDangerousChanges(oldSchema, newSchema) {
      return findSchemaChanges(oldSchema, newSchema).filter(
        (change) => change.type in DangerousChangeType
      );
    }
    function findSchemaChanges(oldSchema, newSchema) {
      return [
        ...findTypeChanges(oldSchema, newSchema),
        ...findDirectiveChanges(oldSchema, newSchema)
      ];
    }
    function findDirectiveChanges(oldSchema, newSchema) {
      const schemaChanges = [];
      const directivesDiff = diff(
        oldSchema.getDirectives(),
        newSchema.getDirectives()
      );
      for (const oldDirective of directivesDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.DIRECTIVE_REMOVED,
          description: `${oldDirective.name} was removed.`
        });
      }
      for (const [oldDirective, newDirective] of directivesDiff.persisted) {
        const argsDiff = diff(oldDirective.args, newDirective.args);
        for (const newArg of argsDiff.added) {
          if ((0, _definition.isRequiredArgument)(newArg)) {
            schemaChanges.push({
              type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
              description: `A required arg ${newArg.name} on directive ${oldDirective.name} was added.`
            });
          }
        }
        for (const oldArg of argsDiff.removed) {
          schemaChanges.push({
            type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
            description: `${oldArg.name} was removed from ${oldDirective.name}.`
          });
        }
        if (oldDirective.isRepeatable && !newDirective.isRepeatable) {
          schemaChanges.push({
            type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
            description: `Repeatable flag was removed from ${oldDirective.name}.`
          });
        }
        for (const location of oldDirective.locations) {
          if (!newDirective.locations.includes(location)) {
            schemaChanges.push({
              type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
              description: `${location} was removed from ${oldDirective.name}.`
            });
          }
        }
      }
      return schemaChanges;
    }
    function findTypeChanges(oldSchema, newSchema) {
      const schemaChanges = [];
      const typesDiff = diff(
        Object.values(oldSchema.getTypeMap()),
        Object.values(newSchema.getTypeMap())
      );
      for (const oldType of typesDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.TYPE_REMOVED,
          description: (0, _scalars.isSpecifiedScalarType)(oldType) ? `Standard scalar ${oldType.name} was removed because it is not referenced anymore.` : `${oldType.name} was removed.`
        });
      }
      for (const [oldType, newType] of typesDiff.persisted) {
        if ((0, _definition.isEnumType)(oldType) && (0, _definition.isEnumType)(newType)) {
          schemaChanges.push(...findEnumTypeChanges(oldType, newType));
        } else if ((0, _definition.isUnionType)(oldType) && (0, _definition.isUnionType)(newType)) {
          schemaChanges.push(...findUnionTypeChanges(oldType, newType));
        } else if ((0, _definition.isInputObjectType)(oldType) && (0, _definition.isInputObjectType)(newType)) {
          schemaChanges.push(...findInputObjectTypeChanges(oldType, newType));
        } else if ((0, _definition.isObjectType)(oldType) && (0, _definition.isObjectType)(newType)) {
          schemaChanges.push(
            ...findFieldChanges(oldType, newType),
            ...findImplementedInterfacesChanges(oldType, newType)
          );
        } else if ((0, _definition.isInterfaceType)(oldType) && (0, _definition.isInterfaceType)(newType)) {
          schemaChanges.push(
            ...findFieldChanges(oldType, newType),
            ...findImplementedInterfacesChanges(oldType, newType)
          );
        } else if (oldType.constructor !== newType.constructor) {
          schemaChanges.push({
            type: BreakingChangeType.TYPE_CHANGED_KIND,
            description: `${oldType.name} changed from ${typeKindName(oldType)} to ${typeKindName(newType)}.`
          });
        }
      }
      return schemaChanges;
    }
    function findInputObjectTypeChanges(oldType, newType) {
      const schemaChanges = [];
      const fieldsDiff = diff(
        Object.values(oldType.getFields()),
        Object.values(newType.getFields())
      );
      for (const newField of fieldsDiff.added) {
        if ((0, _definition.isRequiredInputField)(newField)) {
          schemaChanges.push({
            type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
            description: `A required field ${newField.name} on input type ${oldType.name} was added.`
          });
        } else {
          schemaChanges.push({
            type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
            description: `An optional field ${newField.name} on input type ${oldType.name} was added.`
          });
        }
      }
      for (const oldField of fieldsDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${oldType.name}.${oldField.name} was removed.`
        });
      }
      for (const [oldField, newField] of fieldsDiff.persisted) {
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
          oldField.type,
          newField.type
        );
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: `${oldType.name}.${oldField.name} changed type from ${String(oldField.type)} to ${String(newField.type)}.`
          });
        }
      }
      return schemaChanges;
    }
    function findUnionTypeChanges(oldType, newType) {
      const schemaChanges = [];
      const possibleTypesDiff = diff(oldType.getTypes(), newType.getTypes());
      for (const newPossibleType of possibleTypesDiff.added) {
        schemaChanges.push({
          type: DangerousChangeType.TYPE_ADDED_TO_UNION,
          description: `${newPossibleType.name} was added to union type ${oldType.name}.`
        });
      }
      for (const oldPossibleType of possibleTypesDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
          description: `${oldPossibleType.name} was removed from union type ${oldType.name}.`
        });
      }
      return schemaChanges;
    }
    function findEnumTypeChanges(oldType, newType) {
      const schemaChanges = [];
      const valuesDiff = diff(oldType.getValues(), newType.getValues());
      for (const newValue of valuesDiff.added) {
        schemaChanges.push({
          type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
          description: `${newValue.name} was added to enum type ${oldType.name}.`
        });
      }
      for (const oldValue of valuesDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
          description: `${oldValue.name} was removed from enum type ${oldType.name}.`
        });
      }
      return schemaChanges;
    }
    function findImplementedInterfacesChanges(oldType, newType) {
      const schemaChanges = [];
      const interfacesDiff = diff(oldType.getInterfaces(), newType.getInterfaces());
      for (const newInterface of interfacesDiff.added) {
        schemaChanges.push({
          type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
          description: `${newInterface.name} added to interfaces implemented by ${oldType.name}.`
        });
      }
      for (const oldInterface of interfacesDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
          description: `${oldType.name} no longer implements interface ${oldInterface.name}.`
        });
      }
      return schemaChanges;
    }
    function findFieldChanges(oldType, newType) {
      const schemaChanges = [];
      const fieldsDiff = diff(
        Object.values(oldType.getFields()),
        Object.values(newType.getFields())
      );
      for (const oldField of fieldsDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${oldType.name}.${oldField.name} was removed.`
        });
      }
      for (const [oldField, newField] of fieldsDiff.persisted) {
        schemaChanges.push(...findArgChanges(oldType, oldField, newField));
        const isSafe = isChangeSafeForObjectOrInterfaceField(
          oldField.type,
          newField.type
        );
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: `${oldType.name}.${oldField.name} changed type from ${String(oldField.type)} to ${String(newField.type)}.`
          });
        }
      }
      return schemaChanges;
    }
    function findArgChanges(oldType, oldField, newField) {
      const schemaChanges = [];
      const argsDiff = diff(oldField.args, newField.args);
      for (const oldArg of argsDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.ARG_REMOVED,
          description: `${oldType.name}.${oldField.name} arg ${oldArg.name} was removed.`
        });
      }
      for (const [oldArg, newArg] of argsDiff.persisted) {
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
          oldArg.type,
          newArg.type
        );
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.ARG_CHANGED_KIND,
            description: `${oldType.name}.${oldField.name} arg ${oldArg.name} has changed type from ${String(oldArg.type)} to ${String(newArg.type)}.`
          });
        } else if (oldArg.defaultValue !== void 0) {
          if (newArg.defaultValue === void 0) {
            schemaChanges.push({
              type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
              description: `${oldType.name}.${oldField.name} arg ${oldArg.name} defaultValue was removed.`
            });
          } else {
            const oldValueStr = stringifyValue(oldArg.defaultValue, oldArg.type);
            const newValueStr = stringifyValue(newArg.defaultValue, newArg.type);
            if (oldValueStr !== newValueStr) {
              schemaChanges.push({
                type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                description: `${oldType.name}.${oldField.name} arg ${oldArg.name} has changed defaultValue from ${oldValueStr} to ${newValueStr}.`
              });
            }
          }
        }
      }
      for (const newArg of argsDiff.added) {
        if ((0, _definition.isRequiredArgument)(newArg)) {
          schemaChanges.push({
            type: BreakingChangeType.REQUIRED_ARG_ADDED,
            description: `A required arg ${newArg.name} on ${oldType.name}.${oldField.name} was added.`
          });
        } else {
          schemaChanges.push({
            type: DangerousChangeType.OPTIONAL_ARG_ADDED,
            description: `An optional arg ${newArg.name} on ${oldType.name}.${oldField.name} was added.`
          });
        }
      }
      return schemaChanges;
    }
    function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
      if ((0, _definition.isListType)(oldType)) {
        return (
          // if they're both lists, make sure the underlying types are compatible
          (0, _definition.isListType)(newType) && isChangeSafeForObjectOrInterfaceField(
            oldType.ofType,
            newType.ofType
          ) || // moving from nullable to non-null of the same underlying type is safe
          (0, _definition.isNonNullType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
        );
      }
      if ((0, _definition.isNonNullType)(oldType)) {
        return (0, _definition.isNonNullType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType);
      }
      return (
        // if they're both named types, see if their names are equivalent
        (0, _definition.isNamedType)(newType) && oldType.name === newType.name || // moving from nullable to non-null of the same underlying type is safe
        (0, _definition.isNonNullType)(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
      );
    }
    function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
      if ((0, _definition.isListType)(oldType)) {
        return (0, _definition.isListType)(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType);
      }
      if ((0, _definition.isNonNullType)(oldType)) {
        return (
          // if they're both non-null, make sure the underlying types are
          // compatible
          (0, _definition.isNonNullType)(newType) && isChangeSafeForInputObjectFieldOrFieldArg(
            oldType.ofType,
            newType.ofType
          ) || // moving from non-null to nullable of the same underlying type is safe
          !(0, _definition.isNonNullType)(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType)
        );
      }
      return (0, _definition.isNamedType)(newType) && oldType.name === newType.name;
    }
    function typeKindName(type) {
      if ((0, _definition.isScalarType)(type)) {
        return "a Scalar type";
      }
      if ((0, _definition.isObjectType)(type)) {
        return "an Object type";
      }
      if ((0, _definition.isInterfaceType)(type)) {
        return "an Interface type";
      }
      if ((0, _definition.isUnionType)(type)) {
        return "a Union type";
      }
      if ((0, _definition.isEnumType)(type)) {
        return "an Enum type";
      }
      if ((0, _definition.isInputObjectType)(type)) {
        return "an Input type";
      }
      (0, _invariant.invariant)(
        false,
        "Unexpected type: " + (0, _inspect.inspect)(type)
      );
    }
    function stringifyValue(value, type) {
      const ast = (0, _astFromValue.astFromValue)(value, type);
      ast != null || (0, _invariant.invariant)(false);
      return (0, _printer.print)((0, _sortValueNode.sortValueNode)(ast));
    }
    function diff(oldArray, newArray) {
      const added = [];
      const removed = [];
      const persisted = [];
      const oldMap = (0, _keyMap.keyMap)(oldArray, ({ name }) => name);
      const newMap = (0, _keyMap.keyMap)(newArray, ({ name }) => name);
      for (const oldItem of oldArray) {
        const newItem = newMap[oldItem.name];
        if (newItem === void 0) {
          removed.push(oldItem);
        } else {
          persisted.push([oldItem, newItem]);
        }
      }
      for (const newItem of newArray) {
        if (oldMap[newItem.name] === void 0) {
          added.push(newItem);
        }
      }
      return {
        added,
        persisted,
        removed
      };
    }
  }
});

// node_modules/graphql/utilities/index.js
var require_utilities = __commonJS({
  "node_modules/graphql/utilities/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "BreakingChangeType", {
      enumerable: true,
      get: function() {
        return _findBreakingChanges.BreakingChangeType;
      }
    });
    Object.defineProperty(exports2, "DangerousChangeType", {
      enumerable: true,
      get: function() {
        return _findBreakingChanges.DangerousChangeType;
      }
    });
    Object.defineProperty(exports2, "TypeInfo", {
      enumerable: true,
      get: function() {
        return _TypeInfo.TypeInfo;
      }
    });
    Object.defineProperty(exports2, "assertValidName", {
      enumerable: true,
      get: function() {
        return _assertValidName.assertValidName;
      }
    });
    Object.defineProperty(exports2, "astFromValue", {
      enumerable: true,
      get: function() {
        return _astFromValue.astFromValue;
      }
    });
    Object.defineProperty(exports2, "buildASTSchema", {
      enumerable: true,
      get: function() {
        return _buildASTSchema.buildASTSchema;
      }
    });
    Object.defineProperty(exports2, "buildClientSchema", {
      enumerable: true,
      get: function() {
        return _buildClientSchema.buildClientSchema;
      }
    });
    Object.defineProperty(exports2, "buildSchema", {
      enumerable: true,
      get: function() {
        return _buildASTSchema.buildSchema;
      }
    });
    Object.defineProperty(exports2, "coerceInputValue", {
      enumerable: true,
      get: function() {
        return _coerceInputValue.coerceInputValue;
      }
    });
    Object.defineProperty(exports2, "concatAST", {
      enumerable: true,
      get: function() {
        return _concatAST.concatAST;
      }
    });
    Object.defineProperty(exports2, "doTypesOverlap", {
      enumerable: true,
      get: function() {
        return _typeComparators.doTypesOverlap;
      }
    });
    Object.defineProperty(exports2, "extendSchema", {
      enumerable: true,
      get: function() {
        return _extendSchema.extendSchema;
      }
    });
    Object.defineProperty(exports2, "findBreakingChanges", {
      enumerable: true,
      get: function() {
        return _findBreakingChanges.findBreakingChanges;
      }
    });
    Object.defineProperty(exports2, "findDangerousChanges", {
      enumerable: true,
      get: function() {
        return _findBreakingChanges.findDangerousChanges;
      }
    });
    Object.defineProperty(exports2, "getIntrospectionQuery", {
      enumerable: true,
      get: function() {
        return _getIntrospectionQuery.getIntrospectionQuery;
      }
    });
    Object.defineProperty(exports2, "getOperationAST", {
      enumerable: true,
      get: function() {
        return _getOperationAST.getOperationAST;
      }
    });
    Object.defineProperty(exports2, "getOperationRootType", {
      enumerable: true,
      get: function() {
        return _getOperationRootType.getOperationRootType;
      }
    });
    Object.defineProperty(exports2, "introspectionFromSchema", {
      enumerable: true,
      get: function() {
        return _introspectionFromSchema.introspectionFromSchema;
      }
    });
    Object.defineProperty(exports2, "isEqualType", {
      enumerable: true,
      get: function() {
        return _typeComparators.isEqualType;
      }
    });
    Object.defineProperty(exports2, "isTypeSubTypeOf", {
      enumerable: true,
      get: function() {
        return _typeComparators.isTypeSubTypeOf;
      }
    });
    Object.defineProperty(exports2, "isValidNameError", {
      enumerable: true,
      get: function() {
        return _assertValidName.isValidNameError;
      }
    });
    Object.defineProperty(exports2, "lexicographicSortSchema", {
      enumerable: true,
      get: function() {
        return _lexicographicSortSchema.lexicographicSortSchema;
      }
    });
    Object.defineProperty(exports2, "printIntrospectionSchema", {
      enumerable: true,
      get: function() {
        return _printSchema.printIntrospectionSchema;
      }
    });
    Object.defineProperty(exports2, "printSchema", {
      enumerable: true,
      get: function() {
        return _printSchema.printSchema;
      }
    });
    Object.defineProperty(exports2, "printType", {
      enumerable: true,
      get: function() {
        return _printSchema.printType;
      }
    });
    Object.defineProperty(exports2, "separateOperations", {
      enumerable: true,
      get: function() {
        return _separateOperations.separateOperations;
      }
    });
    Object.defineProperty(exports2, "stripIgnoredCharacters", {
      enumerable: true,
      get: function() {
        return _stripIgnoredCharacters.stripIgnoredCharacters;
      }
    });
    Object.defineProperty(exports2, "typeFromAST", {
      enumerable: true,
      get: function() {
        return _typeFromAST.typeFromAST;
      }
    });
    Object.defineProperty(exports2, "valueFromAST", {
      enumerable: true,
      get: function() {
        return _valueFromAST.valueFromAST;
      }
    });
    Object.defineProperty(exports2, "valueFromASTUntyped", {
      enumerable: true,
      get: function() {
        return _valueFromASTUntyped.valueFromASTUntyped;
      }
    });
    Object.defineProperty(exports2, "visitWithTypeInfo", {
      enumerable: true,
      get: function() {
        return _TypeInfo.visitWithTypeInfo;
      }
    });
    var _getIntrospectionQuery = require_getIntrospectionQuery();
    var _getOperationAST = require_getOperationAST();
    var _getOperationRootType = require_getOperationRootType();
    var _introspectionFromSchema = require_introspectionFromSchema();
    var _buildClientSchema = require_buildClientSchema();
    var _buildASTSchema = require_buildASTSchema();
    var _extendSchema = require_extendSchema();
    var _lexicographicSortSchema = require_lexicographicSortSchema();
    var _printSchema = require_printSchema();
    var _typeFromAST = require_typeFromAST();
    var _valueFromAST = require_valueFromAST();
    var _valueFromASTUntyped = require_valueFromASTUntyped();
    var _astFromValue = require_astFromValue();
    var _TypeInfo = require_TypeInfo();
    var _coerceInputValue = require_coerceInputValue();
    var _concatAST = require_concatAST();
    var _separateOperations = require_separateOperations();
    var _stripIgnoredCharacters = require_stripIgnoredCharacters();
    var _typeComparators = require_typeComparators();
    var _assertValidName = require_assertValidName();
    var _findBreakingChanges = require_findBreakingChanges();
  }
});

// node_modules/graphql/index.js
var require_graphql2 = __commonJS({
  "node_modules/graphql/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "BREAK", {
      enumerable: true,
      get: function() {
        return _index2.BREAK;
      }
    });
    Object.defineProperty(exports2, "BreakingChangeType", {
      enumerable: true,
      get: function() {
        return _index6.BreakingChangeType;
      }
    });
    Object.defineProperty(exports2, "DEFAULT_DEPRECATION_REASON", {
      enumerable: true,
      get: function() {
        return _index.DEFAULT_DEPRECATION_REASON;
      }
    });
    Object.defineProperty(exports2, "DangerousChangeType", {
      enumerable: true,
      get: function() {
        return _index6.DangerousChangeType;
      }
    });
    Object.defineProperty(exports2, "DirectiveLocation", {
      enumerable: true,
      get: function() {
        return _index2.DirectiveLocation;
      }
    });
    Object.defineProperty(exports2, "ExecutableDefinitionsRule", {
      enumerable: true,
      get: function() {
        return _index4.ExecutableDefinitionsRule;
      }
    });
    Object.defineProperty(exports2, "FieldsOnCorrectTypeRule", {
      enumerable: true,
      get: function() {
        return _index4.FieldsOnCorrectTypeRule;
      }
    });
    Object.defineProperty(exports2, "FragmentsOnCompositeTypesRule", {
      enumerable: true,
      get: function() {
        return _index4.FragmentsOnCompositeTypesRule;
      }
    });
    Object.defineProperty(exports2, "GRAPHQL_MAX_INT", {
      enumerable: true,
      get: function() {
        return _index.GRAPHQL_MAX_INT;
      }
    });
    Object.defineProperty(exports2, "GRAPHQL_MIN_INT", {
      enumerable: true,
      get: function() {
        return _index.GRAPHQL_MIN_INT;
      }
    });
    Object.defineProperty(exports2, "GraphQLBoolean", {
      enumerable: true,
      get: function() {
        return _index.GraphQLBoolean;
      }
    });
    Object.defineProperty(exports2, "GraphQLDeprecatedDirective", {
      enumerable: true,
      get: function() {
        return _index.GraphQLDeprecatedDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLDirective", {
      enumerable: true,
      get: function() {
        return _index.GraphQLDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLEnumType", {
      enumerable: true,
      get: function() {
        return _index.GraphQLEnumType;
      }
    });
    Object.defineProperty(exports2, "GraphQLError", {
      enumerable: true,
      get: function() {
        return _index5.GraphQLError;
      }
    });
    Object.defineProperty(exports2, "GraphQLFloat", {
      enumerable: true,
      get: function() {
        return _index.GraphQLFloat;
      }
    });
    Object.defineProperty(exports2, "GraphQLID", {
      enumerable: true,
      get: function() {
        return _index.GraphQLID;
      }
    });
    Object.defineProperty(exports2, "GraphQLIncludeDirective", {
      enumerable: true,
      get: function() {
        return _index.GraphQLIncludeDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLInputObjectType", {
      enumerable: true,
      get: function() {
        return _index.GraphQLInputObjectType;
      }
    });
    Object.defineProperty(exports2, "GraphQLInt", {
      enumerable: true,
      get: function() {
        return _index.GraphQLInt;
      }
    });
    Object.defineProperty(exports2, "GraphQLInterfaceType", {
      enumerable: true,
      get: function() {
        return _index.GraphQLInterfaceType;
      }
    });
    Object.defineProperty(exports2, "GraphQLList", {
      enumerable: true,
      get: function() {
        return _index.GraphQLList;
      }
    });
    Object.defineProperty(exports2, "GraphQLNonNull", {
      enumerable: true,
      get: function() {
        return _index.GraphQLNonNull;
      }
    });
    Object.defineProperty(exports2, "GraphQLObjectType", {
      enumerable: true,
      get: function() {
        return _index.GraphQLObjectType;
      }
    });
    Object.defineProperty(exports2, "GraphQLOneOfDirective", {
      enumerable: true,
      get: function() {
        return _index.GraphQLOneOfDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLScalarType", {
      enumerable: true,
      get: function() {
        return _index.GraphQLScalarType;
      }
    });
    Object.defineProperty(exports2, "GraphQLSchema", {
      enumerable: true,
      get: function() {
        return _index.GraphQLSchema;
      }
    });
    Object.defineProperty(exports2, "GraphQLSkipDirective", {
      enumerable: true,
      get: function() {
        return _index.GraphQLSkipDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLSpecifiedByDirective", {
      enumerable: true,
      get: function() {
        return _index.GraphQLSpecifiedByDirective;
      }
    });
    Object.defineProperty(exports2, "GraphQLString", {
      enumerable: true,
      get: function() {
        return _index.GraphQLString;
      }
    });
    Object.defineProperty(exports2, "GraphQLUnionType", {
      enumerable: true,
      get: function() {
        return _index.GraphQLUnionType;
      }
    });
    Object.defineProperty(exports2, "Kind", {
      enumerable: true,
      get: function() {
        return _index2.Kind;
      }
    });
    Object.defineProperty(exports2, "KnownArgumentNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.KnownArgumentNamesRule;
      }
    });
    Object.defineProperty(exports2, "KnownDirectivesRule", {
      enumerable: true,
      get: function() {
        return _index4.KnownDirectivesRule;
      }
    });
    Object.defineProperty(exports2, "KnownFragmentNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.KnownFragmentNamesRule;
      }
    });
    Object.defineProperty(exports2, "KnownTypeNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.KnownTypeNamesRule;
      }
    });
    Object.defineProperty(exports2, "Lexer", {
      enumerable: true,
      get: function() {
        return _index2.Lexer;
      }
    });
    Object.defineProperty(exports2, "Location", {
      enumerable: true,
      get: function() {
        return _index2.Location;
      }
    });
    Object.defineProperty(exports2, "LoneAnonymousOperationRule", {
      enumerable: true,
      get: function() {
        return _index4.LoneAnonymousOperationRule;
      }
    });
    Object.defineProperty(exports2, "LoneSchemaDefinitionRule", {
      enumerable: true,
      get: function() {
        return _index4.LoneSchemaDefinitionRule;
      }
    });
    Object.defineProperty(exports2, "MaxIntrospectionDepthRule", {
      enumerable: true,
      get: function() {
        return _index4.MaxIntrospectionDepthRule;
      }
    });
    Object.defineProperty(exports2, "NoDeprecatedCustomRule", {
      enumerable: true,
      get: function() {
        return _index4.NoDeprecatedCustomRule;
      }
    });
    Object.defineProperty(exports2, "NoFragmentCyclesRule", {
      enumerable: true,
      get: function() {
        return _index4.NoFragmentCyclesRule;
      }
    });
    Object.defineProperty(exports2, "NoSchemaIntrospectionCustomRule", {
      enumerable: true,
      get: function() {
        return _index4.NoSchemaIntrospectionCustomRule;
      }
    });
    Object.defineProperty(exports2, "NoUndefinedVariablesRule", {
      enumerable: true,
      get: function() {
        return _index4.NoUndefinedVariablesRule;
      }
    });
    Object.defineProperty(exports2, "NoUnusedFragmentsRule", {
      enumerable: true,
      get: function() {
        return _index4.NoUnusedFragmentsRule;
      }
    });
    Object.defineProperty(exports2, "NoUnusedVariablesRule", {
      enumerable: true,
      get: function() {
        return _index4.NoUnusedVariablesRule;
      }
    });
    Object.defineProperty(exports2, "OperationTypeNode", {
      enumerable: true,
      get: function() {
        return _index2.OperationTypeNode;
      }
    });
    Object.defineProperty(exports2, "OverlappingFieldsCanBeMergedRule", {
      enumerable: true,
      get: function() {
        return _index4.OverlappingFieldsCanBeMergedRule;
      }
    });
    Object.defineProperty(exports2, "PossibleFragmentSpreadsRule", {
      enumerable: true,
      get: function() {
        return _index4.PossibleFragmentSpreadsRule;
      }
    });
    Object.defineProperty(exports2, "PossibleTypeExtensionsRule", {
      enumerable: true,
      get: function() {
        return _index4.PossibleTypeExtensionsRule;
      }
    });
    Object.defineProperty(exports2, "ProvidedRequiredArgumentsRule", {
      enumerable: true,
      get: function() {
        return _index4.ProvidedRequiredArgumentsRule;
      }
    });
    Object.defineProperty(exports2, "ScalarLeafsRule", {
      enumerable: true,
      get: function() {
        return _index4.ScalarLeafsRule;
      }
    });
    Object.defineProperty(exports2, "SchemaMetaFieldDef", {
      enumerable: true,
      get: function() {
        return _index.SchemaMetaFieldDef;
      }
    });
    Object.defineProperty(exports2, "SingleFieldSubscriptionsRule", {
      enumerable: true,
      get: function() {
        return _index4.SingleFieldSubscriptionsRule;
      }
    });
    Object.defineProperty(exports2, "Source", {
      enumerable: true,
      get: function() {
        return _index2.Source;
      }
    });
    Object.defineProperty(exports2, "Token", {
      enumerable: true,
      get: function() {
        return _index2.Token;
      }
    });
    Object.defineProperty(exports2, "TokenKind", {
      enumerable: true,
      get: function() {
        return _index2.TokenKind;
      }
    });
    Object.defineProperty(exports2, "TypeInfo", {
      enumerable: true,
      get: function() {
        return _index6.TypeInfo;
      }
    });
    Object.defineProperty(exports2, "TypeKind", {
      enumerable: true,
      get: function() {
        return _index.TypeKind;
      }
    });
    Object.defineProperty(exports2, "TypeMetaFieldDef", {
      enumerable: true,
      get: function() {
        return _index.TypeMetaFieldDef;
      }
    });
    Object.defineProperty(exports2, "TypeNameMetaFieldDef", {
      enumerable: true,
      get: function() {
        return _index.TypeNameMetaFieldDef;
      }
    });
    Object.defineProperty(exports2, "UniqueArgumentDefinitionNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueArgumentDefinitionNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueArgumentNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueArgumentNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueDirectiveNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueDirectiveNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueDirectivesPerLocationRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueDirectivesPerLocationRule;
      }
    });
    Object.defineProperty(exports2, "UniqueEnumValueNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueEnumValueNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueFieldDefinitionNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueFieldDefinitionNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueFragmentNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueFragmentNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueInputFieldNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueInputFieldNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueOperationNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueOperationNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueOperationTypesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueOperationTypesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueTypeNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueTypeNamesRule;
      }
    });
    Object.defineProperty(exports2, "UniqueVariableNamesRule", {
      enumerable: true,
      get: function() {
        return _index4.UniqueVariableNamesRule;
      }
    });
    Object.defineProperty(exports2, "ValidationContext", {
      enumerable: true,
      get: function() {
        return _index4.ValidationContext;
      }
    });
    Object.defineProperty(exports2, "ValuesOfCorrectTypeRule", {
      enumerable: true,
      get: function() {
        return _index4.ValuesOfCorrectTypeRule;
      }
    });
    Object.defineProperty(exports2, "VariablesAreInputTypesRule", {
      enumerable: true,
      get: function() {
        return _index4.VariablesAreInputTypesRule;
      }
    });
    Object.defineProperty(exports2, "VariablesInAllowedPositionRule", {
      enumerable: true,
      get: function() {
        return _index4.VariablesInAllowedPositionRule;
      }
    });
    Object.defineProperty(exports2, "__Directive", {
      enumerable: true,
      get: function() {
        return _index.__Directive;
      }
    });
    Object.defineProperty(exports2, "__DirectiveLocation", {
      enumerable: true,
      get: function() {
        return _index.__DirectiveLocation;
      }
    });
    Object.defineProperty(exports2, "__EnumValue", {
      enumerable: true,
      get: function() {
        return _index.__EnumValue;
      }
    });
    Object.defineProperty(exports2, "__Field", {
      enumerable: true,
      get: function() {
        return _index.__Field;
      }
    });
    Object.defineProperty(exports2, "__InputValue", {
      enumerable: true,
      get: function() {
        return _index.__InputValue;
      }
    });
    Object.defineProperty(exports2, "__Schema", {
      enumerable: true,
      get: function() {
        return _index.__Schema;
      }
    });
    Object.defineProperty(exports2, "__Type", {
      enumerable: true,
      get: function() {
        return _index.__Type;
      }
    });
    Object.defineProperty(exports2, "__TypeKind", {
      enumerable: true,
      get: function() {
        return _index.__TypeKind;
      }
    });
    Object.defineProperty(exports2, "assertAbstractType", {
      enumerable: true,
      get: function() {
        return _index.assertAbstractType;
      }
    });
    Object.defineProperty(exports2, "assertCompositeType", {
      enumerable: true,
      get: function() {
        return _index.assertCompositeType;
      }
    });
    Object.defineProperty(exports2, "assertDirective", {
      enumerable: true,
      get: function() {
        return _index.assertDirective;
      }
    });
    Object.defineProperty(exports2, "assertEnumType", {
      enumerable: true,
      get: function() {
        return _index.assertEnumType;
      }
    });
    Object.defineProperty(exports2, "assertEnumValueName", {
      enumerable: true,
      get: function() {
        return _index.assertEnumValueName;
      }
    });
    Object.defineProperty(exports2, "assertInputObjectType", {
      enumerable: true,
      get: function() {
        return _index.assertInputObjectType;
      }
    });
    Object.defineProperty(exports2, "assertInputType", {
      enumerable: true,
      get: function() {
        return _index.assertInputType;
      }
    });
    Object.defineProperty(exports2, "assertInterfaceType", {
      enumerable: true,
      get: function() {
        return _index.assertInterfaceType;
      }
    });
    Object.defineProperty(exports2, "assertLeafType", {
      enumerable: true,
      get: function() {
        return _index.assertLeafType;
      }
    });
    Object.defineProperty(exports2, "assertListType", {
      enumerable: true,
      get: function() {
        return _index.assertListType;
      }
    });
    Object.defineProperty(exports2, "assertName", {
      enumerable: true,
      get: function() {
        return _index.assertName;
      }
    });
    Object.defineProperty(exports2, "assertNamedType", {
      enumerable: true,
      get: function() {
        return _index.assertNamedType;
      }
    });
    Object.defineProperty(exports2, "assertNonNullType", {
      enumerable: true,
      get: function() {
        return _index.assertNonNullType;
      }
    });
    Object.defineProperty(exports2, "assertNullableType", {
      enumerable: true,
      get: function() {
        return _index.assertNullableType;
      }
    });
    Object.defineProperty(exports2, "assertObjectType", {
      enumerable: true,
      get: function() {
        return _index.assertObjectType;
      }
    });
    Object.defineProperty(exports2, "assertOutputType", {
      enumerable: true,
      get: function() {
        return _index.assertOutputType;
      }
    });
    Object.defineProperty(exports2, "assertScalarType", {
      enumerable: true,
      get: function() {
        return _index.assertScalarType;
      }
    });
    Object.defineProperty(exports2, "assertSchema", {
      enumerable: true,
      get: function() {
        return _index.assertSchema;
      }
    });
    Object.defineProperty(exports2, "assertType", {
      enumerable: true,
      get: function() {
        return _index.assertType;
      }
    });
    Object.defineProperty(exports2, "assertUnionType", {
      enumerable: true,
      get: function() {
        return _index.assertUnionType;
      }
    });
    Object.defineProperty(exports2, "assertValidName", {
      enumerable: true,
      get: function() {
        return _index6.assertValidName;
      }
    });
    Object.defineProperty(exports2, "assertValidSchema", {
      enumerable: true,
      get: function() {
        return _index.assertValidSchema;
      }
    });
    Object.defineProperty(exports2, "assertWrappingType", {
      enumerable: true,
      get: function() {
        return _index.assertWrappingType;
      }
    });
    Object.defineProperty(exports2, "astFromValue", {
      enumerable: true,
      get: function() {
        return _index6.astFromValue;
      }
    });
    Object.defineProperty(exports2, "buildASTSchema", {
      enumerable: true,
      get: function() {
        return _index6.buildASTSchema;
      }
    });
    Object.defineProperty(exports2, "buildClientSchema", {
      enumerable: true,
      get: function() {
        return _index6.buildClientSchema;
      }
    });
    Object.defineProperty(exports2, "buildSchema", {
      enumerable: true,
      get: function() {
        return _index6.buildSchema;
      }
    });
    Object.defineProperty(exports2, "coerceInputValue", {
      enumerable: true,
      get: function() {
        return _index6.coerceInputValue;
      }
    });
    Object.defineProperty(exports2, "concatAST", {
      enumerable: true,
      get: function() {
        return _index6.concatAST;
      }
    });
    Object.defineProperty(exports2, "createSourceEventStream", {
      enumerable: true,
      get: function() {
        return _index3.createSourceEventStream;
      }
    });
    Object.defineProperty(exports2, "defaultFieldResolver", {
      enumerable: true,
      get: function() {
        return _index3.defaultFieldResolver;
      }
    });
    Object.defineProperty(exports2, "defaultTypeResolver", {
      enumerable: true,
      get: function() {
        return _index3.defaultTypeResolver;
      }
    });
    Object.defineProperty(exports2, "doTypesOverlap", {
      enumerable: true,
      get: function() {
        return _index6.doTypesOverlap;
      }
    });
    Object.defineProperty(exports2, "execute", {
      enumerable: true,
      get: function() {
        return _index3.execute;
      }
    });
    Object.defineProperty(exports2, "executeSync", {
      enumerable: true,
      get: function() {
        return _index3.executeSync;
      }
    });
    Object.defineProperty(exports2, "extendSchema", {
      enumerable: true,
      get: function() {
        return _index6.extendSchema;
      }
    });
    Object.defineProperty(exports2, "findBreakingChanges", {
      enumerable: true,
      get: function() {
        return _index6.findBreakingChanges;
      }
    });
    Object.defineProperty(exports2, "findDangerousChanges", {
      enumerable: true,
      get: function() {
        return _index6.findDangerousChanges;
      }
    });
    Object.defineProperty(exports2, "formatError", {
      enumerable: true,
      get: function() {
        return _index5.formatError;
      }
    });
    Object.defineProperty(exports2, "getArgumentValues", {
      enumerable: true,
      get: function() {
        return _index3.getArgumentValues;
      }
    });
    Object.defineProperty(exports2, "getDirectiveValues", {
      enumerable: true,
      get: function() {
        return _index3.getDirectiveValues;
      }
    });
    Object.defineProperty(exports2, "getEnterLeaveForKind", {
      enumerable: true,
      get: function() {
        return _index2.getEnterLeaveForKind;
      }
    });
    Object.defineProperty(exports2, "getIntrospectionQuery", {
      enumerable: true,
      get: function() {
        return _index6.getIntrospectionQuery;
      }
    });
    Object.defineProperty(exports2, "getLocation", {
      enumerable: true,
      get: function() {
        return _index2.getLocation;
      }
    });
    Object.defineProperty(exports2, "getNamedType", {
      enumerable: true,
      get: function() {
        return _index.getNamedType;
      }
    });
    Object.defineProperty(exports2, "getNullableType", {
      enumerable: true,
      get: function() {
        return _index.getNullableType;
      }
    });
    Object.defineProperty(exports2, "getOperationAST", {
      enumerable: true,
      get: function() {
        return _index6.getOperationAST;
      }
    });
    Object.defineProperty(exports2, "getOperationRootType", {
      enumerable: true,
      get: function() {
        return _index6.getOperationRootType;
      }
    });
    Object.defineProperty(exports2, "getVariableValues", {
      enumerable: true,
      get: function() {
        return _index3.getVariableValues;
      }
    });
    Object.defineProperty(exports2, "getVisitFn", {
      enumerable: true,
      get: function() {
        return _index2.getVisitFn;
      }
    });
    Object.defineProperty(exports2, "graphql", {
      enumerable: true,
      get: function() {
        return _graphql.graphql;
      }
    });
    Object.defineProperty(exports2, "graphqlSync", {
      enumerable: true,
      get: function() {
        return _graphql.graphqlSync;
      }
    });
    Object.defineProperty(exports2, "introspectionFromSchema", {
      enumerable: true,
      get: function() {
        return _index6.introspectionFromSchema;
      }
    });
    Object.defineProperty(exports2, "introspectionTypes", {
      enumerable: true,
      get: function() {
        return _index.introspectionTypes;
      }
    });
    Object.defineProperty(exports2, "isAbstractType", {
      enumerable: true,
      get: function() {
        return _index.isAbstractType;
      }
    });
    Object.defineProperty(exports2, "isCompositeType", {
      enumerable: true,
      get: function() {
        return _index.isCompositeType;
      }
    });
    Object.defineProperty(exports2, "isConstValueNode", {
      enumerable: true,
      get: function() {
        return _index2.isConstValueNode;
      }
    });
    Object.defineProperty(exports2, "isDefinitionNode", {
      enumerable: true,
      get: function() {
        return _index2.isDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isDirective", {
      enumerable: true,
      get: function() {
        return _index.isDirective;
      }
    });
    Object.defineProperty(exports2, "isEnumType", {
      enumerable: true,
      get: function() {
        return _index.isEnumType;
      }
    });
    Object.defineProperty(exports2, "isEqualType", {
      enumerable: true,
      get: function() {
        return _index6.isEqualType;
      }
    });
    Object.defineProperty(exports2, "isExecutableDefinitionNode", {
      enumerable: true,
      get: function() {
        return _index2.isExecutableDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isInputObjectType", {
      enumerable: true,
      get: function() {
        return _index.isInputObjectType;
      }
    });
    Object.defineProperty(exports2, "isInputType", {
      enumerable: true,
      get: function() {
        return _index.isInputType;
      }
    });
    Object.defineProperty(exports2, "isInterfaceType", {
      enumerable: true,
      get: function() {
        return _index.isInterfaceType;
      }
    });
    Object.defineProperty(exports2, "isIntrospectionType", {
      enumerable: true,
      get: function() {
        return _index.isIntrospectionType;
      }
    });
    Object.defineProperty(exports2, "isLeafType", {
      enumerable: true,
      get: function() {
        return _index.isLeafType;
      }
    });
    Object.defineProperty(exports2, "isListType", {
      enumerable: true,
      get: function() {
        return _index.isListType;
      }
    });
    Object.defineProperty(exports2, "isNamedType", {
      enumerable: true,
      get: function() {
        return _index.isNamedType;
      }
    });
    Object.defineProperty(exports2, "isNonNullType", {
      enumerable: true,
      get: function() {
        return _index.isNonNullType;
      }
    });
    Object.defineProperty(exports2, "isNullableType", {
      enumerable: true,
      get: function() {
        return _index.isNullableType;
      }
    });
    Object.defineProperty(exports2, "isObjectType", {
      enumerable: true,
      get: function() {
        return _index.isObjectType;
      }
    });
    Object.defineProperty(exports2, "isOutputType", {
      enumerable: true,
      get: function() {
        return _index.isOutputType;
      }
    });
    Object.defineProperty(exports2, "isRequiredArgument", {
      enumerable: true,
      get: function() {
        return _index.isRequiredArgument;
      }
    });
    Object.defineProperty(exports2, "isRequiredInputField", {
      enumerable: true,
      get: function() {
        return _index.isRequiredInputField;
      }
    });
    Object.defineProperty(exports2, "isScalarType", {
      enumerable: true,
      get: function() {
        return _index.isScalarType;
      }
    });
    Object.defineProperty(exports2, "isSchema", {
      enumerable: true,
      get: function() {
        return _index.isSchema;
      }
    });
    Object.defineProperty(exports2, "isSelectionNode", {
      enumerable: true,
      get: function() {
        return _index2.isSelectionNode;
      }
    });
    Object.defineProperty(exports2, "isSpecifiedDirective", {
      enumerable: true,
      get: function() {
        return _index.isSpecifiedDirective;
      }
    });
    Object.defineProperty(exports2, "isSpecifiedScalarType", {
      enumerable: true,
      get: function() {
        return _index.isSpecifiedScalarType;
      }
    });
    Object.defineProperty(exports2, "isType", {
      enumerable: true,
      get: function() {
        return _index.isType;
      }
    });
    Object.defineProperty(exports2, "isTypeDefinitionNode", {
      enumerable: true,
      get: function() {
        return _index2.isTypeDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeExtensionNode", {
      enumerable: true,
      get: function() {
        return _index2.isTypeExtensionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeNode", {
      enumerable: true,
      get: function() {
        return _index2.isTypeNode;
      }
    });
    Object.defineProperty(exports2, "isTypeSubTypeOf", {
      enumerable: true,
      get: function() {
        return _index6.isTypeSubTypeOf;
      }
    });
    Object.defineProperty(exports2, "isTypeSystemDefinitionNode", {
      enumerable: true,
      get: function() {
        return _index2.isTypeSystemDefinitionNode;
      }
    });
    Object.defineProperty(exports2, "isTypeSystemExtensionNode", {
      enumerable: true,
      get: function() {
        return _index2.isTypeSystemExtensionNode;
      }
    });
    Object.defineProperty(exports2, "isUnionType", {
      enumerable: true,
      get: function() {
        return _index.isUnionType;
      }
    });
    Object.defineProperty(exports2, "isValidNameError", {
      enumerable: true,
      get: function() {
        return _index6.isValidNameError;
      }
    });
    Object.defineProperty(exports2, "isValueNode", {
      enumerable: true,
      get: function() {
        return _index2.isValueNode;
      }
    });
    Object.defineProperty(exports2, "isWrappingType", {
      enumerable: true,
      get: function() {
        return _index.isWrappingType;
      }
    });
    Object.defineProperty(exports2, "lexicographicSortSchema", {
      enumerable: true,
      get: function() {
        return _index6.lexicographicSortSchema;
      }
    });
    Object.defineProperty(exports2, "locatedError", {
      enumerable: true,
      get: function() {
        return _index5.locatedError;
      }
    });
    Object.defineProperty(exports2, "parse", {
      enumerable: true,
      get: function() {
        return _index2.parse;
      }
    });
    Object.defineProperty(exports2, "parseConstValue", {
      enumerable: true,
      get: function() {
        return _index2.parseConstValue;
      }
    });
    Object.defineProperty(exports2, "parseType", {
      enumerable: true,
      get: function() {
        return _index2.parseType;
      }
    });
    Object.defineProperty(exports2, "parseValue", {
      enumerable: true,
      get: function() {
        return _index2.parseValue;
      }
    });
    Object.defineProperty(exports2, "print", {
      enumerable: true,
      get: function() {
        return _index2.print;
      }
    });
    Object.defineProperty(exports2, "printError", {
      enumerable: true,
      get: function() {
        return _index5.printError;
      }
    });
    Object.defineProperty(exports2, "printIntrospectionSchema", {
      enumerable: true,
      get: function() {
        return _index6.printIntrospectionSchema;
      }
    });
    Object.defineProperty(exports2, "printLocation", {
      enumerable: true,
      get: function() {
        return _index2.printLocation;
      }
    });
    Object.defineProperty(exports2, "printSchema", {
      enumerable: true,
      get: function() {
        return _index6.printSchema;
      }
    });
    Object.defineProperty(exports2, "printSourceLocation", {
      enumerable: true,
      get: function() {
        return _index2.printSourceLocation;
      }
    });
    Object.defineProperty(exports2, "printType", {
      enumerable: true,
      get: function() {
        return _index6.printType;
      }
    });
    Object.defineProperty(exports2, "recommendedRules", {
      enumerable: true,
      get: function() {
        return _index4.recommendedRules;
      }
    });
    Object.defineProperty(exports2, "resolveObjMapThunk", {
      enumerable: true,
      get: function() {
        return _index.resolveObjMapThunk;
      }
    });
    Object.defineProperty(exports2, "resolveReadonlyArrayThunk", {
      enumerable: true,
      get: function() {
        return _index.resolveReadonlyArrayThunk;
      }
    });
    Object.defineProperty(exports2, "responsePathAsArray", {
      enumerable: true,
      get: function() {
        return _index3.responsePathAsArray;
      }
    });
    Object.defineProperty(exports2, "separateOperations", {
      enumerable: true,
      get: function() {
        return _index6.separateOperations;
      }
    });
    Object.defineProperty(exports2, "specifiedDirectives", {
      enumerable: true,
      get: function() {
        return _index.specifiedDirectives;
      }
    });
    Object.defineProperty(exports2, "specifiedRules", {
      enumerable: true,
      get: function() {
        return _index4.specifiedRules;
      }
    });
    Object.defineProperty(exports2, "specifiedScalarTypes", {
      enumerable: true,
      get: function() {
        return _index.specifiedScalarTypes;
      }
    });
    Object.defineProperty(exports2, "stripIgnoredCharacters", {
      enumerable: true,
      get: function() {
        return _index6.stripIgnoredCharacters;
      }
    });
    Object.defineProperty(exports2, "subscribe", {
      enumerable: true,
      get: function() {
        return _index3.subscribe;
      }
    });
    Object.defineProperty(exports2, "syntaxError", {
      enumerable: true,
      get: function() {
        return _index5.syntaxError;
      }
    });
    Object.defineProperty(exports2, "typeFromAST", {
      enumerable: true,
      get: function() {
        return _index6.typeFromAST;
      }
    });
    Object.defineProperty(exports2, "validate", {
      enumerable: true,
      get: function() {
        return _index4.validate;
      }
    });
    Object.defineProperty(exports2, "validateSchema", {
      enumerable: true,
      get: function() {
        return _index.validateSchema;
      }
    });
    Object.defineProperty(exports2, "valueFromAST", {
      enumerable: true,
      get: function() {
        return _index6.valueFromAST;
      }
    });
    Object.defineProperty(exports2, "valueFromASTUntyped", {
      enumerable: true,
      get: function() {
        return _index6.valueFromASTUntyped;
      }
    });
    Object.defineProperty(exports2, "version", {
      enumerable: true,
      get: function() {
        return _version.version;
      }
    });
    Object.defineProperty(exports2, "versionInfo", {
      enumerable: true,
      get: function() {
        return _version.versionInfo;
      }
    });
    Object.defineProperty(exports2, "visit", {
      enumerable: true,
      get: function() {
        return _index2.visit;
      }
    });
    Object.defineProperty(exports2, "visitInParallel", {
      enumerable: true,
      get: function() {
        return _index2.visitInParallel;
      }
    });
    Object.defineProperty(exports2, "visitWithTypeInfo", {
      enumerable: true,
      get: function() {
        return _index6.visitWithTypeInfo;
      }
    });
    var _version = require_version();
    var _graphql = require_graphql();
    var _index = require_type();
    var _index2 = require_language();
    var _index3 = require_execution();
    var _index4 = require_validation();
    var _index5 = require_error();
    var _index6 = require_utilities();
  }
});

// scripts/codemods/data-masking/unmask.ts
var unmask_exports = {};
__export(unmask_exports, {
  default: () => unmask_default
});
module.exports = __toCommonJS(unmask_exports);
var import_graphql = __toESM(require_graphql2());
var import_node_path = __toESM(require("node:path"));
var LEADING_WHITESPACE = /^[\s\t]*(?=[\S\n])/;
var TRAILING_WHITESPACE = /(?<=[\S\n])[\s\t]*$/;
var DEFAULT_TAGS = ["gql", "graphql"];
var transform = function transform2(file, api, options) {
  const { tag = DEFAULT_TAGS, mode } = options;
  if (mode && mode !== "migrate") {
    console.warn(
      `The option --mode '${mode}' is not supported. Please use --mode 'migrate' to enable migrate mode for the @ummask directive.`
    );
  }
  const extname = import_node_path.default.extname(file.path);
  if (extname === ".graphql" || extname === ".gql") {
    return transformGraphQLFile(file.source, mode);
  }
  const j = api.jscodeshift;
  const source = j(file.source);
  const tagNames = Array.isArray(tag) ? tag : [tag];
  tagNames.forEach((tagName) => {
    addUnmaskToTaggedTemplate(tagName);
    addUnmaskToFunctionCall(tagName);
  });
  return source.toSource();
  function addUnmaskToFunctionCall(name) {
    source.find(j.CallExpression, {
      callee: { name },
      arguments: [{ type: "TemplateLiteral" }]
    }).forEach((p) => {
      addUnmaskToTemplateLiteral(j(p.value.arguments[0]));
    });
  }
  function addUnmaskToTaggedTemplate(name) {
    source.find(j.TaggedTemplateExpression, { tag: { name } }).forEach((taggedTemplateExpressionPath) => {
      addUnmaskToTemplateLiteral(
        j(taggedTemplateExpressionPath).find(j.TemplateLiteral)
      );
    });
  }
  function addUnmaskToTemplateLiteral(template) {
    template.find(j.TemplateElement).replaceWith((templateElementPath) => {
      const templateElement = templateElementPath.value;
      const queryString = templateElement.value.cooked || templateElement.value.raw;
      const document = parseDocument(queryString);
      if (document === null) {
        return templateElement;
      }
      const query = applyWhitepaceFromOriginalQuery(
        queryString,
        (0, import_graphql.print)(addUnmaskDirective(document, mode))
      );
      return j.templateElement(
        {
          raw: String.raw({ raw: [query] }),
          cooked: query
        },
        templateElement.tail
      );
    });
  }
};
function parseDocument(source) {
  try {
    return (0, import_graphql.parse)(source);
  } catch (e) {
    return null;
  }
}
function applyWhitepaceFromOriginalQuery(source, printed) {
  let firstNonWhitespaceLineNumber = null;
  const printedLines = printed.split("\n");
  return source.split("\n").map((line, idx) => {
    if (line.match(/^\s*$/)) {
      return line;
    }
    if (firstNonWhitespaceLineNumber === null) {
      firstNonWhitespaceLineNumber = idx;
    }
    const leading = getMatch(line, LEADING_WHITESPACE);
    const trailing = getMatch(line, TRAILING_WHITESPACE);
    const printedLine = printedLines[idx - firstNonWhitespaceLineNumber];
    const printedLeading = getMatch(printedLine, LEADING_WHITESPACE);
    const totalWhitespace = leading.length - printedLeading.length;
    return leading.slice(0, totalWhitespace) + printedLine + trailing;
  }).join("\n");
}
function addUnmaskDirective(document, mode) {
  return (0, import_graphql.visit)(document, {
    FragmentSpread: (node) => {
      if (node.directives?.some((directive) => directive.name.value === "unmask")) {
        return;
      }
      return {
        ...node,
        directives: [
          ...node.directives || [],
          {
            kind: import_graphql.Kind.DIRECTIVE,
            name: { kind: import_graphql.Kind.NAME, value: "unmask" },
            arguments: mode === "migrate" ? [
              {
                kind: import_graphql.Kind.ARGUMENT,
                name: { kind: import_graphql.Kind.NAME, value: "mode" },
                value: { kind: import_graphql.Kind.STRING, value: "migrate" }
              }
            ] : void 0
          }
        ]
      };
    }
  });
}
function getMatch(str, match) {
  return str.match(match)?.at(0) ?? "";
}
function transformGraphQLFile(source, mode) {
  return (0, import_graphql.print)(addUnmaskDirective((0, import_graphql.parse)(source), mode));
}
var unmask_default = transform;
