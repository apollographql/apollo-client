import { glob, readFile, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { parseArgs } from "node:util";

import { dump, load } from "js-yaml";

const mdRegex = /\s*---([^]*?)\n\s*---(\s*(?:\n|$)[^]*)/;

const categorizedFile = join(import.meta.dirname, "categorized.yaml");
const categorized = load(await readFile(categorizedFile, "utf-8")) || {};

const {
  values: { updateExisting },
} = parseArgs({
  options: {
    updateExisting: {
      type: "boolean",
      default: false,
      short: "u",
      description: "Update the categorized file with new entries",
    },
  },
});

for await (const file of glob(
  join(import.meta.dirname, "../../../.changeset", "*.md")
)) {
  const { name } = parse(file);
  if (name === "README") continue;
  const content = await readFile(file, "utf-8");
  const match = mdRegex.exec(content);
  if (!match) {
    console.error(`File ${file} does not match expected format.`);
    process.exit(1);
  }
  const [, frontmatter, body] = match;
  const parsed = load(frontmatter) || {};
  const tags = parsed._tags || [];
  for (const tag of tags) {
    categorized[tag] ??= {};
    if (updateExisting || !categorized[tag][name]) {
      categorized[tag][name] = body.trim();
    }
  }
}

await writeFile(categorizedFile, dump(categorized));
