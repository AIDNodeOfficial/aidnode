// Local dev entry: re-exports only the default handler. Newer local workerd rejects non-handler
// named exports (e.g. ENGINE_VERSION) in the main module; production v9 accepts them today.
import worker from '../src/worker.js';
export default worker;
