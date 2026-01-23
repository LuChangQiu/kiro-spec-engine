const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

/**
 * WorkspaceManager - 管理个人工作区
 * 
 * 为多用户协作提供隔离的个人工作区
 */
class WorkspaceManager {
  constructor() {
    this.workspaceBaseDir = '.kiro/workspace';
    this.gitignoreContent = '# Personal workspaces - not committed\n*\n!.gitignore\n';
  }

  /**
   * 初始化个人工作区
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名（可选，自动检测）
   * @returns {Promise<Object>} 初始化结果
   */
  async initWorkspace(projectPath, username = null) {
    try {
      // 检测用户名
      const detectedUsername = username || await this.detectUsername();
      
      if (!detectedUsername) {
        return {
          success: false,
          error: 'Could not detect username. Please provide username explicitly.',
          username: null
        };
      }

      // 创建工作区目录
      const workspacePath = path.join(projectPath, this.workspaceBaseDir, detectedUsername);
      await fs.ensureDir(workspacePath);

      // 创建 CURRENT_CONTEXT.md
      const contextPath = path.join(workspacePath, 'CURRENT_CONTEXT.md');
      if (!await fs.pathExists(contextPath)) {
        const contextTemplate = this.generateContextTemplate(detectedUsername);
        await fs.writeFile(contextPath, contextTemplate, 'utf8');
      }

      // 创建 task-state.json
      const taskStatePath = path.join(workspacePath, 'task-state.json');
      if (!await fs.pathExists(taskStatePath)) {
        const initialState = {
          username: detectedUsername,
          createdAt: new Date().toISOString(),
          lastSyncAt: null,
          currentSpec: null,
          taskState: {}
        };
        await fs.writeFile(taskStatePath, JSON.stringify(initialState, null, 2), 'utf8');
      }

      // 创建 sync.log
      const syncLogPath = path.join(workspacePath, 'sync.log');
      if (!await fs.pathExists(syncLogPath)) {
        await fs.writeFile(syncLogPath, '', 'utf8');
      }

      // 确保 .gitignore 存在
      await this.ensureGitignore(projectPath);

      return {
        success: true,
        username: detectedUsername,
        workspacePath,
        filesCreated: ['CURRENT_CONTEXT.md', 'task-state.json', 'sync.log']
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        username: username
      };
    }
  }

  /**
   * 检测当前用户名
   * 
   * 优先级：git config > 环境变量 > 系统用户名
   * 
   * @returns {Promise<string|null>} 用户名或 null
   */
  async detectUsername() {
    try {
      // 1. 尝试从 git config 获取
      try {
        const gitUsername = execSync('git config user.name', { 
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        }).trim();
        
        if (gitUsername) {
          return gitUsername;
        }
      } catch (error) {
        // Git 不可用或未配置，继续尝试其他方法
      }

      // 2. 尝试从环境变量获取
      const envUsername = process.env.USER || process.env.USERNAME;
      if (envUsername) {
        return envUsername;
      }

      // 3. 尝试从系统获取
      const osUsername = os.userInfo().username;
      if (osUsername) {
        return osUsername;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取当前用户的工作区路径
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名（可选，自动检测）
   * @returns {Promise<string|null>} 工作区路径或 null
   */
  async getWorkspacePath(projectPath, username = null) {
    const detectedUsername = username || await this.detectUsername();
    
    if (!detectedUsername) {
      return null;
    }

    const workspacePath = path.join(projectPath, this.workspaceBaseDir, detectedUsername);
    const exists = await fs.pathExists(workspacePath);
    
    return exists ? workspacePath : null;
  }

  /**
   * 检查是否启用多用户模式
   * 
   * @param {string} projectPath - 项目根目录路径
   * @returns {Promise<boolean>} 是否启用多用户模式
   */
  async isMultiUserMode(projectPath) {
    const workspaceBasePath = path.join(projectPath, this.workspaceBaseDir);
    
    // 检查 workspace 目录是否存在
    const exists = await fs.pathExists(workspaceBasePath);
    if (!exists) {
      return false;
    }

    // 检查是否有用户子目录
    try {
      const entries = await fs.readdir(workspaceBasePath, { withFileTypes: true });
      const userDirs = entries.filter(entry => 
        entry.isDirectory() && !entry.name.startsWith('.')
      );
      
      return userDirs.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 列出所有用户工作区
   * 
   * @param {string} projectPath - 项目根目录路径
   * @returns {Promise<Array<string>>} 用户名列表
   */
  async listWorkspaces(projectPath) {
    const workspaceBasePath = path.join(projectPath, this.workspaceBaseDir);
    
    const exists = await fs.pathExists(workspaceBasePath);
    if (!exists) {
      return [];
    }

    try {
      const entries = await fs.readdir(workspaceBasePath, { withFileTypes: true });
      const usernames = entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => entry.name);
      
      return usernames;
    } catch (error) {
      return [];
    }
  }

  /**
   * 确保 workspace .gitignore 存在
   * 
   * @param {string} projectPath - 项目根目录路径
   * @returns {Promise<boolean>} 是否成功
   */
  async ensureGitignore(projectPath) {
    const workspaceBasePath = path.join(projectPath, this.workspaceBaseDir);
    const gitignorePath = path.join(workspaceBasePath, '.gitignore');

    try {
      await fs.ensureDir(workspaceBasePath);
      
      const exists = await fs.pathExists(gitignorePath);
      if (!exists) {
        await fs.writeFile(gitignorePath, this.gitignoreContent, 'utf8');
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 读取工作区状态
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名（可选，自动检测）
   * @returns {Promise<Object|null>} 工作区状态或 null
   */
  async readWorkspaceState(projectPath, username = null) {
    const workspacePath = await this.getWorkspacePath(projectPath, username);
    
    if (!workspacePath) {
      return null;
    }

    const taskStatePath = path.join(workspacePath, 'task-state.json');
    
    try {
      const exists = await fs.pathExists(taskStatePath);
      if (!exists) {
        return null;
      }

      const content = await fs.readFile(taskStatePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * 写入工作区状态
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {Object} state - 工作区状态
   * @param {string} username - 用户名（可选，自动检测）
   * @returns {Promise<boolean>} 是否成功
   */
  async writeWorkspaceState(projectPath, state, username = null) {
    const workspacePath = await this.getWorkspacePath(projectPath, username);
    
    if (!workspacePath) {
      return false;
    }

    const taskStatePath = path.join(workspacePath, 'task-state.json');
    
    try {
      await fs.writeFile(taskStatePath, JSON.stringify(state, null, 2), 'utf8');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成 CURRENT_CONTEXT.md 模板
   * 
   * @param {string} username - 用户名
   * @returns {string} 模板内容
   */
  generateContextTemplate(username) {
    return `# Personal Context - ${username}

> **Note**: This is your personal context file. It is not shared with other team members.

---

## 🎯 Current Status

**Status**: 🔥 Active  
**Current Spec**: None  
**Last Updated**: ${new Date().toISOString().split('T')[0]}

---

## 📝 Current Work

**What I'm working on**:
- (Add your current tasks here)

**Next Steps**:
- (Add your next steps here)

---

## 💡 Notes

**Important Information**:
- (Add important notes here)

**Blockers**:
- (Add any blockers here)

---

## 📋 Task Tracking

**Claimed Tasks**:
- (Tasks you've claimed will appear here)

**Completed Tasks**:
- (Completed tasks will appear here)

---

**Version**: 1.0  
**Created**: ${new Date().toISOString()}  
**Owner**: ${username}
`;
  }

  /**
   * 获取工作区信息
   * 
   * @param {string} projectPath - 项目根目录路径
   * @param {string} username - 用户名（可选，自动检测）
   * @returns {Promise<Object|null>} 工作区信息或 null
   */
  async getWorkspaceInfo(projectPath, username = null) {
    const detectedUsername = username || await this.detectUsername();
    
    if (!detectedUsername) {
      return null;
    }

    const workspacePath = await this.getWorkspacePath(projectPath, detectedUsername);
    
    if (!workspacePath) {
      return {
        exists: false,
        username: detectedUsername,
        path: null
      };
    }

    const state = await this.readWorkspaceState(projectPath, detectedUsername);
    
    return {
      exists: true,
      username: detectedUsername,
      path: workspacePath,
      state
    };
  }
}

module.exports = WorkspaceManager;
