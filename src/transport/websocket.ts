let WebSocketPolyfill = undefined; //WebSocket;

// Is node?
if ( typeof module !== 'undefined' && module.exports ) {
  // Use polyfill
  WebSocketPolyfill = require('websocket-client').WebSocket;
} else {
  // Use browser native
  WebSocketPolyfill = WebSocket;
}

export { WebSocketPolyfill as WebSocket };
export default WebSocketPolyfill;
