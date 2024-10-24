const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './index.ts',
  target: 'node',
  output: {
    filename: 'server.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.(ts)$/,
        use: 'ts-loader',
        include: [path.resolve(__dirname, './index.ts'), path.resolve(__dirname, 'src')],
        exclude: [/node_modules/],
      }
    ],
  },
  externals: [nodeExternals()],
  mode: 'production'
};
