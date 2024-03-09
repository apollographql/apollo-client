import { global } from "../utilities/globals/index.js";
import { ApolloSuppressErrorMessages } from "../utilities/globals/invariantWrappers.js";

export function suppressErrorMessages(): void {
  global[ApolloSuppressErrorMessages] = true;
}
