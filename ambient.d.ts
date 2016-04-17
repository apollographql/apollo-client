/*

  LODASH

*/
declare module 'lodash.isobject' {
  import main = require('~lodash/index');
  export = main.isObject;
}

declare module 'lodash.isequal' {
  import main = require('~lodash/index');
  export = main.isEqual;
}

declare module 'lodash.isarray' {
  import main = require('~lodash/index');
  export = main.isArray;
}

declare module 'lodash.isnull' {
  import main = require('~lodash/index');
  export = main.isNull;
}

declare module 'lodash.isstring' {
  import main = require('~lodash/index');
  export = main.isString;
}

declare module 'lodash.has' {
  import main = require('~lodash/index');
  export = main.has;
}

declare module 'lodash.assign' {
  import main = require('~lodash/index');
  export = main.assign;
}

declare module 'lodash.includes' {
  import main = require('~lodash/index');
  export = main.includes;
}

declare module 'lodash.isnumber' {
  import main = require('~lodash/index');
  export = main.isNumber;
}

declare module 'lodash.isboolean' {
  import main = require('~lodash/index');
  export = main.isBoolean;
}

declare module 'lodash.isundefined' {
  import main = require('~lodash/index');
  export = main.isUndefined;
}

declare module 'lodash.forown' {
  import main = require('~lodash/index');
  export = main.forOwn;
}

declare module 'lodash.omit' {
  import main = require('~lodash/index');
  export = main.omit;
}

declare module 'lodash.mapvalues' {
  import main = require('~lodash/index');
  export = main.mapValues;
}

/*

  GRAPHQL

*/
declare module 'graphql/language/parser' {
  import { Source, ParseOptions, Document } from 'graphql';
  // XXX figure out how to directly export this method
  function parse(
      source: Source | string,
      options?: ParseOptions
  ): Document;
}

declare module 'graphql/language/printer' {
  function print(ast: any): string;
}
