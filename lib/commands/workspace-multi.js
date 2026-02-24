/**
 * Multi-Workspace Management Commands
 * 
 * Implements CLI commands for managing multiple sce project workspaces.
 * This is part of Spec 16-00: Multi-Workspace Management.
 * 
 * Uses WorkspaceStateManager for atomic operations and single source of truth.
 */

const chalk = require('chalk');
const path = require('path');
const WorkspaceStateManager = require('../workspace/multi/workspace-state-manager');
const fs = require('fs-extra');

/**
 * Create a new workspace
 * 
 * Command: sce workspace create <name> [path]
 * 
 * @param {string} name - Workspace name
 * @param {Object} options - Command options
 * @param {string} options.path - Optional workspace path (defaults to current directory)
 * @returns {Promise<void>}
 */
async function createWorkspace(name, options = {}) {
  const stateManager = new WorkspaceStateManager();
  
  try {
    // Use provided path or current directory
    const workspacePath = options.path || process.cwd();
    
    console.log(chalk.red('🔥') + ' Creating Workspace');
    console.log();
    console.log(`Name: ${chalk.cyan(name)}`);
    console.log(`Path: ${chalk.gray(workspacePath)}`);
    console.log();
    
    // Create workspace (atomic operation)
    const workspace = await stateManager.createWorkspace(name, workspacePath);
    
    console.log(chalk.green('✅ Workspace created successfully'));
    console.log();
    console.log('Workspace Details:');
    console.log(`  Name: ${chalk.cyan(workspace.name)}`);
    console.log(`  Path: ${chalk.gray(workspace.path)}`);
    console.log(`  Created: ${chalk.gray(workspace.createdAt.toLocaleString())}`);
    console.log();
    console.log('Next steps:');
    console.log(`  ${chalk.cyan('sce workspace switch ' + name)} - Set as active workspace`);
    console.log(`  ${chalk.cyan('sce workspace list')} - View all workspaces`);
    
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * List all registered workspaces
 * 
 * Command: sce workspace list
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function listWorkspaces(options = {}) {
  const stateManager = new WorkspaceStateManager();
  
  try {
    console.log(chalk.red('🔥') + ' Registered Workspaces');
    console.log();
    
    const workspaces = await stateManager.listWorkspaces();
    const activeWorkspace = await stateManager.getActiveWorkspace();
    const activeWorkspaceName = activeWorkspace ? activeWorkspace.name : null;
    
    if (workspaces.length === 0) {
      console.log(chalk.gray('No workspaces registered'));
      console.log();
      console.log('Create your first workspace:');
      console.log(`  ${chalk.cyan('sce workspace create <name>')}`);
      return;
    }
    
    // Sort by last accessed (most recent first)
    workspaces.sort((a, b) => b.lastAccessed - a.lastAccessed);
    
    console.log(`Found ${chalk.cyan(workspaces.length)} workspace(s):\n`);
    
    for (const workspace of workspaces) {
      const isActive = workspace.name === activeWorkspaceName;
      const indicator = isActive ? chalk.green('● ') : chalk.gray('○ ');
      const nameDisplay = isActive ? chalk.green.bold(workspace.name) : chalk.cyan(workspace.name);
      
      console.log(`${indicator}${nameDisplay}`);
      console.log(`  Path: ${chalk.gray(workspace.path)}`);
      console.log(`  Last accessed: ${chalk.gray(workspace.lastAccessed.toLocaleString())}`);
      
      if (isActive) {
        console.log(`  ${chalk.green('(Active)')}`);
      }
      
      console.log();
    }
    
    console.log('Commands:');
    console.log(`  ${chalk.cyan('sce workspace switch <name>')} - Switch to a workspace`);
    console.log(`  ${chalk.cyan('sce workspace info <name>')} - View workspace details`);
    
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Switch to a different workspace
 * 
 * Command: sce workspace switch <name>
 * 
 * @param {string} name - Workspace name
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function switchWorkspace(name, options = {}) {
  const stateManager = new WorkspaceStateManager();
  
  try {
    console.log(chalk.red('🔥') + ' Switching Workspace');
    console.log();
    
    // Switch workspace (atomic operation - updates active + timestamp)
    await stateManager.switchWorkspace(name);
    
    const workspace = await stateManager.getWorkspace(name);
    
    console.log(chalk.green('✅ Switched to workspace:'), chalk.cyan(name));
    console.log();
    console.log('Workspace Details:');
    console.log(`  Path: ${chalk.gray(workspace.path)}`);
    console.log(`  Last accessed: ${chalk.gray(workspace.lastAccessed.toLocaleString())}`);
    console.log();
    console.log('All sce commands will now use this workspace by default.');
    
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Remove a workspace from the registry
 * 
 * Command: sce workspace remove <name>
 * 
 * @param {string} name - Workspace name
 * @param {Object} options - Command options
 * @param {boolean} options.force - Skip confirmation prompt
 * @returns {Promise<void>}
 */
async function removeWorkspace(name, options = {}) {
  const stateManager = new WorkspaceStateManager();
  
  try {
    console.log(chalk.red('🔥') + ' Removing Workspace');
    console.log();
    
    // Check if workspace exists
    const workspace = await stateManager.getWorkspace(name);
    if (!workspace) {
      const available = await stateManager.listWorkspaces();
      const availableNames = available.map(ws => ws.name);
      
      console.log(chalk.red('❌ Workspace not found:'), name);
      console.log();
      if (availableNames.length > 0) {
        console.log('Available workspaces:', availableNames.join(', '));
      } else {
        console.log('No workspaces registered.');
      }
      process.exit(1);
    }
    
    console.log(`Workspace: ${chalk.cyan(name)}`);
    console.log(`Path: ${chalk.gray(workspace.path)}`);
    console.log();
    
    // Require confirmation unless --force
    if (!options.force) {
      console.log(chalk.yellow('⚠️  Warning: This will remove the workspace from the registry.'));
      console.log(chalk.yellow('   Files in the workspace directory will NOT be deleted.'));
      console.log();
      console.log('To confirm, run:');
      console.log(`  ${chalk.cyan('sce workspace remove ' + name + ' --force')}`);
      return;
    }
    
    // Check if it's the active workspace
    const activeWorkspace = await stateManager.getActiveWorkspace();
    const isActive = activeWorkspace && name === activeWorkspace.name;
    
    // Remove workspace (atomic operation - removes + clears active if needed)
    await stateManager.removeWorkspace(name);
    
    console.log(chalk.green('✅ Workspace removed:'), chalk.cyan(name));
    console.log();
    console.log('The workspace directory and its files have been preserved.');
    
    if (isActive) {
      console.log();
      console.log(chalk.yellow('Note: This was your active workspace.'));
      console.log('Set a new active workspace:');
      console.log(`  ${chalk.cyan('sce workspace switch <name>')}`);
    }
    
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

/**
 * Display detailed information about a workspace
 * 
 * Command: sce workspace info [name]
 * 
 * @param {string|null} name - Workspace name (optional, defaults to active workspace)
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function infoWorkspace(name = null, options = {}) {
  const stateManager = new WorkspaceStateManager();
  
  try {
    console.log(chalk.red('🔥') + ' Workspace Information');
    console.log();
    
    let workspace;
    
    // If no name provided, use active workspace
    if (!name) {
      workspace = await stateManager.getActiveWorkspace();
      
      if (!workspace) {
        console.log(chalk.yellow('⚠️  No active workspace set'));
        console.log();
        console.log('Set an active workspace:');
        console.log(`  ${chalk.cyan('sce workspace switch <name>')}`);
        console.log();
        console.log('Or specify a workspace name:');
        console.log(`  ${chalk.cyan('sce workspace info <name>')}`);
        return;
      }
    } else {
      workspace = await stateManager.getWorkspace(name);
      
      if (!workspace) {
        const available = await stateManager.listWorkspaces();
        const availableNames = available.map(ws => ws.name);
        
        console.log(chalk.red('❌ Workspace not found:'), name);
        console.log();
        if (availableNames.length > 0) {
          console.log('Available workspaces:', availableNames.join(', '));
        }
        process.exit(1);
      }
    }
    
    // Check if it's the active workspace
    const activeWorkspace = await stateManager.getActiveWorkspace();
    const isActive = activeWorkspace && workspace.name === activeWorkspace.name;
    
    // Count Specs in workspace
    let specCount = 0;
    try {
      const specsPath = path.join(workspace.getPlatformPath(), '.sce', 'specs');
      const exists = await fs.pathExists(specsPath);
      
      if (exists) {
        const entries = await fs.readdir(specsPath);
        // Count directories (each Spec is a directory)
        for (const entry of entries) {
          const entryPath = path.join(specsPath, entry);
          const stats = await fs.stat(entryPath);
          if (stats.isDirectory()) {
            specCount++;
          }
        }
      }
    } catch (error) {
      // Ignore errors counting Specs
    }
    
    // Display information
    console.log(`Name: ${chalk.cyan.bold(workspace.name)}`);
    if (isActive) {
      console.log(`Status: ${chalk.green('Active')}`);
    }
    console.log();
    console.log('Details:');
    console.log(`  Path: ${chalk.gray(workspace.path)}`);
    console.log(`  Created: ${chalk.gray(workspace.createdAt.toLocaleString())}`);
    console.log(`  Last accessed: ${chalk.gray(workspace.lastAccessed.toLocaleString())}`);
    console.log(`  Specs: ${chalk.cyan(specCount)}`);
    console.log();
    
    if (!isActive) {
      console.log('Switch to this workspace:');
      console.log(`  ${chalk.cyan('sce workspace switch ' + workspace.name)}`);
    }
    
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

module.exports = {
  createWorkspace,
  listWorkspaces,
  switchWorkspace,
  removeWorkspace,
  infoWorkspace
};
