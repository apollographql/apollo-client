/*
  LODASH
*/
declare module 'lodash.isobject' {
  export = require('lodash.isObject');
}

declare module 'lodash.isequal' {
  export = require('lodash.isEqual');
}

declare module 'lodash.isnull' {
  export = require('lodash.isNull');
}

declare module 'lodash.isstring' {
  export = require('lodash.isString');
}

declare module 'lodash.isnumber' {
  export = require('lodash.isNumber');
}

declare module 'lodash.isboolean' {
  export = require('lodash.isBoolean');
}

declare module 'lodash.isundefined' {
  export = require('lodash.isUndefined');
}

declare module 'lodash.forown' {
  export = require('lodash.forOwn');
}

declare module 'lodash.mapvalues' {
  export = require('lodash.mapValues');
}

declare module 'lodash.clonedeep' {
  export = require('lodash.cloneDeep');
}

declare module 'lodash.countby' {
  export = require('lodash.countBy');
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
