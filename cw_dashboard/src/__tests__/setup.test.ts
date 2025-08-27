/**
 * Basic test to verify Jest setup is working
 */

describe('Jest Setup', () => {
  it('should run tests successfully', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to global test utilities', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.createMockUser).toBe('function');
    expect(typeof global.testUtils.createMockNavigationConfig).toBe('function');
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});