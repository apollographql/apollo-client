import { devDebug, devError, devLog, devWarn } from '../invariantErrorCodes';
import { loadErrorMessageHandler } from './loadErrorMessageHandler';

export function loadDevMessages() {
  loadErrorMessageHandler(devDebug, devError, devLog, devWarn);
}
