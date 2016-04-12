/* tslint:disable */

process.env.NODE_ENV = 'test';

declare function require(name: string);
require('source-map-support').install();

import './writeToStore';
import './readFromStore';
import './roundtrip';
import './queryPrinting';
import './diffAgainstStore';
import './networkInterface';
import './QueryManager';
import './client';
import './middleware';
import './store';
