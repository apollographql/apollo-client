import { StarWarsSchema } from './starWarsSchema.js';
import { graphql } from 'graphql';
import { introspectionQuery } from 'graphql/utilities/introspectionQuery';

export async function introspectStarwars() {
  return await graphql(StarWarsSchema, introspectionQuery);
}
