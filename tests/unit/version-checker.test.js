/**
 * Tests for Version Checker
 */

const VersionChecker = require('../../lib/version/version-checker');

describe('VersionChecker', () => {
  test('should create VersionChecker instance', () => {
    const checker = new VersionChecker();
    expect(checker).toBeDefined();
    expect(checker.versionManager).toBeDefined();
  });

  test('should suppress warnings when configured', () => {
    const checker = new VersionChecker();
    
    expect(checker.suppressWarnings).toBe(false);
    
    checker.setSuppressWarnings(true);
    expect(checker.suppressWarnings).toBe(true);
    
    checker.setSuppressWarnings(false);
    expect(checker.suppressWarnings).toBe(false);
  });

  test('should handle missing version.json gracefully', async () => {
    const checker = new VersionChecker();
    const result = await checker.checkVersion('/nonexistent/path');
    
    expect(result).toBeDefined();
    expect(result.mismatch).toBe(false);
    expect(result.shouldUpgrade).toBe(false);
  });

  test('should respect noVersionCheck option', async () => {
    const checker = new VersionChecker();
    const result = await checker.checkVersion(process.cwd(), { noVersionCheck: true });
    
    expect(result).toBeDefined();
    expect(result.mismatch).toBe(false);
    expect(result.shouldUpgrade).toBe(false);
  });
});
