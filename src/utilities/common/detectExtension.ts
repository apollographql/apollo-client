export function detectExtension(extensionId: string, callback: (status: boolean) => void) {
  const img = new Image();
  img.src = `chrome-extension://${extensionId}/images/logo64.png`;

  img.onload = function () {
    callback(true);
  };

  img.onerror = function () {
    callback(false);
  };
}
