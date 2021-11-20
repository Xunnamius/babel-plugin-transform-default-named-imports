import pluginTester from 'babel-plugin-tester';
import plugin from '../src/index';
import { join as makePath } from 'path';

const babelOptions = {
  parserOpts: { strictMode: true },
  plugins: [
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-function-bind',
    '@babel/plugin-transform-typescript'
  ],
  presets: [
    [
      '@babel/preset-env',
      {
        // ? https://github.com/babel/babel-loader/issues/521#issuecomment-441466991
        modules: false,
        // ? https://nodejs.org/en/about/releases (see `npm show` lts version)
        targets: { node: '12.22.7' }
      }
    ],
    ['@babel/preset-typescript', { allowDeclareFields: true }]
  ]
};

pluginTester({
  pluginName: 'transform-default-named-imports',
  plugin,
  babelOptions,
  fixtures: makePath(__dirname, '__fixtures__')
});
