/**
 * Tests for Tool Detector
 */

const fs = require('fs-extra');
const path = require('path');
const {
  detectTool,
  detectKiroIDE,
  detectVSCode,
  detectCursor,
  getRecommendations,
  getAutomationSuggestions,
  generateAutoConfig,
  offerPresetInstallation
} = require('../../lib/utils/tool-detector');

describe('Tool Detector', () => {
  const testDir = path.join(__dirname, '../fixtures/tool-detector-test');
  
  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });
  
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('detectKiroIDE', () => {
    it('should detect AI IDE by .sce directory', async () => {
      await fs.ensureDir(path.join(testDir, '.sce'));
      
      const result = await detectKiroIDE(testDir);
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.indicators).toContain('.sce directory exists');
    });
    
    it('should have high confidence with multiple indicators', async () => {
      await fs.ensureDir(path.join(testDir, '.sce/steering'));
      await fs.ensureDir(path.join(testDir, '.sce/specs'));
      
      const result = await detectKiroIDE(testDir);
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.features).toContain('agent-hooks');
    });
    
    it('should not detect AI IDE without indicators', async () => {
      const result = await detectKiroIDE(testDir);
      
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });
  
  describe('detectVSCode', () => {
    it('should detect VS Code by .vscode directory', async () => {
      await fs.ensureDir(path.join(testDir, '.vscode'));
      
      const result = await detectVSCode(testDir);
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.indicators).toContain('.vscode directory exists');
    });
    
    it('should have high confidence with settings file', async () => {
      await fs.ensureDir(path.join(testDir, '.vscode'));
      await fs.writeJson(path.join(testDir, '.vscode/settings.json'), {
        'editor.fontSize': 14
      });
      
      const result = await detectVSCode(testDir);
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.features).toContain('watch-mode');
    });
    
    it('should not detect VS Code without indicators', async () => {
      const result = await detectVSCode(testDir);
      
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });
  
  describe('detectCursor', () => {
    it('should detect Cursor by .vscode directory', async () => {
      await fs.ensureDir(path.join(testDir, '.vscode'));
      
      const result = await detectCursor(testDir);
      
      expect(result.detected).toBe(true);
      expect(result.indicators).toContain('.vscode directory exists (Cursor compatible)');
    });
    
    it('should have high confidence with Cursor-specific settings', async () => {
      await fs.ensureDir(path.join(testDir, '.vscode'));
      await fs.writeJson(path.join(testDir, '.vscode/settings.json'), {
        'cursor.aiEnabled': true
      });
      
      const result = await detectCursor(testDir);
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.features).toContain('ai-integration');
    });
    
    it('should not detect Cursor without indicators', async () => {
      const result = await detectCursor(testDir);
      
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe('low');
    });
  });
  
  describe('detectTool', () => {
    it('should detect SCE as primary tool', async () => {
      await fs.ensureDir(path.join(testDir, '.sce/steering'));
      
      const result = await detectTool(testDir);
      
      expect(result.primaryTool).toBe('SCE');
      expect(result.confidence).toBe('high');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
    
    it('should detect VS Code as primary tool', async () => {
      await fs.ensureDir(path.join(testDir, '.vscode'));
      await fs.writeJson(path.join(testDir, '.vscode/settings.json'), {});
      
      const result = await detectTool(testDir);
      
      expect(result.primaryTool).toBe('vscode');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
    
    it('should return unknown for no indicators', async () => {
      const result = await detectTool(testDir);
      
      expect(result.primaryTool).toBe('other');
      expect(result.confidence).toBe('low');
    });
    
    it('should prioritize SCE over VS Code', async () => {
      await fs.ensureDir(path.join(testDir, '.sce'));
      await fs.ensureDir(path.join(testDir, '.vscode'));
      
      const result = await detectTool(testDir);
      
      expect(result.primaryTool).toBe('SCE');
    });
  });
  
  describe('getRecommendations', () => {
    it('should provide SCE-specific recommendations', () => {
      const recommendations = getRecommendations('SCE', {});
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'native')).toBe(true);
    });
    
    it('should provide VS Code recommendations', () => {
      const recommendations = getRecommendations('vscode', {});
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'primary')).toBe(true);
    });
    
    it('should provide fallback recommendations', () => {
      const recommendations = getRecommendations('other', {});
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.type === 'manual')).toBe(true);
    });
  });
  
  describe('getAutomationSuggestions', () => {
    it('should provide SCE suggestions', () => {
      const suggestions = getAutomationSuggestions('SCE');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('agent hooks'))).toBe(true);
    });
    
    it('should provide VS Code suggestions', () => {
      const suggestions = getAutomationSuggestions('vscode');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('watch mode'))).toBe(true);
    });
    
    it('should provide Cursor suggestions', () => {
      const suggestions = getAutomationSuggestions('cursor');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('Cursor AI'))).toBe(true);
    });
    
    it('should provide fallback suggestions', () => {
      const suggestions = getAutomationSuggestions('unknown');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('manual'))).toBe(true);
    });
  });

  describe('generateAutoConfig', () => {
    it('should generate config for SCE', async () => {
      const detection = {
        primaryTool: 'SCE',
        confidence: 'high',
        detections: {},
        recommendations: []
      };

      const config = await generateAutoConfig(detection, testDir);
      
      expect(config.tool).toBe('SCE');
      expect(config.confidence).toBe('high');
      expect(config.suggestedCommands.some(c => c.includes('native SCE'))).toBe(true);
      expect(config.notes.some(n => n.includes('AI IDE detected'))).toBe(true);
    });

    it('should generate config for VS Code', async () => {
      const detection = {
        primaryTool: 'vscode',
        confidence: 'high',
        detections: {},
        recommendations: []
      };

      const config = await generateAutoConfig(detection, testDir);
      
      expect(config.tool).toBe('vscode');
      expect(config.suggestedPresets).toContain('auto-sync');
      expect(config.suggestedCommands.some(c => c.includes('sce watch init'))).toBe(true);
      expect(config.configPath).toContain('.sce');
      expect(config.configPath).toContain('watch-config.json');
    });

    it('should generate config for Cursor', async () => {
      const detection = {
        primaryTool: 'cursor',
        confidence: 'medium',
        detections: {},
        recommendations: []
      };

      const config = await generateAutoConfig(detection, testDir);
      
      expect(config.tool).toBe('cursor');
      expect(config.suggestedPresets).toContain('prompt-regen');
      expect(config.notes.some(n => n.includes('Cursor detected'))).toBe(true);
    });

    it('should generate config for unknown tool', async () => {
      const detection = {
        primaryTool: 'other',
        confidence: 'low',
        detections: {},
        recommendations: []
      };

      const config = await generateAutoConfig(detection, testDir);
      
      expect(config.tool).toBe('other');
      expect(config.notes.some(n => n.includes('No specific IDE detected'))).toBe(true);
      expect(config.suggestedCommands.some(c => c.includes('cross-tool-guide.md'))).toBe(true);
    });
  });

  describe('offerPresetInstallation', () => {
    it('should offer preset installation', async () => {
      const detection = {
        primaryTool: 'vscode',
        confidence: 'high',
        detections: {},
        recommendations: []
      };

      const result = await offerPresetInstallation(detection, testDir);
      
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config.suggestedPresets).toContain('auto-sync');
      expect(result.message).toBe('Auto-configuration generated successfully');
    });
  });
});
