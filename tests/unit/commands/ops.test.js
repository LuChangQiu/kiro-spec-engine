/**
 * Unit Tests for ops CLI command
 */

const opsCommand = require('../../../lib/commands/ops');

describe('ops command', () => {
  describe('module exports', () => {
    it('should export a function', () => {
      expect(typeof opsCommand).toBe('function');
    });
  });

  describe('command validation', () => {
    it('should be callable', () => {
      expect(() => {
        // Just verify the function exists and is callable
        // Actual command execution tests would require mocking console and process.exit
        const fn = opsCommand;
        expect(fn).toBeDefined();
      }).not.toThrow();
    });
  });
});
