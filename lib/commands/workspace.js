/**
 * Workspace Command Group
 * 
 * Manages personal workspaces for multi-user collaboration
 */

const chalk = require('chalk');
const WorkspaceManager = require('../workspace/workspace-manager');
const WorkspaceSync = require('../workspace/workspace-sync');

/**
 * Initialize personal workspace
 * 
 * @param {Object} options - Command options
 * @param {string} options.user - Override username
 * @returns {Promise<void>}
 */
async function initWorkspace(options = {}) {
  const projectPath = process.cwd();
  const workspaceManager = new WorkspaceManager();
  
  console.log(chalk.red('🔥') + ' Initializing Personal Workspace');
  console.log();
  
  try {
    const username = options.user || await workspaceManager.detectUsername();
    
    if (!username) {
      console.log(chalk.red('❌ Could not detect username'));
      console.log();
      console.log('Please configure git:');
      console.log(chalk.cyan('  git config --global user.name "Your Name"'));
      console.log();
      console.log('Or specify username manually:');
      console.log(chalk.cyan('  kse workspace init --user=yourname'));
      return;
    }
    
    console.log(`User: ${chalk.cyan(username)}`);
    console.log();
    
    const result = await workspaceManager.initWorkspace(projectPath, username);
    
    if (result.success) {
      console.log(chalk.green('✅ Workspace initialized successfully'));
      console.log();
      console.log(`Workspace path: ${chalk.gray(result.workspacePath)}`);
      console.log();
      console.log('Files created:');
      console.log(`  ${chalk.gray('CURRENT_CONTEXT.md')} - Personal context`);
      console.log(`  ${chalk.gray('task-state.json')} - Task tracking`);
      console.log();
      console.log('Next steps:');
      console.log(`  ${chalk.cyan('kse task claim <spec-name> <task-id>')} - Claim a task`);
      console.log(`  ${chalk.cyan('kse workspace sync')} - Sync with team`);
    } else {
      console.log(chalk.red('❌ Failed to initialize workspace'));
      console.log();
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

/**
 * Synchronize workspace with shared state
 * 
 * @param {Object} options - Command options
 * @param {string} options.user - Override username
 * @param {string} options.strategy - Conflict resolution strategy
 * @returns {Promise<void>}
 */
async function syncWorkspace(options = {}) {
  const projectPath = process.cwd();
  const workspaceManager = new WorkspaceManager();
  const workspaceSync = new WorkspaceSync();
  
  console.log(chalk.red('🔥') + ' Synchronizing Workspace');
  console.log();
  
  try {
    const username = options.user || await workspaceManager.detectUsername();
    
    if (!username) {
      console.log(chalk.red('❌ Could not detect username'));
      return;
    }
    
    console.log(`User: ${chalk.cyan(username)}`);
    console.log();
    
    // Check if workspace exists
    const workspacePath = await workspaceManager.getWorkspacePath(projectPath, username);
    const workspaceExists = await workspaceManager.workspaceExists(projectPath, username);
    
    if (!workspaceExists) {
      console.log(chalk.yellow('⚠️  Workspace not initialized'));
      console.log();
      console.log('Run ' + chalk.cyan('kse workspace init') + ' first');
      return;
    }
    
    console.log('Syncing workspace...');
    console.log();
    
    const result = await workspaceSync.syncWorkspace(
      projectPath,
      username,
      { strategy: options.strategy }
    );
    
    if (result.success) {
      console.log(chalk.green('✅ Workspace synchronized'));
      console.log();
      
      if (result.conflicts && result.conflicts.length > 0) {
        console.log(chalk.yellow(`⚠️  ${result.conflicts.length} conflict(s) resolved`));
        console.log();
      }
      
      if (result.changes && result.changes.length > 0) {
        console.log('Changes:');
        for (const change of result.changes) {
          console.log(`  ${chalk.gray('•')} ${change}`);
        }
        console.log();
      }
      
      console.log(`Sync log: ${chalk.gray(result.logPath)}`);
    } else {
      console.log(chalk.red('❌ Sync failed'));
      console.log();
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

/**
 * List all workspaces
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function listWorkspaces(options = {}) {
  const projectPath = process.cwd();
  const workspaceManager = new WorkspaceManager();
  
  console.log(chalk.red('🔥') + ' Workspaces');
  console.log();
  
  try {
    const isMultiUser = await workspaceManager.isMultiUserMode(projectPath);
    
    if (!isMultiUser) {
      console.log(chalk.gray('No workspaces found'));
      console.log();
      console.log('This project is in single-user mode.');
      console.log('Run ' + chalk.cyan('kse workspace init') + ' to enable multi-user mode.');
      return;
    }
    
    const workspaces = await workspaceManager.listWorkspaces(projectPath);
    
    if (workspaces.length === 0) {
      console.log(chalk.gray('No workspaces found'));
      return;
    }
    
    console.log(`Found ${chalk.cyan(workspaces.length)} workspace(s):`);
    console.log();
    
    for (const username of workspaces) {
      const workspacePath = await workspaceManager.getWorkspacePath(projectPath, username);
      console.log(`  ${chalk.cyan('•')} ${username}`);
      console.log(`    ${chalk.gray(workspacePath)}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

module.exports = {
  initWorkspace,
  syncWorkspace,
  listWorkspaces
};
