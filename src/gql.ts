import { parse } from 'graphql/language/parser';

import {
  Document,
} from 'graphql';

function parseDocument(doc: string): Document {
  const parsed = parse(doc);

  if (!parsed || parsed.kind !== 'Document') {
    throw new Error('Not a valid GraphQL document.');
  }

  return parsed as Document;
}

// XXX This should eventually disallow arbitrary string interpolation, like Relay does
export default function gql(literals, ...substitutions): Document {
  let result = '';

  // run the loop only for the substitution count
  for (let i = 0; i < substitutions.length; i++) {
      result += literals[i];
      result += substitutions[i];
  }

  // add the last literal
  result += literals[literals.length - 1];

  return parseDocument(result);
}

export function register() {
  global['gql'] = gql;
}
