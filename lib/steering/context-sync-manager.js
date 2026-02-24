/**
 * ContextSyncManager - Maintains CURRENT_CONTEXT.md as multi-Spec progress summary
 *
 * Parses and formats CURRENT_CONTEXT.md between Markdown and structured objects.
 * Uses SteeringFileLock for concurrent write protection in multi-Agent mode.
 * In single-Agent mode, updateSpecProgress is a no-op.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.2
 */

const path = require('path');
const fs = require('fs-extra');
const fsUtils = require('../utils/fs-utils');
const { MultiAgentConfig } = require('../collab/multi-agent-config');

const STEERING_DIR = '.sce/steering';
const CONTEXT_FILENAME = 'CURRENT_CONTEXT.md';
const SPECS_DIR = '.sce/specs';

class ContextSyncManager {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('../lock/steering-file-lock').SteeringFileLock} steeringFileLock
   */
  constructor(workspaceRoot, steeringFileLock) {
    this._workspaceRoot = workspaceRoot;
    this._steeringFileLock = steeringFileLock;
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
    this._contextPath = path.join(workspaceRoot, STEERING_DIR, CONTEXT_FILENAME);
  }

  /**
   * Update the progress entry for a specific Spec.
   * Uses SteeringFileLock for concurrent write protection.
   * Single-Agent mode: no-op returning {success: true}.
   *
   * @param {string} specName
   * @param {{status: string, progress: number, summary: string}} entry
   * @returns {Promise<{success: boolean}>}
   */
  async updateSpecProgress(specName, entry) {
    const enabled = await this._multiAgentConfig.isEnabled();
    if (!enabled) {
      return { success: true };
    }

    await this._steeringFileLock.withLock(CONTEXT_FILENAME, async () => {
      const context = await this.readContext();
      context.specs[specName] = {
        status: entry.status,
        progress: entry.progress,
        summary: entry.summary,
      };
      await this.writeContext(context);
    });

    return { success: true };
  }

  /**
   * Read and parse CURRENT_CONTEXT.md into a structured object.
   * Returns default empty object if file doesn't exist.
   *
   * @returns {Promise<{version: string|null, globalStatus: string|null, specs: object}>}
   */
  async readContext() {
    const exists = await fs.pathExists(this._contextPath);
    if (!exists) {
      return { version: null, globalStatus: null, specs: {} };
    }

    try {
      const content = await fs.readFile(this._contextPath, 'utf8');
      return this.parseContext(content);
    } catch (err) {
      console.warn(`[ContextSyncManager] Failed to read ${this._contextPath}: ${err.message}`);
      return { version: null, globalStatus: null, specs: {} };
    }
  }

  /**
   * Write a structured context object back to CURRENT_CONTEXT.md.
   * Uses atomic write for file integrity.
   *
   * @param {{version: string|null, globalStatus: string|null, specs: object}} context
   * @returns {Promise<void>}
   */
  async writeContext(context) {
    const dir = path.dirname(this._contextPath);
    await fsUtils.ensureDirectory(dir);
    const content = this.formatContext(context);
    await fsUtils.atomicWrite(this._contextPath, content);
  }

  /**
   * Compute progress percentage for a Spec based on tasks.md completion.
   * Counts only leaf tasks (lines matching checkbox patterns).
   *
   * @param {string} specName
   * @returns {Promise<number>} 0-100
   */
  async computeProgress(specName) {
    const tasksPath = path.join(this._workspaceRoot, SPECS_DIR, specName, 'tasks.md');
    const exists = await fs.pathExists(tasksPath);
    if (!exists) {
      return 0;
    }

    try {
      const content = await fs.readFile(tasksPath, 'utf8');
      return this._computeProgressFromContent(content);
    } catch (err) {
      console.warn(`[ContextSyncManager] Failed to read ${tasksPath}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Parse CURRENT_CONTEXT.md Markdown content into a structured object.
   * Handles both old single-agent format and new multi-agent table format.
   *
   * @param {string} content
   * @returns {{version: string|null, globalStatus: string|null, specs: object}}
   */
  parseContext(content) {
    const result = { version: null, globalStatus: null, specs: {} };

    if (!content || typeof content !== 'string') {
      return result;
    }

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse version line: **版本**: ...
      const versionMatch = trimmed.match(/^\*\*版本\*\*:\s*(.+)$/);
      if (versionMatch) {
        result.version = versionMatch[1].trim();
        continue;
      }

      // Parse global status line: **状态**: ...
      const statusMatch = trimmed.match(/^\*\*状态\*\*:\s*(.+)$/);
      if (statusMatch) {
        result.globalStatus = statusMatch[1].trim();
        continue;
      }

      // Parse table rows for Spec progress
      // Format: | spec-name | status | progress% | summary |
      if (trimmed.startsWith('|') && !trimmed.startsWith('|---') && !trimmed.startsWith('| Spec')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length >= 4) {
          const specName = cells[0];
          const status = cells[1];
          const progressStr = cells[2].replace('%', '');
          const progress = parseInt(progressStr, 10);
          const summary = cells[3];

          if (specName && status && !isNaN(progress)) {
            result.specs[specName] = { status, progress, summary };
          }
        }
      }
    }

    return result;
  }

  /**
   * Format a structured context object into CURRENT_CONTEXT.md Markdown.
   *
   * @param {{version: string|null, globalStatus: string|null, specs: object}} context
   * @returns {string}
   */
  formatContext(context) {
    const lines = [];

    lines.push('# 当前场景');
    lines.push('');

    if (context.version) {
      lines.push(`**版本**: ${context.version}`);
    }
    if (context.globalStatus) {
      lines.push(`**状态**: ${context.globalStatus}`);
    }

    const specEntries = Object.entries(context.specs || {});
    if (specEntries.length > 0) {
      lines.push('');
      lines.push('## Spec 进度');
      lines.push('');
      lines.push('| Spec | 状态 | 进度 | 摘要 |');
      lines.push('|------|------|------|------|');

      for (const [name, entry] of specEntries) {
        const status = entry.status || '';
        const progress = entry.progress != null ? `${entry.progress}%` : '0%';
        const summary = entry.summary || '';
        lines.push(`| ${name} | ${status} | ${progress} | ${summary} |`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    lines.push(`v1.0 | ${dateStr} | 自动更新`);
    lines.push('');

    return lines.join('\n');
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Compute progress from tasks.md content.
   * Counts only leaf tasks (lines with checkbox patterns that have no sub-tasks).
   *
   * @param {string} content
   * @returns {number} 0-100
   * @private
   */
  _computeProgressFromContent(content) {
    const lines = content.split('\n');
    // Checkbox pattern: - [ ], - [x], - [-], - [~]
    const taskPattern = /^(\s*)- \[([ x\-~])\]\*?\s/;

    // First pass: identify all task lines with their indentation levels
    const tasks = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(taskPattern);
      if (match) {
        tasks.push({
          index: i,
          indent: match[1].length,
          status: match[2],
        });
      }
    }

    // Second pass: identify leaf tasks (tasks with no sub-tasks)
    let total = 0;
    let completed = 0;

    for (let i = 0; i < tasks.length; i++) {
      const current = tasks[i];
      const next = tasks[i + 1];

      // A task is a leaf if the next task is not more indented
      const isLeaf = !next || next.indent <= current.indent;

      if (isLeaf) {
        total++;
        if (current.status === 'x') {
          completed++;
        }
      }
    }

    if (total === 0) {
      return 0;
    }

    return Math.round(completed / total * 100);
  }
}

module.exports = { ContextSyncManager };
