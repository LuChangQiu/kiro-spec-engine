/**
 * Task Command Group
 * 
 * Manages task claiming and status updates
 */

const chalk = require('chalk');
const TaskClaimer = require('../task/task-claimer');
const WorkspaceManager = require('../workspace/workspace-manager');

/**
 * Claim a task
 * 
 * @param {string} specName - Spec name
 * @param {string} taskId - Task ID
 * @param {Object} options - Command options
 * @param {string} options.user - Override username
 * @param {boolean} options.force - Force claim even if already claimed
 * @returns {Promise<void>}
 */
async function claimTask(specName, taskId, options = {}) {
  const projectPath = process.cwd();
  const taskClaimer = new TaskClaimer();
  const workspaceManager = new WorkspaceManager();
  
  console.log(chalk.red('🔥') + ' Claiming Task');
  console.log();
  
  try {
    const username = options.user || await workspaceManager.detectUsername();
    
    if (!username) {
      console.log(chalk.red('❌ Could not detect username'));
      console.log();
      console.log('Please configure git or use --user flag');
      return;
    }
    
    console.log(`Spec: ${chalk.cyan(specName)}`);
    console.log(`Task: ${chalk.cyan(taskId)}`);
    console.log(`User: ${chalk.cyan(username)}`);
    console.log();
    
    const result = await taskClaimer.claimTask(
      projectPath,
      specName,
      taskId,
      username,
      options.force
    );
    
    if (result.success) {
      console.log(chalk.green('✅ Task claimed successfully'));
      console.log();
      console.log(`Task: ${result.taskTitle}`);
      console.log(`Claimed by: ${chalk.cyan(username)}`);
      console.log(`Claimed at: ${chalk.gray(result.claimedAt)}`);
      
      if (result.previousClaim) {
        console.log();
        console.log(chalk.yellow('⚠️  Previous claim overridden:'));
        console.log(`  User: ${result.previousClaim.username}`);
        console.log(`  Time: ${result.previousClaim.timestamp}`);
      }
    } else {
      console.log(chalk.red('❌ Failed to claim task'));
      console.log();
      console.log(`Error: ${result.error}`);
      
      if (result.existingClaim) {
        console.log();
        console.log('Task is already claimed by:');
        console.log(`  User: ${chalk.cyan(result.existingClaim.username)}`);
        console.log(`  Time: ${chalk.gray(result.existingClaim.timestamp)}`);
        console.log();
        console.log('Use ' + chalk.cyan('--force') + ' to override the claim');
      }
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

/**
 * Unclaim a task
 * 
 * @param {string} specName - Spec name
 * @param {string} taskId - Task ID
 * @param {Object} options - Command options
 * @param {string} options.user - Override username
 * @returns {Promise<void>}
 */
async function unclaimTask(specName, taskId, options = {}) {
  const projectPath = process.cwd();
  const taskClaimer = new TaskClaimer();
  const workspaceManager = new WorkspaceManager();
  
  console.log(chalk.red('🔥') + ' Unclaiming Task');
  console.log();
  
  try {
    const username = options.user || await workspaceManager.detectUsername();
    
    if (!username) {
      console.log(chalk.red('❌ Could not detect username'));
      return;
    }
    
    console.log(`Spec: ${chalk.cyan(specName)}`);
    console.log(`Task: ${chalk.cyan(taskId)}`);
    console.log(`User: ${chalk.cyan(username)}`);
    console.log();
    
    const result = await taskClaimer.unclaimTask(
      projectPath,
      specName,
      taskId,
      username
    );
    
    if (result.success) {
      console.log(chalk.green('✅ Task unclaimed successfully'));
      console.log();
      console.log(`Task: ${result.taskTitle}`);
    } else {
      console.log(chalk.red('❌ Failed to unclaim task'));
      console.log();
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

/**
 * List claimed tasks
 * 
 * @param {string} specName - Spec name (optional)
 * @param {Object} options - Command options
 * @param {string} options.user - Filter by username
 * @returns {Promise<void>}
 */
async function listClaimedTasks(specName, options = {}) {
  const projectPath = process.cwd();
  const taskClaimer = new TaskClaimer();
  
  console.log(chalk.red('🔥') + ' Claimed Tasks');
  console.log();
  
  try {
    if (specName) {
      // List claimed tasks for specific spec
      const tasks = await taskClaimer.getClaimedTasks(projectPath, specName);
      
      if (tasks.length === 0) {
        console.log(chalk.gray('No claimed tasks found'));
        return;
      }
      
      console.log(`Spec: ${chalk.cyan(specName)}`);
      console.log();
      
      // Group by user
      const byUser = {};
      for (const task of tasks) {
        if (!byUser[task.claimedBy]) {
          byUser[task.claimedBy] = [];
        }
        byUser[task.claimedBy].push(task);
      }
      
      for (const [user, userTasks] of Object.entries(byUser)) {
        if (options.user && user !== options.user) {
          continue;
        }
        
        console.log(chalk.cyan(`${user} (${userTasks.length} task(s))`));
        for (const task of userTasks) {
          const staleMarker = task.isStale ? chalk.yellow(' [STALE]') : '';
          console.log(`  ${chalk.gray('•')} ${task.taskId} ${task.taskTitle}${staleMarker}`);
          console.log(`    ${chalk.gray(task.claimedAt)}`);
        }
        console.log();
      }
    } else {
      console.log(chalk.gray('Please specify a spec name'));
      console.log();
      console.log('Usage: ' + chalk.cyan('sce task list <spec-name>'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

module.exports = {
  claimTask,
  unclaimTask,
  listClaimedTasks
};
