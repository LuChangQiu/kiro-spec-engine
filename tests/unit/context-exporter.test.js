const ContextExporter = require('../../lib/context/context-exporter');
const fs = require('fs-extra');
const path = require('path');

describe('ContextExporter', () => {
  let exporter;
  let testProjectPath;
  let testSpecPath;

  beforeEach(async () => {
    exporter = new ContextExporter();
    testProjectPath = path.join(__dirname, '../fixtures/test-project');
    testSpecPath = path.join(testProjectPath, '.kiro/specs/test-spec');

    // Create test directory structure
    await fs.ensureDir(testSpecPath);
    await fs.writeFile(
      path.join(testSpecPath, 'requirements.md'),
      '# Requirements\n\nTest requirements content'
    );
    await fs.writeFile(
      path.join(testSpecPath, 'design.md'),
      '# Design\n\nTest design content'
    );
    await fs.writeFile(
      path.join(testSpecPath, 'tasks.md'),
      '# Tasks\n\n- [ ] 1.1 Test task'
    );
  });

  afterEach(async () => {
    // Add delay to allow file handles to close
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await fs.remove(testProjectPath);
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Cleanup warning:', error.message);
    }
  });

  describe('exportContext', () => {
    test('should export spec context successfully', async () => {
      const result = await exporter.exportContext(testProjectPath, 'test-spec');

      expect(result.success).toBe(true);
      expect(result.specName).toBe('test-spec');
      expect(result.exportPath).toContain('context-export.md');

      // Verify export file exists
      const exportExists = await fs.pathExists(result.exportPath);
      expect(exportExists).toBe(true);

      // Verify export content
      const exportContent = await fs.readFile(result.exportPath, 'utf8');
      expect(exportContent).toContain('Context Export: test-spec');
      expect(exportContent).toContain('Test requirements content');
      expect(exportContent).toContain('Test design content');
      expect(exportContent).toContain('Test task');
    });

    test('should handle non-existent spec', async () => {
      const result = await exporter.exportContext(testProjectPath, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spec not found');
    });

    test('should include steering rules when requested', async () => {
      // Create steering file
      const steeringPath = path.join(testProjectPath, '.kiro/steering');
      await fs.ensureDir(steeringPath);
      await fs.writeFile(
        path.join(steeringPath, 'CORE_PRINCIPLES.md'),
        '# Core Principles\n\nTest principles'
      );

      const result = await exporter.exportContext(testProjectPath, 'test-spec', {
        includeSteering: true,
        steeringFiles: ['CORE_PRINCIPLES.md']
      });

      expect(result.success).toBe(true);

      const exportContent = await fs.readFile(result.exportPath, 'utf8');
      expect(exportContent).toContain('Steering Rules');
      expect(exportContent).toContain('Test principles');
    });

    test('should handle missing optional files gracefully', async () => {
      // Remove design.md
      await fs.remove(path.join(testSpecPath, 'design.md'));

      const result = await exporter.exportContext(testProjectPath, 'test-spec');

      expect(result.success).toBe(true);
      const exportContent = await fs.readFile(result.exportPath, 'utf8');
      expect(exportContent).toContain('Requirements');
      expect(exportContent).toContain('Tasks');
      expect(exportContent).not.toContain('Test design content');
    });
  });

  describe('generateTaskContext', () => {
    test('should generate task-specific context', async () => {
      const result = await exporter.generateTaskContext(
        testProjectPath,
        'test-spec',
        '1.1'
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('1.1');
      expect(result.taskInfo).toBeDefined();
      expect(result.taskInfo.title).toBe('Test task');
    });

    test('should handle non-existent task', async () => {
      const result = await exporter.generateTaskContext(
        testProjectPath,
        'test-spec',
        '99.99'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
    });
  });

  describe('includeSteeringRules', () => {
    test('should include multiple steering files', async () => {
      const steeringPath = path.join(testProjectPath, '.kiro/steering');
      await fs.ensureDir(steeringPath);
      await fs.writeFile(
        path.join(steeringPath, 'CORE_PRINCIPLES.md'),
        '# Core Principles'
      );
      await fs.writeFile(
        path.join(steeringPath, 'ENVIRONMENT.md'),
        '# Environment'
      );

      const result = await exporter.includeSteeringRules(testProjectPath, [
        'CORE_PRINCIPLES.md',
        'ENVIRONMENT.md'
      ]);

      expect(result).toContain('Steering Rules');
      expect(result).toContain('CORE_PRINCIPLES.md');
      expect(result).toContain('ENVIRONMENT.md');
    });

    test('should handle missing steering files gracefully', async () => {
      const result = await exporter.includeSteeringRules(testProjectPath, [
        'NON_EXISTENT.md'
      ]);

      expect(result).toBeNull();
    });
  });
});
