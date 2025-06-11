export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironmentOptions: {
    experimentalVmModules: true
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
