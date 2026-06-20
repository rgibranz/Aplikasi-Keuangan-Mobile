// React Native shim for react-dom.
// @tamagui/web imports this but only uses it when typeof document !== 'undefined'
// (dev mode + web only). On native this is never reached, so an empty shim is safe.
module.exports = {
  createPortal: (children) => children,
  flushSync: (fn) => fn(),
  render: () => null,
  unmountComponentAtNode: () => false,
  findDOMNode: () => null,
  unstable_batchedUpdates: (fn) => fn(),
};
