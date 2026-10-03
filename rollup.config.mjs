import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import minifyLiterals from "./scripts/minify-literals.mjs";

const dev = process.env.ROLLUP_WATCH;

export default {
  input: "src/ha-climate-card.ts",
  output: { file: "dist/ha-climate-card.js", format: "es", sourcemap: false },
  plugins: [
    resolve(),
    json({ compact: true }),
    typescript(),
    // CSS/HTML in Lit-Templates verkleinern (nach TypeScript, das die Quelldateien selbst einliest)
    !dev && minifyLiterals(),
    !dev && terser({ format: { comments: false }, compress: { passes: 2 } }),
  ],
};
