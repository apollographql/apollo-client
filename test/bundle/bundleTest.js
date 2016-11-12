import { QueryManager } from '../../lib/src/core/QueryManager.js';
import { ObservableQuery } from '../../lib/src/core/ObservableQuery.js';

if (!QueryManager || !ObservableQuery)
  throw new Error('Circular dependency detected!');