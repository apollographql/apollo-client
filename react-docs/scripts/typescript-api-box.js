/* global hexo */

var path = require('path');
var fs = require('fs');
var handlebars = require('handlebars');
var _ = require('lodash');
var showdown  = require('showdown');
var parseTagOptions = require('./parseTagOptions');
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
  var options = parseTagOptions(args)

  var rawData = dataByKey[name];

  if (!rawData) {
    console.error("Couldn't find '" + name + "' in data");
    return '';
  }

  return template(_.extend(templateArgs(rawData), options));
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


  if ('Interface' === rawData.kindString) {
    groups.push({
      name: 'Properties',
      members: _interfaceProperties(rawData),
    });
  }

  var type;
  if ('Type alias' === rawData.kindString) {
    type = _type(rawData);
  }

  return {
    id: _typeId(rawData),
    name: rawData.name,
    type: type,
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
      var parameterString = _indexParameterString(signature);
      return _.extend(_parameter(signature), { name: parameterString });
    }),
    _.map(rawData.children, _parameter)
  );
};

function _indexParameterString(signature) {
  var parameterNamesAndTypes = _.map(signature.parameters, function(parameter) {
    return parameter.name + ':' + _typeName(parameter.type);
  });
  return _parameterString(parameterNamesAndTypes, '[', ']');
}

function _parameterString(names, leftDelim, rightDelim) {
  leftDelim = leftDelim || '(';
  rightDelim = rightDelim || ')';
  return leftDelim + names.join(', ') + rightDelim;
}

// Render the type of a data object. It's pretty confusing, to say the least
function _type(data, skipSignature) {
  if (data.kindString === 'Type alias' && data.type.declaration) {
    var declaration = data.type.declaration
    if (declaration.signatures) {
      return _type(declaration.signatures[0]);
    }

    if (declaration.indexSignature) {
      var signature = declaration.indexSignature[0]
      return _indexParameterString(signature) + ':' + _type(signature);
    }
  }

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
    if (type.isArray) {
      return '[' + type.name + ']';
    }
    return type.name;
  } else if (type.type === 'union') {
    return _.map(type.types, _typeName).join(' | ');
  } else if (type.type === 'reference') {
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

handlebars.registerHelper('markdown', function(text) {
  return converter.makeHtml(text);
});

// All h3s for now, will revisit
handlebars.registerHelper('hTag', function() {
  // return this.nested ? 'h3' : 'h2';
  return 'h3';
});
