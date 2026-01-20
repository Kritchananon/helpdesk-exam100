import 'reflect-metadata';

// Mock bcrypt for testing
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock JWT for testing
jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  })),
}));

// Global test timeout
jest.setTimeout(30000);