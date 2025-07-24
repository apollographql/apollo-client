/** @import { TSESTree as AST } from '@typescript-eslint/types' */
/** @import { transforms as commentTransforms } from 'comment-parser' */
/** @import { Plugin, Printer } from 'prettier' */

import {parse as parseComment, stringify, transforms as commentTransforms} from 'comment-parser'
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
export const parsers= {
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
      if (path.node.comments){
        return async (textToDocForEmbed, mainPrint, path, options) => {
          const newComments = await Promise.all(path.node.comments.map(
            async (/* @type {AST.Comment} */comment) => {
             const doc = await textToDocForEmbed(
                comment.value.split("\n").map(line => line.replace(/^\s*\*/g, "")).join("\n"),
                {
                  parser: "markdown"
                },
              );
              const string = prettier.doc.printer.printDocToString(doc, options).formatted
              if (string.trim().indexOf("\n") === -1) {
                return `* ${string} `;
              }

              return "*\n"+string.split("\n").map(line => "* "+line).join("\n")+"\n"
            }
          ))
          for (let i = 0; i < newComments.length; i++) {
            /* @type {AST.Comment} */
            const nodeComent= path.node.comments[i]
            nodeComent.value = newComments[i];
          }
           return mainPrint(path);
        }
      }
      return estreePrinter.embed(path, options);
    },
  },
};
