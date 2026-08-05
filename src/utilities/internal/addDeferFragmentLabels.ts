import { DocumentTransform } from "@apollo/client";

export const addDeferFragmentLabels = new DocumentTransform((document) => {
  return document;
});
