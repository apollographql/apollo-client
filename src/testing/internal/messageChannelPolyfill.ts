import { MessageChannel as MC } from "node:worker_threads";

const messageChannels: MC[] = [];

afterEach(() => {
  let mc: MC | undefined;
  while ((mc = messageChannels.pop())) {
    mc.port1.close();
    mc.port2.close();
  }
});
//@ts-ignore
globalThis.MessageChannel = function MessageChannel() {
  const mc = new MC();
  messageChannels.push(mc);
  return mc;
};
