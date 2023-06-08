import { errorCodes } from '../invariantErrorCodes';
import { loadErrorMessageHandler } from './loadErrorMessageHandler';

export function loadErrorMessages() {
  loadErrorMessageHandler(errorCodes);
}
