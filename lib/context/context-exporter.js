const fs = require('fs-extra');
const path = require('path');

/**
 * ContextExporter - 上下文导出器
 * 
 * 将 Spec 上下文导出为独立的 Markdown 文件，供跨工具使用
 */
class ContextExporter {
  constructor() {
    this.exportFileName = 'context-export.md';
  }

  /**
   * 导出 Spec 上下文
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} specName - Spec 名称
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>} 导出结果
   */
  async exportContext(projectPath, specName, options = {}) {
    const {
      includeRequirements = true,
      includeDesign = true,
      includeTasks = true,
      includeSteering = false,
      steeringFiles = []
    } = options;

    try {
      const specPath = path.join(projectPath, '.kiro/specs', specName);
      
      // 检查 Spec 是否存在
      const specExists = await fs.pathExists(specPath);
      if (!specExists) {
        return {
          success: false,
          error: `Spec not found: ${specName}`
        };
      }

      // 构建导出内容
      const sections = [];

      // 添加头部
      sections.push(this.generateHeader(specName));

      // 添加 Requirements
      if (includeRequirements) {
        const requirements = await this.readSpecFile(specPath, 'requirements.md');
        if (requirements) {
          sections.push(this.formatSection('Requirements', requirements));
        }
      }

      // 添加 Design
      if (includeDesign) {
        const design = await this.readSpecFile(specPath, 'design.md');
        if (design) {
          sections.push(this.formatSection('Design', design));
        }
      }

      // 添加 Tasks
      if (includeTasks) {
        const tasks = await this.readSpecFile(specPath, 'tasks.md');
        if (tasks) {
          sections.push(this.formatSection('Tasks', tasks));
        }
      }

      // 添加 Steering Rules
      if (includeSteering && steeringFiles.length > 0) {
        const steeringContent = await this.includeSteeringRules(projectPath, steeringFiles);
        if (steeringContent) {
          sections.push(steeringContent);
        }
      }

      // 添加使用说明
      sections.push(this.generateUsageInstructions());

      // 组合所有内容
      const exportContent = sections.join('\n\n---\n\n');

      // 保存导出文件
      const exportPath = path.join(specPath, this.exportFileName);
      await fs.writeFile(exportPath, exportContent, 'utf8');

      return {
        success: true,
        exportPath,
        specName,
        sections: sections.length,
        size: Buffer.byteLength(exportContent, 'utf8')
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成导出文件头部
   * 
   * @param {string} specName - Spec 名称
   * @returns {string} 头部内容
   */
  generateHeader(specName) {
    const timestamp = new Date().toISOString();
    
    return `# Context Export: ${specName}

**Exported**: ${timestamp}  
**Format**: Standalone Markdown  
**Purpose**: Cross-tool AI coding assistant usage

---

## 📋 About This Export

This file contains the complete context for the **${specName}** specification. It is designed to be used with AI coding assistants like Claude Code, Cursor, Codex, or any other tool that accepts Markdown context.

### What's Included

- Requirements document
- Design document
- Task list
- Optional: Steering rules

### How to Use

1. **Copy this entire file** into your AI coding assistant
2. **Reference specific sections** when working on tasks
3. **Update task status** in the original tasks.md after completion

---`;
  }

  /**
   * 格式化章节
   * 
   * @param {string} title - 章节标题
   * @param {string} content - 章节内容
   * @returns {string} 格式化后的章节
   */
  formatSection(title, content) {
    return `## ${title}

${content}`;
  }

  /**
   * 读取 Spec 文件
   * 
   * @param {string} specPath - Spec 目录路径
   * @param {string} fileName - 文件名
   * @returns {Promise<string|null>} 文件内容或 null
   */
  async readSpecFile(specPath, fileName) {
    const filePath = path.join(specPath, fileName);
    
    try {
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        return null;
      }

      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * 包含 Steering 规则
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {Array<string>} steeringFiles - Steering 文件列表
   * @returns {Promise<string>} Steering 内容
   */
  async includeSteeringRules(projectPath, steeringFiles) {
    const steeringPath = path.join(projectPath, '.kiro/steering');
    const sections = ['## Steering Rules\n'];

    for (const fileName of steeringFiles) {
      const filePath = path.join(steeringPath, fileName);
      
      try {
        const exists = await fs.pathExists(filePath);
        if (!exists) {
          continue;
        }

        const content = await fs.readFile(filePath, 'utf8');
        sections.push(`### ${fileName}\n\n${content}`);
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return sections.length > 1 ? sections.join('\n\n') : null;
  }

  /**
   * 生成使用说明
   * 
   * @returns {string} 使用说明
   */
  generateUsageInstructions() {
    return `## 💡 Usage Instructions

### For Claude Code / Cursor / Codex

1. **Load this file** as context in your AI coding assistant
2. **Reference specific tasks** when implementing features
3. **Follow the design** outlined in the Design section
4. **Update task status** in the original \`tasks.md\` after completion

### Task Status Updates

After completing a task, update the original \`tasks.md\` file:

\`\`\`markdown
- [x] 1.1 Completed task
- [-] 1.2 In-progress task
- [ ] 1.3 Not started task
\`\`\`

### Best Practices

- **Read Requirements first** to understand the problem
- **Review Design** to understand the solution approach
- **Follow Tasks** to implement incrementally
- **Test thoroughly** before marking tasks as complete
- **Document changes** in code comments

### Getting Help

If you encounter issues:
1. Review the Requirements for clarification
2. Check the Design for architectural guidance
3. Consult the original project documentation
4. Ask the project maintainer for guidance

---

**Generated by**: kiro-spec-engine  
**Export Format**: Standalone Markdown  
**Compatible with**: Claude Code, Cursor, Codex, and other AI coding assistants`;
  }

  /**
   * 生成任务特定上下文
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} specName - Spec 名称
   * @param {string} taskId - 任务 ID
   * @returns {Promise<Object>} 任务上下文
   */
  async generateTaskContext(projectPath, specName, taskId) {
    try {
      const specPath = path.join(projectPath, '.kiro/specs', specName);

      // 读取所有文件
      const requirements = await this.readSpecFile(specPath, 'requirements.md');
      const design = await this.readSpecFile(specPath, 'design.md');
      const tasks = await this.readSpecFile(specPath, 'tasks.md');

      if (!tasks) {
        return {
          success: false,
          error: 'tasks.md not found'
        };
      }

      // 提取任务信息
      const taskInfo = this.extractTaskInfo(tasks, taskId);
      
      if (!taskInfo) {
        return {
          success: false,
          error: `Task not found: ${taskId}`
        };
      }

      // 提取相关 Requirements
      const relevantRequirements = this.extractRelevantRequirements(
        requirements,
        taskInfo
      );

      // 提取相关 Design
      const relevantDesign = this.extractRelevantDesignSections(
        design,
        taskInfo
      );

      return {
        success: true,
        taskId,
        taskInfo,
        relevantRequirements,
        relevantDesign
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 提取任务信息
   * 
   * @param {string} tasksContent - tasks.md 内容
   * @param {string} taskId - 任务 ID
   * @returns {Object|null} 任务信息
   */
  extractTaskInfo(tasksContent, taskId) {
    const lines = tasksContent.split('\n');
    const taskPattern = new RegExp(`^-\\s*\\[[\\s\\-x~]\\]\\*?\\s+${taskId}\\s+(.+)$`);

    for (const line of lines) {
      const match = line.match(taskPattern);
      if (match) {
        return {
          id: taskId,
          title: match[1].replace(/\[@.+\]$/, '').trim(),
          fullLine: line
        };
      }
    }

    return null;
  }

  /**
   * 提取相关 Requirements
   * 
   * @param {string} requirements - Requirements 内容
   * @param {Object} taskInfo - 任务信息
   * @returns {string} 相关 Requirements
   */
  extractRelevantRequirements(requirements, taskInfo) {
    if (!requirements) {
      return 'No requirements document found.';
    }

    // 简单实现：返回所有 Requirements
    // 可以根据任务描述中的关键词进行智能过滤
    return requirements;
  }

  /**
   * 提取相关 Design 章节
   * 
   * @param {string} design - Design 内容
   * @param {Object} taskInfo - 任务信息
   * @returns {string} 相关 Design 章节
   */
  extractRelevantDesignSections(design, taskInfo) {
    if (!design) {
      return 'No design document found.';
    }

    // 简单实现：返回所有 Design
    // 可以根据任务描述中的关键词进行智能过滤
    return design;
  }
}

module.exports = ContextExporter;
