"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var graphql_1 = require("graphql");
var node_path_1 = require("node:path");
var LEADING_WHITESPACE = /^[\s\t]*(?=[\S\n])/;
var TRAILING_WHITESPACE = /(?<=[\S\n])[\s\t]*$/;
var DEFAULT_TAGS = ["gql", "graphql"];
var transform = function transform(file, api, options) {
    var _a = options.tag, tag = _a === void 0 ? DEFAULT_TAGS : _a, mode = options.mode;
    if (mode && mode !== "migrate") {
        console.warn("The option --mode '".concat(mode, "' is not supported. Please use --mode 'migrate' to enable migrate mode for the @ummask directive."));
    }
    var extname = node_path_1.default.extname(file.path);
    if (extname === ".graphql" || extname === ".gql") {
        return transformGraphQLFile(file.source, mode);
    }
    var j = api.jscodeshift;
    var source = j(file.source);
    var tagNames = Array.isArray(tag) ? tag : [tag];
    tagNames.forEach(function (tagName) {
        addUnmaskToTaggedTemplate(tagName);
        addUnmaskToFunctionCall(tagName);
    });
    return source.toSource();
    function addUnmaskToFunctionCall(name) {
        source
            .find(j.CallExpression, {
            callee: { name: name },
            arguments: [{ type: "TemplateLiteral" }],
        })
            .forEach(function (p) {
            addUnmaskToTemplateLiteral(j(p.value.arguments[0]));
        });
    }
    function addUnmaskToTaggedTemplate(name) {
        source
            .find(j.TaggedTemplateExpression, { tag: { name: name } })
            .forEach(function (taggedTemplateExpressionPath) {
            addUnmaskToTemplateLiteral(j(taggedTemplateExpressionPath).find(j.TemplateLiteral));
        });
    }
    function addUnmaskToTemplateLiteral(template) {
        template.find(j.TemplateElement).replaceWith(function (templateElementPath) {
            var templateElement = templateElementPath.value;
            var queryString = templateElement.value.cooked || templateElement.value.raw;
            var document = parseDocument(queryString);
            if (document === null) {
                return templateElement;
            }
            var query = applyWhitepaceFromOriginalQuery(queryString, (0, graphql_1.print)(addUnmaskDirective(document, mode)));
            return j.templateElement({
                raw: String.raw({ raw: [query] }),
                cooked: query,
            }, templateElement.tail);
        });
    }
};
function parseDocument(source) {
    try {
        return (0, graphql_1.parse)(source);
    }
    catch (e) {
        return null;
    }
}
function applyWhitepaceFromOriginalQuery(source, printed) {
    var firstNonWhitespaceLineNumber = null;
    var printedLines = printed.split("\n");
    return source
        .split("\n")
        .map(function (line, idx) {
        if (line.match(/^\s*$/)) {
            return line;
        }
        if (firstNonWhitespaceLineNumber === null) {
            firstNonWhitespaceLineNumber = idx;
        }
        var leading = getMatch(line, LEADING_WHITESPACE);
        var trailing = getMatch(line, TRAILING_WHITESPACE);
        var printedLine = printedLines[idx - firstNonWhitespaceLineNumber];
        var printedLeading = getMatch(printedLine, LEADING_WHITESPACE);
        var totalWhitespace = leading.length - printedLeading.length;
        return leading.slice(0, totalWhitespace) + printedLine + trailing;
    })
        .join("\n");
}
function addUnmaskDirective(document, mode) {
    return (0, graphql_1.visit)(document, {
        FragmentSpread: function (node) {
            var _a;
            if ((_a = node.directives) === null || _a === void 0 ? void 0 : _a.some(function (directive) { return directive.name.value === "unmask"; })) {
                return;
            }
            return __assign(__assign({}, node), { directives: __spreadArray(__spreadArray([], (node.directives || []), true), [
                    {
                        kind: graphql_1.Kind.DIRECTIVE,
                        name: { kind: graphql_1.Kind.NAME, value: "unmask" },
                        arguments: mode === "migrate" ?
                            [
                                {
                                    kind: graphql_1.Kind.ARGUMENT,
                                    name: { kind: graphql_1.Kind.NAME, value: "mode" },
                                    value: { kind: graphql_1.Kind.STRING, value: "migrate" },
                                },
                            ]
                            : undefined,
                    },
                ], false) });
        },
    });
}
function getMatch(str, match) {
    var _a, _b;
    return (_b = (_a = str.match(match)) === null || _a === void 0 ? void 0 : _a.at(0)) !== null && _b !== void 0 ? _b : "";
}
function transformGraphQLFile(source, mode) {
    return (0, graphql_1.print)(addUnmaskDirective((0, graphql_1.parse)(source), mode));
}
exports.default = transform;
