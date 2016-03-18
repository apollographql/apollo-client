import { Schema } from './schema';
import { parseIfString } from '../../src/parser';
import { execute } from 'graphql/execution';

export function readQueryFromStore(query) {
  return execute(
    Schema,
    parseIfString(query)
  );
}
