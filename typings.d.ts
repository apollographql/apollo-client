// This should (and generally does) get picked up automatically as it's installed
// at @types/es6-shim, but it doesn't work in typedoc (or Atom it seems),
// so we include it here manually
/// <reference types="typed-graphql" />
/// <reference path="node_modules/typescript/lib/lib.es2015.d.ts" />
/// <reference path="node_modules/typescript/lib/lib.dom.d.ts" />

/*

  LODASH

*/
declare module 'lodash.isobject' {
  import main = require('lodash');
  export = main.isObject;
}

declare module 'lodash.isequal' {
  import main = require('lodash');
  export = main.isEqual;
}

declare module 'lodash.isnull' {
  import main = require('lodash');
  export = main.isNull;
}

declare module 'lodash.isstring' {
  import main = require('lodash');
  export = main.isString;
}

declare module 'lodash.has' {
  import main = require('lodash');
  export = main.has;
}

declare module 'lodash.assign' {
  import main = require('lodash');
  export = main.assign;
}

declare module 'lodash.merge' {
  import main = require('lodash');
  export = main.merge;
}

declare module 'lodash.includes' {
  import main = require('lodash');
  export = main.includes;
}

declare module 'lodash.isnumber' {
  import main = require('lodash');
  export = main.isNumber;
}

declare module 'lodash.isboolean' {
  import main = require('lodash');
  export = main.isBoolean;
}

declare module 'lodash.isundefined' {
  import main = require('lodash');
  export = main.isUndefined;
}

declare module 'lodash.forown' {
  import main = require('lodash');
  export = main.forOwn;
}

declare module 'lodash.omit' {
  import main = require('lodash');
  export = main.omit;
}

declare module 'lodash.mapvalues' {
  import main = require('lodash');
  export = main.mapValues;
}

declare module 'lodash.clonedeep' {
  import main = require('lodash');
  export = main.cloneDeep;
}

declare module 'lodash.countby' {
  import main = require('lodash');
  export = main.countBy;
}

declare module 'lodash.identity' {
  import main = require('lodash');
  export = main.identity;
}

declare module 'lodash.flatten' {
  import main = require('lodash');
  export = main.flatten;
}

declare module 'lodash.pick' {
  import main = require('lodash');
  export = main.pick;
}

declare module 'lodash.uniq' {
  import main = require('lodash');
  export = main.uniq;
}
/*

  GRAPHQL

*/
declare module 'graphql-tag/parser' {
  import { Source, ParseOptions, Document } from 'graphql';
  // XXX figure out how to directly export this method
  function parse(
      source: Source | string,
      options?: ParseOptions
  ): Document;
}

declare module 'graphql-tag/printer' {
  function print(ast: any): string;
}

declare module 'deep-assign' {
  function deepAssign(...objects: any[]): any;
  export = deepAssign;
}
