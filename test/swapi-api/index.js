import { Schema } from './schema';
import { parseIfString } from '../../src/parser';
import { execute } from 'graphql/execution';

export function runQuery(query) {
  return execute(
    Schema,
    parseIfString(query)
  );
}
