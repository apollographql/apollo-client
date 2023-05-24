import { checkDocument } from '../../utilities';
import { print } from 'graphql';
import type { DocumentNode } from '../../core';
import type { MatcherFunction } from 'expect';

export const toMatchDocument: MatcherFunction<[document: DocumentNode]> =
  function (actual, document) {
    const actualDocument = print(checkDocument(actual as DocumentNode));
    const expectedDocument = print(checkDocument(document));

    const pass = actualDocument === expectedDocument;

    return {
      pass,
      message: () => {
        const hint = this.utils.matcherHint(
          'toMatchDocument',
          undefined,
          undefined,
          { isNot: this.isNot }
        );

        if (pass) {
          return (
            hint +
            '\n\n' +
            'Received:\n\n' +
            this.utils.RECEIVED_COLOR(actualDocument)
          );
        }

        return (
          hint + '\n\n' + this.utils.diff(expectedDocument, actualDocument)
        );
      },
    };
  };
