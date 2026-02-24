/**
 * SpecSteering - Spec 级 steering.md 管理
 *
 * 负责 `.sce/specs/{spec-name}/steering.md` 的 CRUD 操作和模板管理。
 * 在单 Agent 模式下 createTemplate 为 no-op。
 *
 * Requirements: 1.1, 1.3, 1.4, 7.1, 7.2, 7.3
 */

const path = require('path');
const fs = require('fs-extra');
const fsUtils = require('../utils/fs-utils');
const { MultiAgentConfig } = require('../collab/multi-agent-config');

const STEERING_FILENAME = 'steering.md';
const SPECS_DIR = '.sce/specs';

/**
 * Section headers used in steering.md template.
 * Order matters for format output.
 */
const SECTIONS = [
  { key: 'constraints', header: '## 约束 (Constraints)' },
  { key: 'notes',       header: '## 注意事项 (Notes)' },
  { key: 'decisions',   header: '## 决策记录 (Decisions)' },
];

class SpecSteering {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   */
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
  }

  /**
   * Build the absolute path to a Spec's steering.md.
   * @param {string} specName
   * @returns {string}
   */
  _steeringPath(specName) {
    return path.join(this._workspaceRoot, SPECS_DIR, specName, STEERING_FILENAME);
  }

  /**
   * Generate a steering.md template for the given Spec.
   * Only executes in multi-Agent mode; single-Agent mode returns no-op.
   *
   * @param {string} specName
   * @returns {Promise<{created: boolean, path: string}>}
   */
  async createTemplate(specName) {
    const enabled = await this._multiAgentConfig.isEnabled();
    if (!enabled) {
      return { created: false, path: '' };
    }

    const filePath = this._steeringPath(specName);

    // Don't overwrite an existing steering.md
    const exists = await fs.pathExists(filePath);
    if (exists) {
      return { created: false, path: filePath };
    }

    const specDir = path.dirname(filePath);
    await fsUtils.ensureDirectory(specDir);

    const template = this.format({
      constraints: [],
      notes: [],
      decisions: [],
    }, specName);

    await fsUtils.atomicWrite(filePath, template);
    return { created: true, path: filePath };
  }

  /**
   * Read and parse a Spec's steering.md into a structured object.
   * Returns null if the file does not exist.
   * Returns empty arrays if the file is corrupted / unparseable.
   *
   * @param {string} specName
   * @returns {Promise<{constraints: string[], notes: string[], decisions: string[]}|null>}
   */
  async read(specName) {
    const filePath = this._steeringPath(specName);
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parse(content);
    } catch (err) {
      console.warn(`[SpecSteering] Failed to read ${filePath}: ${err.message}`);
      return { constraints: [], notes: [], decisions: [] };
    }
  }

  /**
   * Write a structured object back to steering.md using atomic write.
   *
   * @param {string} specName
   * @param {{constraints: string[], notes: string[], decisions: string[]}} data
   * @returns {Promise<void>}
   */
  async write(specName, data) {
    const filePath = this._steeringPath(specName);
    const specDir = path.dirname(filePath);
    await fsUtils.ensureDirectory(specDir);

    const content = this.format(data, specName);
    await fsUtils.atomicWrite(filePath, content);
  }

  /**
   * Parse steering.md Markdown content into a structured object.
   * Gracefully handles corrupted / unexpected content by returning empty arrays.
   *
   * @param {string} content - Markdown string
   * @returns {{constraints: string[], notes: string[], decisions: string[]}}
   */
  parse(content) {
    const result = { constraints: [], notes: [], decisions: [] };

    if (!content || typeof content !== 'string') {
      return result;
    }

    try {
      const lines = content.split('\n');
      let currentSection = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Detect section headers
        const section = this._detectSection(trimmed);
        if (section) {
          currentSection = section;
          continue;
        }

        // Collect list items under the current section
        if (currentSection && trimmed.startsWith('- ')) {
          const item = trimmed.slice(2).trim();
          if (item && !item.startsWith('[') ) {
            // Skip placeholder items like "[约束条目]"
            result[currentSection].push(item);
          }
        }
      }
    } catch (err) {
      console.warn(`[SpecSteering] Failed to parse steering.md content: ${err.message}`);
      return { constraints: [], notes: [], decisions: [] };
    }

    return result;
  }

  /**
   * Format a structured object into steering.md Markdown.
   *
   * @param {{constraints: string[], notes: string[], decisions: string[]}} data
   * @param {string} [specName=''] - Used for the title line
   * @returns {string}
   */
  format(data, specName = '') {
    const lines = [];

    // Title
    lines.push(`# Spec Steering: ${specName}`);
    lines.push('');

    for (const { key, header } of SECTIONS) {
      lines.push(header);
      lines.push('');

      const items = (data && Array.isArray(data[key])) ? data[key] : [];
      if (items.length === 0) {
        // Empty section placeholder
        lines.push(`- [${this._placeholderFor(key)}]`);
      } else {
        for (const item of items) {
          lines.push(`- ${item}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Detect which section a header line belongs to.
   * @param {string} trimmedLine
   * @returns {string|null} Section key or null
   */
  _detectSection(trimmedLine) {
    for (const { key, header } of SECTIONS) {
      if (trimmedLine === header || trimmedLine.startsWith(header.split(' (')[0])) {
        return key;
      }
    }
    return null;
  }

  /**
   * Return the placeholder text for an empty section.
   * @param {string} sectionKey
   * @returns {string}
   */
  _placeholderFor(sectionKey) {
    const map = {
      constraints: '约束条目',
      notes: '注意事项条目',
      decisions: '决策条目',
    };
    return map[sectionKey] || sectionKey;
  }
}

module.exports = { SpecSteering };
