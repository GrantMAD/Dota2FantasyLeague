module.exports = {
  displayName: 'security',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/app/api'],
  testMatch: ['**/*.security.spec.ts'],
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
};
