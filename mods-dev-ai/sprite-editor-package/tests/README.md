Headless tests (Node 22 + jsdom + node-canvas). Not part of the mod.
  npm i esbuild react@18 react-dom@18 jsdom canvas
  # fix the /home/claude/... paths in mod-entry.ts / ui.test.mjs, then:
  npx esbuild mod-entry.ts --bundle --format=esm --platform=node --outfile=out/mod.mjs
  npx esbuild <mod>/src/sprite-editor/engine.ts --bundle --format=esm --platform=node --outfile=out/engine.mjs
  node --test engine.test.mjs; node ui.test.mjs; node fallback.test.mjs
