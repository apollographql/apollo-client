// This is polyfill file for testing websocket in node.js like it was a browser
// tslint reports because it's abit hacky.
//

/* tslint:disable */
let WebSocketPolyfill = undefined; //WebSocket;

// Is node?
if ( typeof module !== 'undefined' && module.exports ) {
  // Use polyfill
  WebSocketPolyfill = require('websocket').w3cwebsocket;
} else {
  // Use browser native
  WebSocketPolyfill = WebSocket;
}
/* tslint:enable */

(<any>global)['WebSocket'] = WebSocketPolyfill;
export default WebSocketPolyfill;
