/**
 * Sample test to verify Jest configuration
 */

describe('Jest Configuration', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });
  
  it('should support basic assertions', () => {
    const sum = (a, b) => a + b;
    expect(sum(1, 2)).toBe(3);
  });
});
