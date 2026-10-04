export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^\\.\\./index\\.js$": "<rootDir>/index.ts",
    "^\\./index\\.js$": "<rootDir>/index.ts",
    "^(\\.\\./.*)\\.js$": "$1",
    "^(\\./.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
  },
};
