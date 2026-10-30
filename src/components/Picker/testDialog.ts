/**
 * Test-only: jsdom has no `showModal`/`close`. Minimal stand-ins that toggle the `open`
 * attribute; `close` dispatches the native `close` event like a browser does.
 */
export function installDialogPolyfill(): void {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
