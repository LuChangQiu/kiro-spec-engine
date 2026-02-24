const PromptGenerator = require('../../lib/context/prompt-generator');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

describe('PromptGenerator', () => {
  let generator;
  let testProjectPath;
  let testSpecPath;

  beforeEach(async () => {
    generator = new PromptGenerator();
    testProjectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-prompt-gen-'));
    testSpecPath = path.join(testProjectPath, '.sce/specs/test-spec');

    // Create test directory structure
    await fs.ensureDir(testSpecPath);
    await fs.writeFile(
      path.join(testSpecPath, 'requirements.md'),
      `# Requirements

## Requirement 1.1: User Authentication

Users should be able to log in with username and password.

## Requirement 1.2: Session Management

System should maintain user sessions.`
    );
    await fs.writeFile(
      path.join(testSpecPath, 'design.md'),
      `# Design

## Authentication Module

The authentication module handles user login.

## Session Manager

The session manager maintains user sessions.`
    );
    await fs.writeFile(
      path.join(testSpecPath, 'tasks.md'),
      `# Tasks

- [ ] 1.1 Implement authentication module
  - Create AuthModule class
  - Implement login() method
  - _Requirements: 1.1_

- [ ] 1.2 Implement session manager
  - Create SessionManager class
  - _Requirements: 1.2_`
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

  describe('generatePrompt', () => {
    test('should generate prompt successfully', async () => {
      const result = await generator.generatePrompt(
        testProjectPath,
        'test-spec',
        '1.1'
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('1.1');
      expect(result.promptPath).toContain('task-1-1.md');

      // Verify prompt file exists
      const promptExists = await fs.pathExists(result.promptPath);
      expect(promptExists).toBe(true);

      // Verify prompt content
      const promptContent = await fs.readFile(result.promptPath, 'utf8');
      expect(promptContent).toContain('Task Prompt: test-spec - Task 1.1');
      expect(promptContent).toContain('Implement authentication module');
      expect(promptContent).toContain('Relevant Requirements');
      expect(promptContent).toContain('Relevant Design');
      expect(promptContent).toContain('Implementation Guidelines');
      expect(promptContent).toContain('Task Status Update');
    });

    test('should handle non-existent spec', async () => {
      const result = await generator.generatePrompt(
        testProjectPath,
        'non-existent',
        '1.1'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Spec not found');
    });

    test('should handle non-existent task', async () => {
      const result = await generator.generatePrompt(
        testProjectPath,
        'test-spec',
        '99.99'
      );

      expect(result.success).toBe(false);
      // Error message could be either "Task not found" or "tasks.md not found"
      expect(result.error).toMatch(/Task not found|tasks\.md not found/);
    });

    test('should support different target tools', async () => {
      const result = await generator.generatePrompt(
        testProjectPath,
        'test-spec',
        '1.1',
        { targetTool: 'claude-code' }
      );

      expect(result.success).toBe(true);

      const promptContent = await fs.readFile(result.promptPath, 'utf8');
      expect(promptContent).toContain('**Target Tool**: claude-code');
      expect(promptContent).toContain('Claude Code');
    });
  });

  describe('extractTaskInfo', () => {
    test('should extract task information', () => {
      const tasksContent = `- [ ] 1.1 Implement feature
  - Create class
  - Add tests`;

      const taskInfo = generator.extractTaskInfo(tasksContent, '1.1');

      expect(taskInfo).toBeDefined();
      expect(taskInfo.id).toBe('1.1');
      expect(taskInfo.title).toBe('Implement feature');
      expect(taskInfo.details).toContain('- Create class');
      expect(taskInfo.details).toContain('- Add tests');
    });

    test('should handle tasks with claim markers', () => {
      const tasksContent = `- [-] 1.1 Implement feature [@alice, claimed: 2026-01-23]
  - Create class`;

      const taskInfo = generator.extractTaskInfo(tasksContent, '1.1');

      expect(taskInfo).toBeDefined();
      expect(taskInfo.title).toBe('Implement feature');
      expect(taskInfo.title).not.toContain('@alice');
    });

    test('should return null for non-existent task', () => {
      const tasksContent = `- [ ] 1.1 Implement feature`;

      const taskInfo = generator.extractTaskInfo(tasksContent, '99.99');

      expect(taskInfo).toBeNull();
    });
  });

  describe('extractRelevantRequirements', () => {
    test('should extract requirements by reference', () => {
      const requirements = `## Requirement 1.1: Feature A
Content A

## Requirement 1.2: Feature B
Content B`;

      const taskInfo = {
        details: ['_Requirements: 1.1_']
      };

      const result = generator.extractRelevantRequirements(requirements, taskInfo);

      expect(result).toContain('Requirement 1.1');
      expect(result).toContain('Content A');
    });

    test('should return all requirements if no references', () => {
      const requirements = `## Requirement 1.1: Feature A`;
      const taskInfo = { details: [] };

      const result = generator.extractRelevantRequirements(requirements, taskInfo);

      expect(result).toBe(requirements);
    });
  });

  describe('extractRelevantDesignSections', () => {
    test('should extract design sections by keywords', () => {
      const design = `## Authentication Module
Auth content

## Session Manager
Session content`;

      const taskInfo = {
        title: 'Implement authentication module'
      };

      const result = generator.extractRelevantDesignSections(design, taskInfo);

      expect(result).toContain('Authentication Module');
      expect(result).toContain('Auth content');
    });

    test('should return all design if no keywords match', () => {
      const design = `## Some Module`;
      const taskInfo = { title: 'xyz' };

      const result = generator.extractRelevantDesignSections(design, taskInfo);

      expect(result).toBe(design);
    });
  });

  describe('formatPrompt', () => {
    test('should format prompt with all sections', () => {
      const params = {
        specName: 'test-spec',
        taskId: '1.1',
        taskInfo: {
          title: 'Test task',
          details: ['Detail 1', 'Detail 2']
        },
        relevantRequirements: 'Requirements content',
        relevantDesign: 'Design content',
        targetTool: 'generic',
        maxContextLength: 10000
      };

      const prompt = generator.formatPrompt(params);

      expect(prompt).toContain('Task Prompt: test-spec - Task 1.1');
      expect(prompt).toContain('Test task');
      expect(prompt).toContain('Detail 1');
      expect(prompt).toContain('Requirements content');
      expect(prompt).toContain('Design content');
      expect(prompt).toContain('Implementation Guidelines');
      expect(prompt).toContain('Task Status Update');
    });
  });

  describe('savePrompt', () => {
    test('should save prompt to correct location', async () => {
      const prompt = '# Test Prompt';
      const promptPath = await generator.savePrompt(testSpecPath, '1.1', prompt);

      expect(promptPath).toContain('task-1-1.md');

      const exists = await fs.pathExists(promptPath);
      expect(exists).toBe(true);

      const content = await fs.readFile(promptPath, 'utf8');
      expect(content).toBe(prompt);
    });

    test('should handle task IDs with dots', async () => {
      const prompt = '# Test';
      const promptPath = await generator.savePrompt(testSpecPath, '1.2.3', prompt);

      expect(promptPath).toContain('task-1-2-3.md');
    });
  });
});
