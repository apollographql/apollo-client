/** @import { TSESTree as AST } from '@typescript-eslint/types' */
/** @import { Plugin, Printer } from 'prettier' */

import * as prettier from "prettier";
import estree from "prettier/plugins/estree.js";
import { parsers as tsParsers } from "prettier/plugins/typescript";

/** @type {Plugin["languages"]} */
export const languages = [
  {
    name: "TypeScript",
    parsers: ["typescript-with-jsdoc"],
  },
];
/** @type {Plugin["parsers"]} */
export const parsers = {
  "typescript-with-jsdoc": {
    ...tsParsers.typescript,
    astFormat: "typescript-with-jsdoc",
  },
};
/** @type {Printer} */
const estreePrinter = estree.printers.estree;
/** @type {Plugin["printers"]} */
export const printers = {
  "typescript-with-jsdoc": {
    ...estreePrinter,
    print(path, options, print, args) {
      return estreePrinter.print(path, options, print, args);
    },
    embed(path, options) {
      if (path.node.comments) {
        return async (textToDocForEmbed, mainPrint, path, options) => {
          const newComments = await Promise.all(
            Object.entries(path.node.comments)
              .filter(
                (/* @type {[string, AST.Comment]} */ [, comment]) =>
                  comment.type === "Block" && comment.value[0] === "*"
              )
              .map(
                async (/* @type {[string, AST.Comment]} */ [key, comment]) => {
                  const doc = await textToDocForEmbed(
                    comment.value
                      .split("\n")
                      .map((line) => line.replace(/^\s*\*/g, ""))
                      .join("\n"),
                    {
                      parser: "markdown",
                    }
                  );
                  const string = prettier.doc.printer.printDocToString(doc, {
                    ...options,
                    proseWrap: "preserve",
                    trailingComma: "none",
                  }).formatted;
                  // keep it single-line if it originally was single-line
                  if (
                    comment.value.trim().indexOf("\n") === -1 &&
                    string.trim().indexOf("\n") === -1
                  ) {
                    return [key, `* ${string} `];
                  }

                  return [
                    key,
                    "*\n" +
                      string
                        .split("\n")
                        .map((line) => "* " + line)
                        .join("\n") +
                      "\n",
                  ];
                }
              )
          );
          for (const [i, newCommment] of newComments) {
            /* @type {AST.Comment} */
            const nodeComent = path.node.comments[i];
            nodeComent.value = newCommment;
          }

          return mainPrint(path.node);
        };
      }
      return undefined;
    },
  },
};
