const {defaults} = require('jest-config');
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: [...defaults.moduleFileExtensions, 'd.ts'],
  testTimeout: 10_000,
  roots: [
    '<rootDir>/build/main' // testing javascript output due to type issues with protobuf. TODO: try out ts-proto
  ]
};
