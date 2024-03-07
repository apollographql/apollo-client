import { getDevtoolsConnector } from "./connector.js";

export interface Message<TMessage extends Record<string, unknown>> {
  type: string;
  payload: TMessage;
}

export function sendToDevtools<TMessage extends Record<string, unknown>>(
  message: Message<TMessage>
) {
  getDevtoolsConnector().send(message);
}
