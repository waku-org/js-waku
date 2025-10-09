module.exports = {
  extension: ['ts'],
  require: ['ts-node/register'],
  loader: 'ts-node/esm',
  'node-option': [
    'experimental-specifier-resolution=node',
    'loader=ts-node/esm'
  ],
  timeout: 90000,
  exit: true
};
