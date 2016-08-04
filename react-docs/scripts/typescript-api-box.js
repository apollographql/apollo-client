/* global hexo */

var path = require('path');
var fs = require('fs');
var handlebars = require('handlebars');
var _ = require('lodash');
var showdown  = require('showdown');
var converter = new showdown.Converter();

// can't put this file in this folder annoyingly
var html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'typescript-api-box.html'), 'utf8');
var template = handlebars.compile(html);

if (!hexo.config.typescript_api_box || !hexo.config.typescript_api_box.data_file) {
  throw new Error("You need to provide the location of the api box data file in config.typescript_api_box.data_file");
}

var dataPath = path.join(hexo.base_dir, hexo.config.typescript_api_box.data_file);
var allData = require(dataPath);

// First walk the data tree and gather everything together
var dataByKey = {};
function traverse(tree, parentName) {
  var name = tree.name;
  if (_.includes(['Constructor', 'Method', 'Property'], tree.kindString)) {
    name = parentName + '.' + tree.name
  }
  dataByKey[name] = tree;

  _.each(tree.children, function(child) {
    traverse(child, name)
  });
}
traverse(allData);

hexo.extend.tag.register('tsapibox', function(args) {
  var name = args.shift();
  var rawData = dataByKey[name];

  if (!rawData) {
    console.error("Couldn't find '" + name + "' in data");
    return '';
  }
  console.log(name, rawData);

  return template(templateArgs(rawData));
});

function templateArgs(rawData) {
  var parameters = _parameters(rawData);
  var split = _.partition(parameters, 'isOptions');

  var groups = [];
  if (split[1].length > 0) {
    groups.push({
      name: 'Arguments',
      members: split[1]
    });
  }
  if (split[0].length > 0) {
    groups.push({
      name: 'Options',
      // the properties of the options parameter are the things listed in this group
      members: split[0][0].properties
    });
  }

  if (_.includes(['Type alias', 'Interface'], rawData.kindString)) {
    groups.push({
      name: 'Properties',
      members: _interfaceProperties(rawData),
    });
  }

  return {
    id: _typeId(rawData),
    name: rawData.name,
    signature: _signature(rawData, parameters),
    groups: groups,
    repo: 'apollostack/apollo-client',
    filepath: rawData.sources[0].fileName,
    lineno: rawData.sources[0].line,
  };
}

// XXX: not sure whether to use the 'kind' enum from TS or just run with the
// strings. Strings seem safe enough I guess
function _signature(rawData, parameters) {
  var escapedName = _.escape(rawData.name);

  // if it is a function, and therefore has arguments
  if (_.includes(['Function', 'Constructor'], rawData.kindString)) {
    var signature = rawData.signatures && rawData.signatures[0];
    return signature.name + _parameterString(_.map(parameters, 'name'));
  }

  return escapedName;
}


// Takes the data about a function / constructor and parses out the named params
function _parameters(rawData) {
  var signature = rawData.signatures && rawData.signatures[0];
  if (!signature) {
    return [];
  }

  return _.map(signature.parameters, function (param) {
    var name;
    if (isReadableName(param.name)) {
      name = param.name;
    } else if (isReadableName(param.originalName)) {
      name = param.originalName;
    } else {
      // XXX: not sure if this is the correct logic, but it feel OK
      name = 'options';
    }

    var properties = [];
    if (param.type && param.type.declaration) {
      properties = _.map(param.type.declaration.children, _parameter);
    }

    return _.extend(_parameter(param), {
      name: name,
      isOptions: name === 'options',
      optional: !!param.defaultValue,
      properties: properties
    });
  });
}

function _parameter(parameter) {
  return {
    name: parameter.name,
    type: _type(parameter),
    description: parameter.comment && parameter.comment.text
  };
}

function _interfaceProperties(rawData) {
  return [].concat(
    _.map(rawData.indexSignature, function(signature) {
      var parameterNamesAndTypes = _.map(signature.parameters, function(parameter) {
        return parameter.name + ':' + _typeName(parameter.type);
      });
      var parameterString = _parameterString(parameterNamesAndTypes, '[', ']');
      return _.extend(_parameter(signature), { name: parameterString });
    }),
    _.map(rawData.children, _parameter)
  );
};

function _parameterString(names, leftDelim, rightDelim) {
  leftDelim = leftDelim || '(';
  rightDelim = rightDelim || ')';
  return leftDelim + names.join(', ') + rightDelim;
}

function _type(data, skipSignature) {
  if (data.kindString === 'Method') {
    return _type(data.signatures[0])
  }

  if (data.kindString === 'Call signature' && !skipSignature) {
    var args = '(' + _.map(data.parameters, _type).join(', ') + ')';
    return args + ' => ' + _type(data, true);
  }

  var type = data.type;
  var typeName = _typeName(type);
  if (type.typeArguments) {
    return typeName + _parameterString(_.map(type.typeArguments, _typeName), '<', '>');
  }
  return typeName;
}

function _typeName(type) {
  if (type.type === 'instrinct') {
    return type.name;
  } if (type.type === 'reference') {
    return '<a href="#' + _typeId(type) + '">' + type.name + '</a>';
  } else {
    var signatures = type.declaration.indexSignature || type.declaration.signatures;
    if (signatures) {
      return signatures[0].type.name;
    } else {
      // XXX: ?
      return 'object';
    }
  }
}

function _typeId(type) {
  return type.name;
}

function isReadableName(name) {
  return name.substring(0, 2) !== '__';
}

// Get first child in group
function getFirst(data, kindString) {
  return _.find(data.children, { kindString: kindString });
}

// XXX: below here is kept for reference (for now)

//   var escapedLongname = _.escape(data.longname);
//
//   var paramsStr = '';
//
//   if (!options.short) {
//     if (data.istemplate || data.ishelper) {
//       var params = data.params;
//
//       var paramNames = _.map(params, function (param) {
//         var name = param.name;
//
//         name = name + "=" + name;
//
//         if (param.optional) {
//           return "[" + name + "]";
//         }
//
//         return name;
//       });
//
//       paramsStr = ' ' + paramNames.join(" ") + ' ';
//     } else {
//       }
//     }
//   }
//
//   if (data.istemplate) {
//     return '{{> ' + escapedLongname + paramsStr + ' }}';
//   } else if (data.ishelper){
//     return '{{ ' + escapedLongname + paramsStr + ' }}';
//   } else {
//     if (data.kind === "class" && !options.short) {
//       escapedLongname = 'new ' + escapedLongname;
//     }
//
//     // In general, if we are looking at an instance method, we want to show it as
//     //   Something#foo or #foo (if short). However, when it's on something called
//     //   `this`, we'll do the slightly weird thing of showing `this.foo` in both cases.
//     if (data.scope === "instance" && apiData(data.memberof).instancename === 'this') {
//       escapedLongname = "<em>this</em>." + data.name;
//     } else if (data.scope === "instance" && options.short) {
//       // Something#foo => #foo
//       return '<em>' + options.instanceDelimiter + '</em>' + escapedLongname.split('#')[1];
//     }
//
//     // If the user passes in a instanceDelimiter and we are a static method,
//     // we are probably underneath a heading that defines the object (e.g. DDPRateLimiter)
//     if (data.scope === "static" && options.instanceDelimiter && options.short) {
//       // Something.foo => .foo
//       return '<em>' + options.instanceDelimiter + '</em>' + escapedLongname.split('.')[1];
//     }
//
//     return escapedLongname + paramsStr;
//   }
// };



//   var options = parseTagOptions(args)
//   var defaults = {
//     // by default, nest if it's a instance method
//     nested: name.indexOf('#') !== -1,
//     instanceDelimiter: '#'
//   };
//   var data = _.extend({}, defaults, options, apiData({ name: name }));
//
//   data.id = data.longname.replace(/[.#]/g, "-");
//
//   data.signature = signature(data, { short: false });
//   data.title = signature(data, {
//     short: true,
//     instanceDelimiter: data.instanceDelimiter,
//   });
//   data.importName = importName(data);
//   data.paramsNoOptions = paramsNoOptions(data);
//
// });
//
//
// var apiData = function (options) {
//   options = options || {};
//   if (typeof options === "string") {
//     options = {name: options};
//   }
//
//   var root = DocsData[options.name];
//
//   if (! root) {
//     console.log("API Data not found: " + options.name);
//   }
//
//   if (_.has(options, 'options')) {
//     root = _.clone(root);
//     var includedOptions = options.options.split(';');
//     root.options = _.filter(root.options, function (option) {
//       return _.contains(includedOptions, option.name);
//     });
//   }
//
//   return root;
// };
//
//
// var importName = function(doc) {
//   const noImportNeeded = !doc.module
//     || doc.scope === 'instance'
//     || doc.ishelper
//     || doc.istemplate;
//
//   // override the above we've explicitly decided to (i.e. Template.foo.X)
//   if (!noImportNeeded || doc.importfrompackage) {
//     if (doc.memberof) {
//       return doc.memberof.split('.')[0];
//     } else {
//       return doc.name;
//     }
//   }
// };
//
// var paramsNoOptions = function (doc) {
//   return _.reject(doc.params, function (param) {
//     return param.name === "options";
//   });
// };
//
// var typeLink = function (displayName, url) {
//   return "<a href='" + url + "'>" + displayName + "</a>";
// };
//
// var toOrSentence = function (array) {
//   if (array.length === 1) {
//     return array[0];
//   } else if (array.length === 2) {
//     return array.join(" or ");
//   }
//
//   return _.initial(array).join(", ") + ", or " + _.last(array);
// };
//
// var typeNameTranslation = {
//   "function": "Function",
//   EJSON: typeLink("EJSON-able Object", "#ejson"),
//   EJSONable: typeLink("EJSON-able Object", "#ejson"),
//   "Tracker.Computation": typeLink("Tracker.Computation", "#tracker_computation"),
//   MongoSelector: [
//     typeLink("Mongo Selector", "#selectors"),
//     typeLink("Object ID", "#mongo_object_id"),
//     "String"
//   ],
//   MongoModifier: typeLink("Mongo Modifier", "#modifiers"),
//   MongoSortSpecifier: typeLink("Mongo Sort Specifier", "#sortspecifiers"),
//   MongoFieldSpecifier: typeLink("Mongo Field Specifier", "#fieldspecifiers"),
//   JSONCompatible: "JSON-compatible Object",
//   EventMap: typeLink("Event Map", "#eventmaps"),
//   DOMNode: typeLink("DOM Node", "https://developer.mozilla.org/en-US/docs/Web/API/Node"),
//   "Blaze.View": typeLink("Blaze.View", "#blaze_view"),
//   Template: typeLink("Blaze.Template", "#blaze_template"),
//   DOMElement: typeLink("DOM Element", "https://developer.mozilla.org/en-US/docs/Web/API/element"),
//   MatchPattern: typeLink("Match Pattern", "#matchpatterns"),
//   "DDP.Connection": typeLink("DDP Connection", "#ddp_connect")
// };
//
// handlebars.registerHelper('typeNames', function typeNames (nameList) {
//   // change names if necessary
//   nameList = _.map(nameList, function (name) {
//     // decode the "Array.<Type>" syntax
//     if (name.slice(0, 7) === "Array.<") {
//       // get the part inside angle brackets like in Array<String>
//       name = name.match(/<([^>]+)>/)[1];
//
//       if (name && typeNameTranslation.hasOwnProperty(name)) {
//         return "Array of " + typeNameTranslation[name] + "s";
//       }
//
//       if (name) {
//         return "Array of " + name + "s";
//       }
//
//       console.log("no array type defined");
//       return "Array";
//     }
//
//     if (typeNameTranslation.hasOwnProperty(name)) {
//       return typeNameTranslation[name];
//     }
//
//     if (DocsData[name]) {
//       return typeNames(DocsData[name].type);
//     }
//
//     return name;
//   });
//
//   nameList = _.flatten(nameList);
//
//   return toOrSentence(nameList);
// });

handlebars.registerHelper('markdown', function(text) {
  return converter.makeHtml(text);
});
//
// handlebars.registerHelper('hTag', function() {
//   return this.nested ? 'h3' : 'h2';
// });
