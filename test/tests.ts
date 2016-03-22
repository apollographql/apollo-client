/* tslint:disable */

declare function require(name: string);
require('source-map-support').install();

import './writeToStore';
import './readFromStore';
import './roundtrip';
import './queryPrinting';
import './diffAgainstStore';
import './networkInterface';
import './QueryDisperser';
