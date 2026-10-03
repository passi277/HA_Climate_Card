import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";

const dev = process.env.ROLLUP_WATCH;

export default {
  input: "src/ha-climate-card.ts",
  output: { file: "dist/ha-climate-card.js", format: "es", sourcemap: false },
  plugins: [
    resolve(),
    json(),
    typescript(),
    !dev && terser({ format: { comments: false } }),
  ],
};
