/**
 * Jest Configuration for Data Ingestion Tests
 */

module.exports = {
  displayName: 'jobs',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/lib/jobs'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/lib/jobs/**/*.ts',
    '!src/lib/jobs/**/*.test.ts',
    '!src/lib/jobs/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
