import { DocumentNode, print as originalPrint, stripIgnoredCharacters } from 'graphql';

export const print = (queryString: DocumentNode) => {
  return stripIgnoredCharacters
    ? stripIgnoredCharacters(originalPrint(queryString))
    : originalPrint(queryString)
};
