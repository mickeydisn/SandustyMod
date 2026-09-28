/**
 * `src/handler/` — entry point.
 *
 * Loads the action catalogue and publishes it on `globalThis.__mdHandlers` for
 * the catalog and the panel, which are loaded earlier and cannot import it
 * without a cycle. See `./core/index.ts` for the layer breakdown and the
 * published surface.
 *
 * `import "./handler/index.ts"` from `main.ts` is what makes that global exist;
 * nothing here is called directly.
 *
 * @module
 */
export * from "./core/index.ts";
