/**
 * Unit Tests for Error Formatter
 * 
 * Tests error formatting, category detection, and message templates.
 */

const ErrorFormatter = require('../../../lib/adoption/error-formatter');
const { ErrorCategory } = require('../../../lib/adoption/error-formatter');

describe('ErrorFormatter', () => {
  describe('Category Detection', () => {
    test('detects backup errors', () => {
      const error = new Error('Failed to create backup');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Backup Creation Failed');
      expect(formatted).toContain('Insufficient disk space');
    });

    test('detects permission errors from EACCES', () => {
      const error = new Error('EACCES: permission denied');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Permission Denied');
      expect(formatted).toContain('insufficient permissions');
    });

    test('detects disk space errors from ENOSPC', () => {
      const error = new Error('ENOSPC: no space left on device');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Insufficient Disk Space');
      expect(formatted).toContain('free disk space');
    });

    test('detects file system errors from ENOENT', () => {
      const error = new Error('ENOENT: no such file or directory');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('File System Error');
      expect(formatted).toContain('File or directory not found');
    });

    test('detects version errors', () => {
      const error = new Error('Version mismatch detected');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Version Mismatch');
      expect(formatted).toContain('incompatible');
    });

    test('detects validation errors', () => {
      const error = new Error('Validation failed: invalid format');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Validation Failed');
      expect(formatted).toContain('validation checks');
    });

    test('detects network errors', () => {
      const error = new Error('ECONNREFUSED: connection refused');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('connect to required services');
    });

    test('detects configuration errors', () => {
      const error = new Error('Invalid configuration setting');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Configuration Error');
      expect(formatted).toContain('configuration');
    });

    test('defaults to unknown category for unrecognized errors', () => {
      const error = new Error('Something completely unexpected happened');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Unexpected Error');
      expect(formatted).toContain('unexpected error occurred');
    });
  });

  describe('Context-Based Detection', () => {
    test('uses context.operation for category detection', () => {
      const error = new Error('Operation failed');
      const formatted = ErrorFormatter.format(error, { operation: 'backup' });
      
      expect(formatted).toContain('Backup Creation Failed');
    });

    test('uses explicit category from context', () => {
      const error = new Error('Something went wrong');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.PERMISSION 
      });
      
      expect(formatted).toContain('Permission Denied');
    });

    test('includes file path in formatted output', () => {
      const error = new Error('File operation failed');
      const formatted = ErrorFormatter.format(error, { 
        filePath: '/path/to/file.txt' 
      });
      
      expect(formatted).toContain('/path/to/file.txt');
    });

    test('shows technical details when verbose is true', () => {
      const error = new Error('Technical error details here');
      const formatted = ErrorFormatter.format(error, { verbose: true });
      
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('Technical error details here');
    });
  });

  describe('Error Message Structure', () => {
    test('includes all required sections', () => {
      const error = new Error('Test error');
      const formatted = ErrorFormatter.format(error);
      
      // Check for all required sections
      expect(formatted).toContain('❌ Error:');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
      expect(formatted).toContain('💡 Need help?');
      expect(formatted).toContain('kse doctor');
    });

    test('formats causes as bullet points', () => {
      const error = new Error('Backup failed');
      const formatted = ErrorFormatter.format(error);
      
      // Should have bullet points for causes
      expect(formatted).toMatch(/•.*Insufficient disk space/);
      expect(formatted).toMatch(/•.*Permission denied/);
    });

    test('formats solutions as numbered list', () => {
      const error = new Error('Backup failed');
      const formatted = ErrorFormatter.format(error);
      
      // Should have numbered solutions
      expect(formatted).toMatch(/1\..*/);
      expect(formatted).toMatch(/2\..*/);
      expect(formatted).toMatch(/3\..*/);
    });

    test('includes help reference at the end', () => {
      const error = new Error('Test error');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('kse doctor');
      expect(formatted).toContain('https://github.com/kiro-ai/kiro-spec-engine#troubleshooting');
    });
  });

  describe('Specialized Format Methods', () => {
    describe('formatBackupError', () => {
      test('formats backup errors correctly', () => {
        const error = new Error('Backup creation failed');
        const formatted = ErrorFormatter.formatBackupError(error);
        
        expect(formatted).toContain('Backup Creation Failed');
        expect(formatted).toContain('Insufficient disk space');
        expect(formatted).toContain('Free up disk space');
      });

      test('accepts additional context', () => {
        const error = new Error('Backup failed');
        const formatted = ErrorFormatter.formatBackupError(error, {
          filePath: '/backup/path'
        });
        
        expect(formatted).toContain('/backup/path');
      });
    });

    describe('formatPermissionError', () => {
      test('formats permission errors correctly', () => {
        const error = new Error('Access denied');
        const formatted = ErrorFormatter.formatPermissionError(error);
        
        expect(formatted).toContain('Permission Denied');
        expect(formatted).toContain('insufficient permissions');
        expect(formatted).toContain('Check file ownership');
      });
    });

    describe('formatValidationError', () => {
      test('formats validation errors correctly', () => {
        const error = new Error('Validation check failed');
        const formatted = ErrorFormatter.formatValidationError(error);
        
        expect(formatted).toContain('Validation Failed');
        expect(formatted).toContain('validation checks');
        expect(formatted).toContain('kse doctor');
      });
    });
  });

  describe('Simple Format Methods', () => {
    describe('formatSimple', () => {
      test('formats simple error message', () => {
        const formatted = ErrorFormatter.formatSimple('Something went wrong');
        
        expect(formatted).toContain('❌');
        expect(formatted).toContain('Something went wrong');
      });
    });

    describe('formatWarning', () => {
      test('formats warning message', () => {
        const formatted = ErrorFormatter.formatWarning('This is a warning');
        
        expect(formatted).toContain('⚠️');
        expect(formatted).toContain('This is a warning');
      });
    });

    describe('formatSuccess', () => {
      test('formats success message', () => {
        const formatted = ErrorFormatter.formatSuccess('Operation completed');
        
        expect(formatted).toContain('✅');
        expect(formatted).toContain('Operation completed');
      });
    });

    describe('formatInfo', () => {
      test('formats info message', () => {
        const formatted = ErrorFormatter.formatInfo('Information message');
        
        expect(formatted).toContain('ℹ️');
        expect(formatted).toContain('Information message');
      });
    });
  });

  describe('formatMultiple', () => {
    test('formats multiple errors into summary', () => {
      const errors = [
        new Error('First error'),
        new Error('Second error'),
        'Third error message'
      ];
      
      const formatted = ErrorFormatter.formatMultiple(errors);
      
      expect(formatted).toContain('❌');
      expect(formatted).toContain('1. First error');
      expect(formatted).toContain('2. Second error');
      expect(formatted).toContain('3. Third error message');
      expect(formatted).toContain('kse doctor');
    });

    test('accepts custom title', () => {
      const errors = [new Error('Error 1')];
      const formatted = ErrorFormatter.formatMultiple(errors, 'Custom Title');
      
      expect(formatted).toContain('Custom Title');
    });

    test('handles empty error array', () => {
      const formatted = ErrorFormatter.formatMultiple([]);
      
      expect(formatted).toContain('❌');
      expect(formatted).toContain('kse doctor');
    });
  });

  describe('Error Templates', () => {
    test('backup template has all required fields', () => {
      const error = new Error('Backup failed');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.BACKUP 
      });
      
      expect(formatted).toContain('Backup Creation Failed');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('permission template has all required fields', () => {
      const error = new Error('Permission denied');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.PERMISSION 
      });
      
      expect(formatted).toContain('Permission Denied');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('disk space template has all required fields', () => {
      const error = new Error('No space left');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.DISK_SPACE 
      });
      
      expect(formatted).toContain('Insufficient Disk Space');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('file system template has all required fields', () => {
      const error = new Error('File not found');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.FILE_SYSTEM 
      });
      
      expect(formatted).toContain('File System Error');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('version template has all required fields', () => {
      const error = new Error('Version mismatch');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.VERSION 
      });
      
      expect(formatted).toContain('Version Mismatch');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('validation template has all required fields', () => {
      const error = new Error('Validation failed');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.VALIDATION 
      });
      
      expect(formatted).toContain('Validation Failed');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('network template has all required fields', () => {
      const error = new Error('Connection failed');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.NETWORK 
      });
      
      expect(formatted).toContain('Network Error');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('configuration template has all required fields', () => {
      const error = new Error('Config invalid');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.CONFIGURATION 
      });
      
      expect(formatted).toContain('Configuration Error');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });

    test('unknown template has all required fields', () => {
      const error = new Error('Unknown error');
      const formatted = ErrorFormatter.format(error, { 
        category: ErrorCategory.UNKNOWN 
      });
      
      expect(formatted).toContain('Unexpected Error');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Possible causes:');
      expect(formatted).toContain('Solutions:');
    });
  });

  describe('Technical Details Display', () => {
    test('shows details for ENOENT errors', () => {
      const error = new Error('ENOENT: no such file or directory, open \'/path/to/file\'');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('ENOENT');
    });

    test('shows details for EACCES errors', () => {
      const error = new Error('EACCES: permission denied, access \'/protected/file\'');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('EACCES');
    });

    test('shows details for ENOSPC errors', () => {
      const error = new Error('ENOSPC: no space left on device');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('ENOSPC');
    });

    test('shows details for errors with line numbers', () => {
      const error = new Error('Syntax error at line 42');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('line 42');
    });

    test('hides details for generic errors without verbose', () => {
      const error = new Error('Generic error message');
      const formatted = ErrorFormatter.format(error, { verbose: false });
      
      expect(formatted).not.toContain('Details:');
      expect(formatted).not.toContain('Generic error message');
    });
  });

  describe('String Error Handling', () => {
    test('handles string errors', () => {
      const formatted = ErrorFormatter.format('String error message');
      
      expect(formatted).toContain('❌ Error:');
      expect(formatted).toContain('Problem:');
    });

    test('detects category from string errors', () => {
      const formatted = ErrorFormatter.format('Backup creation failed');
      
      expect(formatted).toContain('Backup Creation Failed');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty error message', () => {
      const error = new Error('');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('❌ Error:');
      expect(formatted).toContain('Problem:');
      expect(formatted).toContain('Solutions:');
    });

    test('handles very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(1000);
      const error = new Error(longMessage);
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('❌ Error:');
      expect(formatted).toContain('Problem:');
    });

    test('handles error with special characters', () => {
      const error = new Error('Error with special chars: <>&"\'');
      const formatted = ErrorFormatter.format(error);
      
      expect(formatted).toContain('❌ Error:');
    });

    test('handles null context', () => {
      const error = new Error('Test error');
      const formatted = ErrorFormatter.format(error, null);
      
      expect(formatted).toContain('❌ Error:');
    });

    test('handles undefined context', () => {
      const error = new Error('Test error');
      const formatted = ErrorFormatter.format(error, undefined);
      
      expect(formatted).toContain('❌ Error:');
    });
  });

  describe('ErrorCategory Export', () => {
    test('exports ErrorCategory enum', () => {
      expect(ErrorCategory).toBeDefined();
      expect(ErrorCategory.BACKUP).toBe('backup');
      expect(ErrorCategory.PERMISSION).toBe('permission');
      expect(ErrorCategory.DISK_SPACE).toBe('disk_space');
      expect(ErrorCategory.FILE_SYSTEM).toBe('file_system');
      expect(ErrorCategory.VERSION).toBe('version');
      expect(ErrorCategory.VALIDATION).toBe('validation');
      expect(ErrorCategory.NETWORK).toBe('network');
      expect(ErrorCategory.CONFIGURATION).toBe('configuration');
      expect(ErrorCategory.UNKNOWN).toBe('unknown');
    });
  });
});
