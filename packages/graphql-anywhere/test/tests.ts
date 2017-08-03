/* tslint:disable */
// ensure support for fetch and promise
import 'es6-promise';
import 'isomorphic-fetch';

process.env.NODE_ENV = 'test';

declare function require(name: string)
require('source-map-support').install();

import './anywhere';
import './mapper';
import './matcher';
import './directives';
import './utilities';
