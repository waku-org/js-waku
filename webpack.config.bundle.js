import webpack from 'webpack';
import path from 'path';
import { createRequire } from 'module';
import { URL } from 'url';

const __dirname = new URL('.', import.meta.url).pathname;
const require = createRequire(import.meta.url);

export default {
  mode: 'development',
  entry: {
    'js-waku': './src/index.ts',
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer/'),
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert'),
    },
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'build/umd'),
    library: 'jswaku',
    libraryTarget: 'umd',
    globalObject: 'this',
  },
};
