const fs = require('fs-extra');
const path = require('path');

/**
 * PromptGenerator - 提示生成器
 * 
 * 为特定任务生成 AI 编码助手的提示文件
 */
class PromptGenerator {
  constructor() {
    this.promptsDir = 'prompts';
  }

  /**
   * 生成任务提示
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} specName - Spec 名称
   * @param {string} taskId - 任务 ID
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 生成结果
   */
  async generatePrompt(projectPath, specName, taskId, options = {}) {
    const {
      targetTool = 'generic',
      includeCodeContext = false,
      maxContextLength = 10000
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

      // 读取 Spec 文件
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

      // 格式化提示
      const prompt = this.formatPrompt({
        specName,
        taskId,
        taskInfo,
        relevantRequirements,
        relevantDesign,
        targetTool,
        maxContextLength
      });

      // 保存提示文件
      const promptPath = await this.savePrompt(specPath, taskId, prompt);

      return {
        success: true,
        promptPath,
        specName,
        taskId,
        size: Buffer.byteLength(prompt, 'utf8')
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
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
   * 提取任务信息
   * 
   * @param {string} tasksContent - tasks.md 内容
   * @param {string} taskId - 任务 ID
   * @returns {Object|null} 任务信息
   */
  extractTaskInfo(tasksContent, taskId) {
    const lines = tasksContent.split('\n');
    const taskPattern = new RegExp(`^-\\s*\\[[\\s\\-x~]\\]\\*?\\s+${taskId}\\s+(.+)$`);
    
    let taskInfo = null;
    let inTaskDetails = false;
    const details = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(taskPattern);
      
      if (match) {
        taskInfo = {
          id: taskId,
          title: match[1].replace(/\[@.+\]$/, '').trim(),
          fullLine: line,
          details: []
        };
        inTaskDetails = true;
        continue;
      }

      if (inTaskDetails) {
        // 收集任务详细信息（缩进的行）
        if (line.trim() === '') {
          continue;
        }
        
        if (line.startsWith('    ') || line.startsWith('  - ')) {
          details.push(line.trim());
        } else if (line.match(/^-\s*\[/)) {
          // 遇到下一个任务，停止收集
          break;
        }
      }
    }

    if (taskInfo) {
      taskInfo.details = details;
    }

    return taskInfo;
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

    // 从任务详情中提取 Requirements 引用
    const reqReferences = [];
    for (const detail of taskInfo.details) {
      const match = detail.match(/_Requirements?:\s*([\d\.,\s]+)_/);
      if (match) {
        const refs = match[1].split(',').map(r => r.trim());
        reqReferences.push(...refs);
      }
    }

    if (reqReferences.length === 0) {
      // 如果没有明确引用，返回所有 Requirements
      return requirements;
    }

    // 提取引用的 Requirements 章节
    const sections = this.extractSectionsByReferences(
      requirements,
      reqReferences,
      'Requirement'
    );

    return sections.length > 0 ? sections.join('\n\n') : requirements;
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

    // 从任务标题中提取关键词
    const keywords = this.extractKeywords(taskInfo.title);

    // 查找包含关键词的 Design 章节
    const sections = this.extractSectionsByKeywords(design, keywords);

    return sections.length > 0 ? sections.join('\n\n') : design;
  }

  /**
   * 根据引用提取章节
   * 
   * @param {string} content - 文档内容
   * @param {Array<string>} references - 引用列表
   * @param {string} prefix - 章节前缀
   * @returns {Array<string>} 提取的章节
   */
  extractSectionsByReferences(content, references, prefix) {
    const sections = [];
    const lines = content.split('\n');
    
    for (const ref of references) {
      const pattern = new RegExp(`^###?\\s+${prefix}\\s+${ref}[:\\s]`, 'i');
      let inSection = false;
      let section = [];

      for (const line of lines) {
        if (pattern.test(line)) {
          inSection = true;
          section = [line];
        } else if (inSection) {
          if (line.match(/^###?\s+/)) {
            // 遇到下一个章节，停止收集
            sections.push(section.join('\n'));
            break;
          }
          section.push(line);
        }
      }

      if (section.length > 0) {
        sections.push(section.join('\n'));
      }
    }

    return sections;
  }

  /**
   * 提取关键词
   * 
   * @param {string} text - 文本
   * @returns {Array<string>} 关键词列表
   */
  extractKeywords(text) {
    // 移除常见词汇，提取有意义的关键词
    const stopWords = ['implement', 'create', 'add', 'update', 'write', 'test', 'the', 'a', 'an', 'and', 'or', 'for', 'to', 'with'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.includes(w));

    return [...new Set(words)];
  }

  /**
   * 根据关键词提取章节
   * 
   * @param {string} content - 文档内容
   * @param {Array<string>} keywords - 关键词列表
   * @returns {Array<string>} 提取的章节
   */
  extractSectionsByKeywords(content, keywords) {
    if (keywords.length === 0) {
      return [];
    }

    const sections = [];
    const lines = content.split('\n');
    let currentSection = [];
    let inRelevantSection = false;

    for (const line of lines) {
      if (line.match(/^###?\s+/)) {
        // 检查是否是新章节
        if (currentSection.length > 0 && inRelevantSection) {
          sections.push(currentSection.join('\n'));
        }
        
        // 检查章节标题是否包含关键词
        const lowerLine = line.toLowerCase();
        inRelevantSection = keywords.some(kw => lowerLine.includes(kw));
        currentSection = [line];
      } else if (inRelevantSection) {
        currentSection.push(line);
      }
    }

    if (currentSection.length > 0 && inRelevantSection) {
      sections.push(currentSection.join('\n'));
    }

    return sections;
  }

  /**
   * 格式化提示
   * 
   * @param {Object} params - 提示参数
   * @returns {string} 格式化的提示
   */
  formatPrompt(params) {
    const {
      specName,
      taskId,
      taskInfo,
      relevantRequirements,
      relevantDesign,
      targetTool,
      maxContextLength
    } = params;

    const sections = [];

    // 头部
    sections.push(`# Task Prompt: ${specName} - Task ${taskId}`);
    sections.push('');
    sections.push(`**Generated**: ${new Date().toISOString()}`);
    sections.push(`**Target Tool**: ${targetTool}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // 任务描述
    sections.push('## 📋 Task Description');
    sections.push('');
    sections.push(`**Task ID**: ${taskId}`);
    sections.push(`**Title**: ${taskInfo.title}`);
    sections.push('');
    
    if (taskInfo.details.length > 0) {
      sections.push('**Details**:');
      for (const detail of taskInfo.details) {
        sections.push(`- ${detail}`);
      }
      sections.push('');
    }

    sections.push('---');
    sections.push('');

    // 相关 Requirements
    sections.push('## 📖 Relevant Requirements');
    sections.push('');
    sections.push(this.truncateContent(relevantRequirements, maxContextLength * 0.4));
    sections.push('');
    sections.push('---');
    sections.push('');

    // 相关 Design
    sections.push('## 🏗️ Relevant Design');
    sections.push('');
    sections.push(this.truncateContent(relevantDesign, maxContextLength * 0.4));
    sections.push('');
    sections.push('---');
    sections.push('');

    // 实现指南
    sections.push('## 💡 Implementation Guidelines');
    sections.push('');
    sections.push('1. **Read the requirements** carefully to understand what needs to be implemented');
    sections.push('2. **Review the design** to understand the architecture and interfaces');
    sections.push('3. **Implement the functionality** following the task details');
    sections.push('4. **Write tests** to verify the implementation');
    sections.push('5. **Update task status** after completion');
    sections.push('');
    sections.push('---');
    sections.push('');

    // 任务状态更新说明
    sections.push('## ✅ Task Status Update');
    sections.push('');
    sections.push('After completing this task, update the task status in `tasks.md`:');
    sections.push('');
    sections.push('```markdown');
    sections.push(`- [x] ${taskId} ${taskInfo.title}`);
    sections.push('```');
    sections.push('');
    sections.push('---');
    sections.push('');

    // 工具特定说明
    sections.push('## 🔧 Tool-Specific Notes');
    sections.push('');
    sections.push(this.getToolSpecificNotes(targetTool));
    sections.push('');

    return sections.join('\n');
  }

  /**
   * 截断内容
   * 
   * @param {string} content - 内容
   * @param {number} maxLength - 最大长度
   * @returns {string} 截断后的内容
   */
  truncateContent(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength) + '\n\n... (content truncated)';
  }

  /**
   * 获取工具特定说明
   * 
   * @param {string} targetTool - 目标工具
   * @returns {string} 工具特定说明
   */
  getToolSpecificNotes(targetTool) {
    const notes = {
      'generic': 'This prompt is compatible with any AI coding assistant.',
      'claude-code': 'Use this prompt with Claude Code by copying it into the chat (recommended launch: claude --dangerously-skip-permission).',
      'cursor': 'Use this prompt with Cursor by pasting it into the composer.',
      'codex': 'Use this prompt with GitHub Copilot by including it in your code comments.',
      'SCE': 'This prompt is optimized for AI IDE with automatic steering loading.'
    };

    return notes[targetTool] || notes['generic'];
  }

  /**
   * 保存提示文件
   * 
   * @param {string} specPath - Spec 目录路径
   * @param {string} taskId - 任务 ID
   * @param {string} prompt - 提示内容
   * @returns {Promise<string>} 提示文件路径
   */
  async savePrompt(specPath, taskId, prompt) {
    const promptsPath = path.join(specPath, this.promptsDir);
    await fs.ensureDir(promptsPath);

    const fileName = `task-${taskId.replace(/\./g, '-')}.md`;
    const promptPath = path.join(promptsPath, fileName);

    await fs.writeFile(promptPath, prompt, 'utf8');

    return promptPath;
  }
}

module.exports = PromptGenerator;
