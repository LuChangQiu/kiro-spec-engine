/**
 * Tests for Watch Presets
 */

const {
  getPreset,
  listPresets,
  mergePreset,
  validatePreset,
  autoSyncPreset,
  promptRegenPreset,
  contextExportPreset,
  testRunnerPreset
} = require('../../lib/watch/presets');

describe('Watch Presets', () => {
  describe('getPreset', () => {
    it('should return auto-sync preset', () => {
      const preset = getPreset('auto-sync');
      expect(preset).toBeDefined();
      expect(preset.name).toBe('auto-sync');
      expect(preset.patterns).toContain('**/tasks.md');
    });
    
    it('should return prompt-regen preset', () => {
      const preset = getPreset('prompt-regen');
      expect(preset).toBeDefined();
      expect(preset.name).toBe('prompt-regen');
      expect(preset.patterns).toContain('**/.kiro/specs/*/requirements.md');
    });
    
    it('should return context-export preset', () => {
      const preset = getPreset('context-export');
      expect(preset).toBeDefined();
      expect(preset.name).toBe('context-export');
      expect(preset.patterns).toContain('**/.kiro/specs/*/.complete');
    });
    
    it('should return test-runner preset', () => {
      const preset = getPreset('test-runner');
      expect(preset).toBeDefined();
      expect(preset.name).toBe('test-runner');
      expect(preset.patterns).toContain('**/lib/**/*.js');
    });
    
    it('should return null for unknown preset', () => {
      const preset = getPreset('unknown');
      expect(preset).toBeNull();
    });
  });
  
  describe('listPresets', () => {
    it('should list all presets', () => {
      const presets = listPresets();
      expect(presets).toHaveLength(4);
      expect(presets.map(p => p.name)).toContain('auto-sync');
      expect(presets.map(p => p.name)).toContain('prompt-regen');
      expect(presets.map(p => p.name)).toContain('context-export');
      expect(presets.map(p => p.name)).toContain('test-runner');
    });
    
    it('should include descriptions', () => {
      const presets = listPresets();
      for (const preset of presets) {
        expect(preset.description).toBeDefined();
        expect(preset.description.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('mergePreset', () => {
    it('should merge auto-sync preset with empty config', () => {
      const existingConfig = {
        enabled: true,
        patterns: [],
        actions: {}
      };
      
      const merged = mergePreset(existingConfig, 'auto-sync');
      
      expect(merged.patterns).toContain('**/tasks.md');
      expect(merged.actions['**/tasks.md']).toBeDefined();
      expect(merged.actions['**/tasks.md'].command).toBe('sce workspace sync');
    });
    
    it('should not overwrite existing actions', () => {
      const existingConfig = {
        enabled: true,
        patterns: ['**/tasks.md'],
        actions: {
          '**/tasks.md': {
            command: 'custom command',
            debounce: 1000
          }
        }
      };
      
      const merged = mergePreset(existingConfig, 'auto-sync');
      
      expect(merged.actions['**/tasks.md'].command).toBe('custom command');
    });
    
    it('should merge patterns without duplicates', () => {
      const existingConfig = {
        enabled: true,
        patterns: ['**/tasks.md', '**/*.js'],
        actions: {}
      };
      
      const merged = mergePreset(existingConfig, 'auto-sync');
      
      const tasksMdCount = merged.patterns.filter(p => p === '**/tasks.md').length;
      expect(tasksMdCount).toBe(1);
      expect(merged.patterns).toContain('**/*.js');
    });
    
    it('should merge debounce settings', () => {
      const existingConfig = {
        enabled: true,
        patterns: [],
        actions: {},
        debounce: {}
      };
      
      const merged = mergePreset(existingConfig, 'prompt-regen');
      
      expect(merged.debounce.default).toBe(5000);
      expect(merged.debounce.perPattern).toBeDefined();
    });
    
    it('should throw error for unknown preset', () => {
      const existingConfig = { patterns: [], actions: {} };
      
      expect(() => {
        mergePreset(existingConfig, 'unknown');
      }).toThrow('Preset not found: unknown');
    });
  });
  
  describe('validatePreset', () => {
    it('should validate auto-sync preset', () => {
      const result = validatePreset('auto-sync');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate prompt-regen preset', () => {
      const result = validatePreset('prompt-regen');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate context-export preset', () => {
      const result = validatePreset('context-export');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate test-runner preset', () => {
      const result = validatePreset('test-runner');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should return invalid for unknown preset', () => {
      const result = validatePreset('unknown');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Preset not found: unknown');
    });
  });
  
  describe('Preset Structures', () => {
    it('auto-sync preset should have correct structure', () => {
      expect(autoSyncPreset.name).toBe('auto-sync');
      expect(autoSyncPreset.description).toBeDefined();
      expect(autoSyncPreset.patterns).toBeInstanceOf(Array);
      expect(autoSyncPreset.actions).toBeInstanceOf(Object);
      expect(autoSyncPreset.debounce).toBeDefined();
    });
    
    it('prompt-regen preset should have correct structure', () => {
      expect(promptRegenPreset.name).toBe('prompt-regen');
      expect(promptRegenPreset.patterns.length).toBeGreaterThan(1);
      expect(Object.keys(promptRegenPreset.actions).length).toBeGreaterThan(1);
    });
    
    it('context-export preset should have correct structure', () => {
      expect(contextExportPreset.name).toBe('context-export');
      expect(contextExportPreset.patterns).toContain('**/.kiro/specs/*/.complete');
    });
    
    it('test-runner preset should have correct structure', () => {
      expect(testRunnerPreset.name).toBe('test-runner');
      expect(testRunnerPreset.patterns.length).toBeGreaterThan(2);
      expect(testRunnerPreset.actions['**/lib/**/*.js']).toBeDefined();
    });
  });
});
