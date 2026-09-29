module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  collectCoverage: true,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/**/*.d.ts"
  ],
  coverageDirectory: "<rootDir>/coverage",
  moduleNameMapper: {
    "^(\\.\\.?/.*)\\.js$": "$1"
  }
};
