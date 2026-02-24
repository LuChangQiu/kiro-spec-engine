/**
 * SteeringLoader - 统一加载并合并 L1-L4 四层 Steering 约束
 *
 * L1: CORE_PRINCIPLES.md (通用约束)
 * L2: ENVIRONMENT.md (环境约束)
 * L3: CURRENT_CONTEXT.md (全局上下文)
 * L4: .kiro/specs/{spec-name}/steering.md (Spec 级约束, via SpecSteering)
 *
 * 单 Agent 模式下跳过 L4。
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.4
 */

const path = require('path');
const fs = require('fs-extra');
const { SpecSteering } = require('./spec-steering');
const { MultiAgentConfig } = require('../collab/multi-agent-config');

const STEERING_DIR_CANDIDATES = ['.sce/steering', '.kiro/steering'];

const LAYER_FILES = {
  l1: 'CORE_PRINCIPLES.md',
  l2: 'ENVIRONMENT.md',
  l3: 'CURRENT_CONTEXT.md',
};

class SteeringLoader {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   */
  constructor(workspaceRoot) {
    this._workspaceRoot = workspaceRoot;
    this._specSteering = new SpecSteering(workspaceRoot);
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
  }

  /**
   * 加载所有层级的 Steering 内容。
   * 单 Agent 模式下跳过 L4。
   *
   * @param {string|null} specName - 当前 Spec 名称，null 时跳过 L4
   * @returns {Promise<{
   *   l1: string|null,
   *   l2: string|null,
   *   l3: string|null,
   *   l4: {constraints: string[], notes: string[], decisions: string[]}|null
   * }>}
   */
  async load(specName = null) {
    const [l1, l2, l3] = await Promise.all([
      this._loadLayerFile('l1'),
      this._loadLayerFile('l2'),
      this._loadLayerFile('l3'),
    ]);

    let l4 = null;
    if (specName) {
      const enabled = await this._multiAgentConfig.isEnabled();
      if (enabled) {
        l4 = await this._loadL4(specName);
      }
    }

    return { l1, l2, l3, l4 };
  }

  /**
   * 加载并合并所有层级，L4 覆盖 L1-L3 的冲突项。
   * L4 内容追加在最后，使其优先级最高。
   *
   * @param {string|null} specName
   * @returns {Promise<{layers: object, merged: string}>}
   */
  async loadMerged(specName = null) {
    const layers = await this.load(specName);
    const parts = [];

    if (layers.l1) {
      parts.push(layers.l1);
    }
    if (layers.l2) {
      parts.push(layers.l2);
    }
    if (layers.l3) {
      parts.push(layers.l3);
    }
    if (layers.l4) {
      parts.push(this._formatL4(layers.l4));
    }

    return {
      layers,
      merged: parts.join('\n\n---\n\n'),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Load a L1/L2/L3 layer file. Returns null if the file doesn't exist.
   * @param {'l1'|'l2'|'l3'} layerKey
   * @returns {Promise<string|null>}
   */
  async _loadLayerFile(layerKey) {
    const filename = LAYER_FILES[layerKey];
    for (const steeringDir of STEERING_DIR_CANDIDATES) {
      const filePath = path.join(this._workspaceRoot, steeringDir, filename);
      try {
        const exists = await fs.pathExists(filePath);
        if (!exists) {
          continue;
        }
        return await fs.readFile(filePath, 'utf8');
      } catch (err) {
        console.warn(`[SteeringLoader] Failed to read ${layerKey} (${filename}) from ${steeringDir}: ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Load L4 via SpecSteering. Returns null if the file doesn't exist or is corrupted.
   * @param {string} specName
   * @returns {Promise<{constraints: string[], notes: string[], decisions: string[]}|null>}
   */
  async _loadL4(specName) {
    try {
      return await this._specSteering.read(specName);
    } catch (err) {
      console.warn(`[SteeringLoader] Failed to read L4 for ${specName}: ${err.message}`);
      return null;
    }
  }

  /**
   * Format L4 structured object back to a Markdown string for merging.
   * @param {{constraints: string[], notes: string[], decisions: string[]}} l4
   * @returns {string}
   */
  _formatL4(l4) {
    return this._specSteering.format(l4);
  }
}

module.exports = { SteeringLoader };
