import { devDebug, devError, devLog, devWarn } from "../invariantErrorCodes.js";
import { loadErrorMessageHandler } from "./loadErrorMessageHandler.js";

export function loadDevMessages() {
  loadErrorMessageHandler(devDebug, devError, devLog, devWarn);
}
