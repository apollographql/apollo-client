import errorObj from '../../invariantErrorCodes';
import { global } from '../globals';
import {ApolloErrorMessageHandler} from '../globals/invariantWrappers';

export function loadErrorMessages(){
  global[ApolloErrorMessageHandler] = (message?: string | number, getArgsLazy?: () => unknown[]) => {
    if (typeof message === "number") {
      message = errorObj[message].message;
    }
    const args = getArgsLazy ? getArgsLazy() : [];
    return args.reduce<string>((msg, arg) => msg.replace("%s", String(arg)), String(message));
  }
}
