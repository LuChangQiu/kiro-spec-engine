/**
 * Status Command
 * 
 * Displays project status including specs, tasks, and team activity
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const TaskClaimer = require('../task/task-claimer');
const WorkspaceManager = require('../workspace/workspace-manager');
const DiagnosticEngine = require('../governance/diagnostic-engine');
const ConfigManager = require('../governance/config-manager');
const { LockManager } = require('../lock');

/**
 * Executes the status command
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.verbose - Show detailed information
 * @param {boolean} options.team - Show team activity
 * @returns {Promise<void>}
 */
async function statusCommand(options = {}) {
  const { verbose = false, team = false } = options;
  const projectPath = process.cwd();
  
  console.log(chalk.red('🔥') + ' SCE Project Status');
  console.log();
  
  try {
    // 1. Check if .kiro/ exists
    const kiroPath = path.join(projectPath, '.kiro');
    const kiroExists = await fs.pathExists(kiroPath);
    
    if (!kiroExists) {
      console.log(chalk.yellow('⚠️  No .kiro/ directory found'));
      console.log();
      console.log('This project has not been adopted yet.');
      console.log('Run ' + chalk.cyan('sce adopt') + ' to get started.');
      return;
    }
    
    // 2. Check multi-user mode
    const workspaceManager = new WorkspaceManager();
    const isMultiUser = await workspaceManager.isMultiUserMode(projectPath);
    
    console.log(chalk.blue('📊 Project Information'));
    console.log(`  Mode: ${isMultiUser ? chalk.cyan('Multi-User') : chalk.gray('Single-User')}`);
    
    if (isMultiUser) {
      const workspaces = await workspaceManager.listWorkspaces(projectPath);
      console.log(`  Active Users: ${chalk.cyan(workspaces.length)}`);
      if (verbose) {
        workspaces.forEach(username => {
          console.log(`    • ${username}`);
        });
      }
    }
    
    console.log();
    
    // 3. Document compliance status
    await displayDocumentCompliance(projectPath);
    
    // 4. List specs
    const specsPath = path.join(projectPath, '.kiro/specs');
    const specsExist = await fs.pathExists(specsPath);
    
    if (!specsExist) {
      console.log(chalk.yellow('📁 No specs found'));
      console.log();
      console.log('Create your first spec: ' + chalk.cyan('sce create-spec my-feature'));
      return;
    }
    
    const entries = await fs.readdir(specsPath, { withFileTypes: true });
    const specDirs = entries.filter(entry => 
      entry.isDirectory() && !entry.name.startsWith('.')
    );
    
    if (specDirs.length === 0) {
      console.log(chalk.yellow('📁 No specs found'));
      console.log();
      console.log('Create your first spec: ' + chalk.cyan('sce create-spec my-feature'));
      return;
    }
    
    console.log(chalk.blue(`📁 Specs (${specDirs.length})`));
    console.log();
    
    // 5. Analyze each spec
    const taskClaimer = new TaskClaimer();
    const lockManager = new LockManager(projectPath);
    const allClaimedTasks = [];
    
    for (const specDir of specDirs) {
      const specName = specDir.name;
      const specPath = path.join(specsPath, specName);
      
      // Check lock status
      const lockStatus = await lockManager.getLockStatus(specName);
      let lockIndicator = '';
      if (lockStatus.locked) {
        if (lockStatus.isOwnedByMe) {
          lockIndicator = chalk.green(' 🔒 (you)');
        } else if (lockStatus.isStale) {
          lockIndicator = chalk.red(' 🔒 [STALE]');
        } else {
          lockIndicator = chalk.yellow(` 🔒 (${lockStatus.lock.owner})`);
        }
      }
      
      // Check for tasks.md
      const tasksPath = path.join(specPath, 'tasks.md');
      const tasksExist = await fs.pathExists(tasksPath);
      
      if (!tasksExist) {
        console.log(chalk.gray(`  ${specName}${lockIndicator}`));
        console.log(chalk.gray('    No tasks.md found'));
        console.log();
        continue;
      }
      
      // Parse tasks
      const tasks = await taskClaimer.parseTasks(tasksPath, { preferStatusMarkers: true });
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
      const claimedTasks = tasks.filter(t => t.claimedBy);
      
      // Calculate completion percentage
      const completionPercent = totalTasks > 0 
        ? Math.round((completedTasks / totalTasks) * 100) 
        : 0;
      
      // Display spec info
      console.log(chalk.cyan(`  ${specName}${lockIndicator}`));
      console.log(`    Tasks: ${chalk.green(completedTasks)}/${totalTasks} completed (${completionPercent}%)`);
      
      if (lockStatus.locked && verbose) {
        console.log(`    Lock: ${lockStatus.lock.owner} (${lockStatus.duration})`);
        if (lockStatus.lock.reason) {
          console.log(`    Reason: ${lockStatus.lock.reason}`);
        }
      }
      
      if (inProgressTasks > 0) {
        console.log(`    In Progress: ${chalk.yellow(inProgressTasks)}`);
      }
      
      if (claimedTasks.length > 0) {
        console.log(`    Claimed: ${chalk.blue(claimedTasks.length)}`);
        
        if (verbose || team) {
          claimedTasks.forEach(task => {
            const staleMarker = task.isStale ? chalk.red(' [STALE]') : '';
            console.log(`      • ${task.taskId} ${task.title}`);
            console.log(`        ${chalk.gray(`@${task.claimedBy}, ${new Date(task.claimedAt).toLocaleDateString()}`)}${staleMarker}`);
          });
        }
        
        // Collect for team view
        claimedTasks.forEach(task => {
          allClaimedTasks.push({
            ...task,
            specName
          });
        });
      }
      
      console.log();
    }
    
    // 6. Team activity view
    if (team && allClaimedTasks.length > 0) {
      console.log(chalk.blue('👥 Team Activity'));
      console.log();
      
      // Group by user
      const tasksByUser = {};
      allClaimedTasks.forEach(task => {
        if (!tasksByUser[task.claimedBy]) {
          tasksByUser[task.claimedBy] = [];
        }
        tasksByUser[task.claimedBy].push(task);
      });
      
      // Display by user
      Object.keys(tasksByUser).sort().forEach(username => {
        const userTasks = tasksByUser[username];
        const staleTasks = userTasks.filter(t => t.isStale);
        
        console.log(chalk.cyan(`  ${username}`));
        console.log(`    Active Tasks: ${userTasks.length}`);
        
        if (staleTasks.length > 0) {
          console.log(`    ${chalk.red(`Stale Claims: ${staleTasks.length}`)}`);
        }
        
        if (verbose) {
          userTasks.forEach(task => {
            const staleMarker = task.isStale ? chalk.red(' [STALE]') : '';
            const statusColor = task.status === 'completed' ? chalk.green : 
                               task.status === 'in-progress' ? chalk.yellow : 
                               chalk.gray;
            console.log(`      • [${task.specName}] ${task.taskId} ${task.title}`);
            console.log(`        ${statusColor(task.status)} • ${chalk.gray(new Date(task.claimedAt).toLocaleDateString())}${staleMarker}`);
          });
        }
        
        console.log();
      });
    }
    
    // 7. Summary
    if (allClaimedTasks.length > 0) {
      const staleClaims = allClaimedTasks.filter(t => t.isStale);
      
      if (staleClaims.length > 0) {
        console.log(chalk.yellow('⚠️  Warning'));
        console.log(`  ${staleClaims.length} task(s) have stale claims (>7 days old)`);
        console.log();
        
        if (!verbose && !team) {
          console.log(chalk.gray('  Run with --team or --verbose to see details'));
          console.log();
        }
      }
    }
    
    // 8. Next steps
    console.log(chalk.blue('💡 Commands'));
    console.log('  View team activity: ' + chalk.cyan('sce status --team'));
    console.log('  Detailed view: ' + chalk.cyan('sce status --verbose'));
    console.log('  Lock a spec: ' + chalk.cyan('sce lock acquire <spec-name>'));
    console.log('  View locks: ' + chalk.cyan('sce lock status'));
    
    if (isMultiUser) {
      console.log('  Claim a task: ' + chalk.cyan('sce task claim <spec-name> <task-id>'));
      console.log('  Sync workspace: ' + chalk.cyan('sce workspace sync'));
    }
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    console.log();
    console.log(chalk.gray('If you need help, please report this issue:'));
    console.log(chalk.cyan('https://github.com/heguangyong/scene-capability-engine/issues'));
    process.exit(1);
  }
}

/**
 * Display document compliance status
 * 
 * @param {string} projectPath - Project root path
 * @returns {Promise<void>}
 */
async function displayDocumentCompliance(projectPath) {
  try {
    // Load configuration
    const configManager = new ConfigManager(projectPath);
    await configManager.load();
    
    // Run diagnostic scan
    const diagnosticEngine = new DiagnosticEngine(projectPath, configManager.config);
    const report = await diagnosticEngine.scan();
    
    // Display compliance status
    console.log(chalk.blue('📄 Document Compliance'));
    
    if (report.compliant) {
      console.log(`  Status: ${chalk.green('✅ Compliant')}`);
      console.log(`  ${chalk.gray('All documents follow lifecycle management rules')}`);
    } else {
      const errorCount = report.violations.filter(v => v.severity === 'error').length;
      const warningCount = report.violations.filter(v => v.severity === 'warning').length;
      
      console.log(`  Status: ${chalk.red('❌ Non-Compliant')}`);
      console.log(`  Violations: ${chalk.red(errorCount)} error(s), ${chalk.yellow(warningCount)} warning(s)`);
      
      // Show violation breakdown by type
      const byType = {};
      report.violations.forEach(v => {
        byType[v.type] = (byType[v.type] || 0) + 1;
      });
      
      const typeNames = {
        'root_violation': 'Root directory',
        'spec_violation': 'Spec structure',
        'missing_file': 'Missing files',
        'misplaced_artifact': 'Misplaced artifacts',
        'temporary_document': 'Temporary documents'
      };
      
      Object.entries(byType).forEach(([type, count]) => {
        const name = typeNames[type] || type;
        console.log(`    • ${name}: ${count}`);
      });
      
      console.log();
      console.log(chalk.cyan('  Quick Fix Commands:'));
      console.log(`    ${chalk.gray('•')} Run diagnostics: ${chalk.cyan('sce doctor --docs')}`);
      console.log(`    ${chalk.gray('•')} Clean temporary files: ${chalk.cyan('sce cleanup')}`);
      console.log(`    ${chalk.gray('•')} Validate structure: ${chalk.cyan('sce validate --all')}`);
      console.log(`    ${chalk.gray('•')} Archive artifacts: ${chalk.cyan('sce docs archive --spec <name>')}`);
    }
    
    console.log();
  } catch (error) {
    // Silently skip if governance components not available
    // This allows status to work even if governance is not fully set up
    if (error.code !== 'MODULE_NOT_FOUND') {
      console.log(chalk.gray('  (Document compliance check skipped)'));
      console.log();
    }
  }
}

module.exports = statusCommand;
