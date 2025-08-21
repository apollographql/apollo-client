/** @import { Plugin } from 'prettier' */

import * as prettier from "prettier";
import markdown from "prettier/plugins/markdown.js";

/** @type {Plugin["languages"]} */
export const languages = [
  {
    name: "MDX",
    parsers: ["mdx3"],
    extensions: [".mdx"],
  },
];
/** @type {Plugin["parsers"]} */
export const parsers = {
  mdx3: {
    ...markdown.parsers.mdx,
    astFormat: "mdx3",
  },
};

// matches e.g. "[!code ++]" "[!code highlight:3]" "[!code word:Cache]" or "[!code word:Cache:123]"
const codePattern = /\[!code ([a-z+-]+|word:((?:\\.|[^:\]])+))(:\d+)?\]/;
// matches repetitions with surrounding and in-between spaces, so e.g. "[!code ++] [!code highlight:3]"
const multiCodePattern = new RegExp(`(\\s*${codePattern.source})+\\s*`);
const patterns = [
  // "<!-- [!code ++] -->", "<!-- [!code ++] [!code highlight:3] -->"
  new RegExp(`<!--${multiCodePattern.source}-->`, "g"),
  // "{/* [!code ++] */", "/* [!code ++] [!code highlight:3] */}"
  new RegExp(`[{]/[*]${multiCodePattern.source}[*]/[}]`, "g"),
  // "/* [!code ++] */", "/* [!code ++] [!code highlight:3] */"
  new RegExp(`/[*]${multiCodePattern.source}[*]/`, "g"),
  // end-of line comments like "// [!code ++]", "# [!code highlight:3]", "-- [!code word:Cache] [!code --]""
  new RegExp(`(//|["'#]|;{1,2}|%{1,2}|--)${multiCodePattern.source}$`, "gm"),
];
const specialCommentPattern = new RegExp(
  `(${patterns.map((p) => `(${p.source})`).join("|")})`,
  "gm"
);

/**
 * Applied to code blocks to preserve special comments like `// [!code ...]` on the same line.
 */
function handleCodeBlockWithSpecialComments(node, path, options) {
  // Check if this code block has special comments
  const commentMatches = [...node.value.matchAll(specialCommentPattern)];
  // Nothing to do.
  if (commentMatches.length == 0) return null;

  /** `true` if comment should be inline, `false` if it should be on a new line. */
  const commentsInline = commentMatches.map((commentMatch) => {
    for (
      let index = commentMatch.index - 1, char = node.value[index];
      index >= 0 && char !== "\n";
      char = node.value[--index]
    ) {
      const char = node.value[index];
      if (char !== " " && char !== "\t") {
        return true;
      }
    }
    return false;
  });

  // Use default formatting first
  const defaultEmbed = markdown.printers.mdast.embed(path, options);
  return async (textToDoc) => {
    let stringResult = prettier.doc.printer.printDocToString(
      await defaultEmbed(textToDoc),
      options
    ).formatted;

    const formattedCommentMatches = [
      ...stringResult.matchAll(specialCommentPattern),
    ];

    // Process each comment in reverse order to avoid index shifting
    for (let i = formattedCommentMatches.length - 1; i >= 0; i--) {
      const commentMatch = formattedCommentMatches[i];
      const shouldBeInline = commentsInline[i];
      if (!shouldBeInline) continue;

      // Find the preceding non-whitespace character, starting from the comment position
      let insertPos = commentMatch.index - 1;
      while (insertPos >= 0 && /\s/.test(stringResult[insertPos])) {
        insertPos--;
      }

      stringResult =
        stringResult.substring(0, insertPos + 1) +
        stringResult.substring(commentMatch.index);
    }

    return stringResult;
  };
}

/** @type {Plugin["printers"]} */
export const printers = {
  mdx3: {
    ...markdown.printers.mdast,
    embed(path, options) {
      const node = path.node;

      if (node.type === "code" && node.lang !== null) {
        const result = handleCodeBlockWithSpecialComments(node, path, options);
        if (result) return result;
      }

      if (node.type === "jsx") {
        // If the node was parsed incorrectly because it followed the MDX3 format (no spacing around JSX tags),
        // we will not try to format it as MDX, but instead return the original value.

        // We detect that by looking at `value` - if it's only a starting or closing tag, it was parsed correctly.
        const correctlyParsedMatch = node.value.match(/^(<\/?[^>]*>)$/);
        if (!correctlyParsedMatch)
          return (
            node.value
              .split("\n")
              // But we need to restore the original indentation
              .map((line, idx) =>
                idx === 0 ? line : (
                  " ".repeat(node.position.indent[idx - 1] - 1) + line
                )
              )
              .join("\n")
          );
      }
      return markdown.printers.mdast.embed(path, options);
    },
  },
};
