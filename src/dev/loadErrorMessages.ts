import { errorCodes } from "../invariantErrorCodes.js";
import { loadErrorMessageHandler } from "./loadErrorMessageHandler.js";

export function loadErrorMessages() {
  loadErrorMessageHandler(errorCodes);
}
