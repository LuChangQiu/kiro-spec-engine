const fs = require('fs-extra');
const path = require('path');
const TaskClaimer = require('../task/task-claimer');
const WorkspaceManager = require('./workspace-manager');

/**
 * WorkspaceSync - 工作区同步
 * 
 * 协调个人工作区状态和共享任务状态
 */
class WorkspaceSync {
  constructor() {
    this.taskClaimer = new TaskClaimer();
    this.workspaceManager = new WorkspaceManager();
  }

  /**
   * 同步工作区
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名（可选，自动检测）
   * @returns {Promise<Object>} 同步结果
   */
  async syncWorkspace(projectPath, username = null) {
    try {
      // 检测用户名
      const detectedUsername = username || await this.workspaceManager.detectUsername();
      
      if (!detectedUsername) {
        return {
          success: false,
          error: 'Could not detect username'
        };
      }

      // 检查工作区是否存在
      const workspacePath = await this.workspaceManager.getWorkspacePath(projectPath, detectedUsername);
      
      if (!workspacePath) {
        return {
          success: false,
          error: 'Workspace not initialized. Run: kse workspace init'
        };
      }

      // 读取个人工作区状态
      const workspaceState = await this.workspaceManager.readWorkspaceState(projectPath, detectedUsername);
      
      if (!workspaceState) {
        return {
          success: false,
          error: 'Could not read workspace state'
        };
      }

      // 获取所有 Spec
      const specsPath = path.join(projectPath, '.kiro/specs');
      const specsExist = await fs.pathExists(specsPath);
      
      if (!specsExist) {
        return {
          success: true,
          username: detectedUsername,
          conflicts: [],
          synced: 0,
          message: 'No specs to sync'
        };
      }

      const entries = await fs.readdir(specsPath, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));

      // 同步每个 Spec
      const conflicts = [];
      let syncedCount = 0;

      for (const specDir of specDirs) {
        const specName = specDir.name;
        const syncResult = await this.syncSpec(projectPath, specName, detectedUsername, workspaceState);
        
        if (syncResult.conflicts.length > 0) {
          conflicts.push(...syncResult.conflicts);
        }
        
        if (syncResult.synced) {
          syncedCount++;
        }
      }

      // 更新同步时间
      workspaceState.lastSyncAt = new Date().toISOString();
      await this.workspaceManager.writeWorkspaceState(projectPath, workspaceState, detectedUsername);

      // 记录同步日志
      await this.logSync(projectPath, detectedUsername, {
        timestamp: new Date().toISOString(),
        specs: syncedCount,
        conflicts: conflicts.length,
        success: conflicts.length === 0
      });

      return {
        success: true,
        username: detectedUsername,
        conflicts,
        synced: syncedCount,
        message: conflicts.length > 0 
          ? `Synced with ${conflicts.length} conflict(s)` 
          : `Synced ${syncedCount} spec(s) successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 同步单个 Spec
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} specName - Spec 名称
   * @param {string} username - 用户名
   * @param {Object} workspaceState - 工作区状态
   * @returns {Promise<Object>} 同步结果
   */
  async syncSpec(projectPath, specName, username, workspaceState) {
    const conflicts = [];
    let synced = false;

    try {
      // 读取共享任务状态
      const tasksPath = path.join(projectPath, '.kiro/specs', specName, 'tasks.md');
      const tasksExist = await fs.pathExists(tasksPath);
      
      if (!tasksExist) {
        return { conflicts, synced: false };
      }

      const tasks = await this.taskClaimer.parseTasks(tasksPath);

      // 获取个人任务状态
      const personalTaskState = workspaceState.taskState[specName] || {};

      // 检测冲突
      for (const task of tasks) {
        const personalState = personalTaskState[task.taskId];
        
        if (!personalState) {
          continue;
        }

        // 检查状态冲突
        if (personalState.status !== task.status) {
          // 如果任务被当前用户认领，个人状态优先
          if (task.claimedBy === username) {
            // 更新共享状态为个人状态
            await this.taskClaimer.updateTaskStatus(
              projectPath,
              specName,
              task.taskId,
              personalState.status
            );
            synced = true;
          } else {
            // 冲突：任务被其他人认领或状态不一致
            conflicts.push({
              specName,
              taskId: task.taskId,
              taskTitle: task.title,
              personalStatus: personalState.status,
              sharedStatus: task.status,
              claimedBy: task.claimedBy,
              type: task.claimedBy ? 'claimed-by-other' : 'status-mismatch'
            });
          }
        }
      }

      // 更新个人状态为共享状态（对于未认领的任务）
      for (const task of tasks) {
        if (!task.claimedBy || task.claimedBy !== username) {
          if (!workspaceState.taskState[specName]) {
            workspaceState.taskState[specName] = {};
          }
          
          workspaceState.taskState[specName][task.taskId] = {
            status: task.status,
            claimedAt: task.claimedAt,
            completedAt: task.status === 'completed' ? new Date().toISOString() : null
          };
        }
      }

      return { conflicts, synced };
    } catch (error) {
      return { conflicts, synced: false };
    }
  }

  /**
   * 解决冲突
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {Object} conflict - 冲突对象
   * @param {string} resolution - 解决策略 ('keep-local' | 'keep-remote' | 'merge')
   * @param {string} username - 用户名
   * @returns {Promise<Object>} 解决结果
   */
  async resolveConflict(projectPath, conflict, resolution, username) {
    try {
      const { specName, taskId, personalStatus, sharedStatus } = conflict;

      if (resolution === 'keep-local') {
        // 使用个人状态更新共享状态
        const result = await this.taskClaimer.updateTaskStatus(
          projectPath,
          specName,
          taskId,
          personalStatus
        );
        
        return {
          success: result.success,
          resolution: 'keep-local',
          finalStatus: personalStatus
        };
      } else if (resolution === 'keep-remote') {
        // 使用共享状态更新个人状态
        const workspaceState = await this.workspaceManager.readWorkspaceState(projectPath, username);
        
        if (!workspaceState.taskState[specName]) {
          workspaceState.taskState[specName] = {};
        }
        
        workspaceState.taskState[specName][taskId] = {
          status: sharedStatus,
          claimedAt: null,
          completedAt: sharedStatus === 'completed' ? new Date().toISOString() : null
        };
        
        await this.workspaceManager.writeWorkspaceState(projectPath, workspaceState, username);
        
        return {
          success: true,
          resolution: 'keep-remote',
          finalStatus: sharedStatus
        };
      } else if (resolution === 'merge') {
        // 合并策略：如果任一状态为 completed，使用 completed
        const finalStatus = personalStatus === 'completed' || sharedStatus === 'completed'
          ? 'completed'
          : personalStatus === 'in-progress' || sharedStatus === 'in-progress'
          ? 'in-progress'
          : 'not-started';
        
        // 更新共享状态
        await this.taskClaimer.updateTaskStatus(projectPath, specName, taskId, finalStatus);
        
        // 更新个人状态
        const workspaceState = await this.workspaceManager.readWorkspaceState(projectPath, username);
        
        if (!workspaceState.taskState[specName]) {
          workspaceState.taskState[specName] = {};
        }
        
        workspaceState.taskState[specName][taskId] = {
          status: finalStatus,
          claimedAt: null,
          completedAt: finalStatus === 'completed' ? new Date().toISOString() : null
        };
        
        await this.workspaceManager.writeWorkspaceState(projectPath, workspaceState, username);
        
        return {
          success: true,
          resolution: 'merge',
          finalStatus
        };
      }
      
      return {
        success: false,
        error: 'Invalid resolution strategy'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 记录同步日志
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名
   * @param {Object} syncInfo - 同步信息
   * @returns {Promise<boolean>} 是否成功
   */
  async logSync(projectPath, username, syncInfo) {
    try {
      const workspacePath = await this.workspaceManager.getWorkspacePath(projectPath, username);
      
      if (!workspacePath) {
        return false;
      }

      const logPath = path.join(workspacePath, 'sync.log');
      const logEntry = `[${syncInfo.timestamp}] Synced ${syncInfo.specs} spec(s), ${syncInfo.conflicts} conflict(s), success: ${syncInfo.success}\n`;
      
      await fs.appendFile(logPath, logEntry, 'utf8');
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 读取同步日志
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名
   * @param {number} lines - 读取行数（默认 10）
   * @returns {Promise<Array>} 日志条目
   */
  async readSyncLog(projectPath, username, lines = 10) {
    try {
      const workspacePath = await this.workspaceManager.getWorkspacePath(projectPath, username);
      
      if (!workspacePath) {
        return [];
      }

      const logPath = path.join(workspacePath, 'sync.log');
      const exists = await fs.pathExists(logPath);
      
      if (!exists) {
        return [];
      }

      const content = await fs.readFile(logPath, 'utf8');
      const allLines = content.trim().split('\n').filter(line => line);
      
      // 返回最后 N 行
      return allLines.slice(-lines);
    } catch (error) {
      return [];
    }
  }
}

module.exports = WorkspaceSync;
