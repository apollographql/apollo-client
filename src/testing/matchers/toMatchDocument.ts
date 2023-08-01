import { checkDocument, print } from "../../utilities/index.js";
import type { DocumentNode } from "../../core/index.js";
import type { MatcherFunction } from "expect";

export const toMatchDocument: MatcherFunction<[document: DocumentNode]> =
  function (actual, document) {
    const hint = this.utils.matcherHint("toMatchDocument");
    const actualDocument = print(
      validateDocument(
        actual,
        hint +
          `\n\n${this.utils.RECEIVED_COLOR(
            "received"
          )} document must be a parsed document.`
      )
    );
    const expectedDocument = print(
      validateDocument(
        document,
        hint +
          `\n\n${this.utils.EXPECTED_COLOR(
            "expected"
          )} document must be a parsed document.`
      )
    );

    const pass = actualDocument === expectedDocument;

    return {
      pass,
      message: () => {
        const hint = this.utils.matcherHint(
          "toMatchDocument",
          undefined,
          undefined,
          { isNot: this.isNot }
        );

        if (pass) {
          return (
            hint +
            "\n\n" +
            "Received:\n\n" +
            this.utils.RECEIVED_COLOR(actualDocument)
          );
        }

        return (
          hint + "\n\n" + this.utils.diff(expectedDocument, actualDocument)
        );
      },
    };
  };

function validateDocument(document: unknown, message: string) {
  try {
    checkDocument(document as DocumentNode);
  } catch (e) {
    throw new Error(message);
  }

  return document as DocumentNode;
}
