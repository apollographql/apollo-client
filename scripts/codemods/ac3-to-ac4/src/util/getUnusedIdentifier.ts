import type { UtilContext } from "../types.js";

export function getUnusedIdentifier({
  similarTo,
  context: { j, source },
}: {
  similarTo: string;
  context: UtilContext;
}) {
  let identifier = similarTo;
  let counter = 0;
  while (source.find(j.Identifier, { name: identifier }).size() > 0) {
    identifier = `${similarTo}_${++counter}`;
  }
  return identifier;
}
