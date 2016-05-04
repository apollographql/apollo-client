import {
  GraphQLResult,
} from 'graphql';

export function graphQLResultHasError(result: GraphQLResult) {
  return result.errors && result.errors.length;
}
