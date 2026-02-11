/**
 * SyncBarrier - Agent 切换 Spec 时的同步屏障
 *
 * 确保 Agent 切换 Spec 时基于一致的代码库和 Steering 工作。
 * - 检查工作区是否有未提交的更改（git status --porcelain）
 * - 重新加载所有层级的 Steering 约束
 * - 单 Agent 模式下为 no-op（返回 {ready: true}）
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

const { execSync } = require('child_process');
const { MultiAgentConfig } = require('./multi-agent-config');

class SyncBarrier {
  /**
   * @param {string} workspaceRoot - Absolute path to the project root
   * @param {import('../steering/steering-loader').SteeringLoader} steeringLoader
   */
  constructor(workspaceRoot, steeringLoader) {
    this._workspaceRoot = workspaceRoot;
    this._steeringLoader = steeringLoader;
    this._multiAgentConfig = new MultiAgentConfig(workspaceRoot);
  }

  /**
   * 执行 Spec 切换前的同步检查。
   * 单 Agent 模式下为 no-op（返回 {ready: true}）。
   *
   * @param {string} specName - 目标 Spec
   * @returns {Promise<{ready: boolean, error?: string, steering?: object}>}
   */
  async prepareSwitch(specName) {
    const enabled = await this._multiAgentConfig.isEnabled();
    if (!enabled) {
      return { ready: true };
    }

    // Check for uncommitted changes
    try {
      const hasChanges = await this.hasUncommittedChanges();
      if (hasChanges) {
        return {
          ready: false,
          error: 'Uncommitted changes detected. Please commit or stash your changes before switching Spec.',
        };
      }
    } catch (err) {
      return {
        ready: false,
        error: `Failed to check git status: ${err.message}`,
      };
    }

    // Reload steering for the target Spec
    try {
      const steering = await this._steeringLoader.loadMerged(specName);
      return { ready: true, steering };
    } catch (err) {
      return {
        ready: false,
        error: `Failed to reload steering for ${specName}: ${err.message}`,
      };
    }
  }

  /**
   * 检查工作区是否有未提交的更改。
   * Git 命令失败时返回 false（优雅降级）。
   *
   * @returns {Promise<boolean>}
   */
  async hasUncommittedChanges() {
    try {
      const output = execSync('git status --porcelain', {
        encoding: 'utf8',
        cwd: this._workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return output.trim().length > 0;
    } catch (_err) {
      // Git command failed — graceful degradation
      return false;
    }
  }
}

module.exports = { SyncBarrier };
