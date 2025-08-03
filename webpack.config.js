// -*- indent-tabs-mode: nil; tab-width: 2; -*-
// vim: set ts=2 sw=2 et ai :

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env es2020, node */

import path from 'node:path';

export default {
  mode: 'production',
  context: import.meta.dirname,
  target: ['web', 'es2021'],
  devtool: 'source-map',

  resolve: {
    extensions: ['.ts', '.d.ts', '.js'],
  },

  entry: {
    'background': {
      import: './src/background.ts',
      filename: 'background.js',
    },
    'panel': {
      import: './src/panel.ts',
      filename: 'panel.js',
    },
    'panel-inner': {
      import: './src/panel-inner.ts',
      filename: 'panel-inner.js',
    },
    'content': {
      import: './src/content.ts',
      filename: 'content.js',
    },
  },

  output: {
    path: path.resolve(import.meta.dirname, 'dist'),
  },

  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        use: 'ts-loader',
      },
    ],
  },
};
