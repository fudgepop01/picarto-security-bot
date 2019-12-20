import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import re from "rollup-plugin-re";
// import cjs from 'rollup-plugin-cjs-es';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'src/index.js',
  output: {
    file: 'out/bundle.js',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    babel({
      exclude: 'node_modules/**',
      plugins: [
        "@babel/plugin-proposal-class-properties"
      ],
    }),
    commonjs(),
    re({
      patterns: [
        {
          match: /types\.js$/,
          test: /util\.emptyArray/,
          replace: "Object.freeze ? Object.freeze([]) : []"
        },
        {
          match: /root\.js/,
          test: /util\.path\.resolve/,
          replace: "require('@protobufjs/path').resolve"
        }
      ]
    }),
    // cjs({nested: true})
  ],
}