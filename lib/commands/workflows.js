/**
 * Workflows Command
 * 
 * Lists and displays manual workflow documentation
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

/**
 * Available workflows
 */
const WORKFLOWS = {
  'task-sync': {
    name: 'Task Sync Workflow',
    description: 'Keep workspace synchronized with task progress',
    timeEstimate: '30-60 seconds',
    file: 'manual-workflows-guide.md',
    section: 'task-sync-workflow'
  },
  'context-export': {
    name: 'Context Export Workflow',
    description: 'Export spec context for sharing',
    timeEstimate: '15-45 seconds',
    file: 'manual-workflows-guide.md',
    section: 'context-export-workflow'
  },
  'prompt-generation': {
    name: 'Prompt Generation Workflow',
    description: 'Generate AI prompts for specific tasks',
    timeEstimate: '20-30 seconds',
    file: 'manual-workflows-guide.md',
    section: 'prompt-generation-workflow'
  },
  'daily': {
    name: 'Daily Workflow Checklist',
    description: 'Complete daily workflow checklist',
    timeEstimate: '2-3 minutes',
    file: 'manual-workflows-guide.md',
    section: 'daily-workflow-checklist'
  },
  'task-completion': {
    name: 'Task Completion Checklist',
    description: 'Checklist for completing a task',
    timeEstimate: 'Varies',
    file: 'manual-workflows-guide.md',
    section: 'task-completion-checklist'
  },
  'spec-creation': {
    name: 'Spec Creation Checklist',
    description: 'Checklist for creating a new spec',
    timeEstimate: '10-15 minutes',
    file: 'manual-workflows-guide.md',
    section: 'spec-creation-checklist'
  }
};

/**
 * List all available workflows
 */
async function listWorkflows() {
  console.log(chalk.blue('📋 Available Workflows'));
  console.log();
  
  Object.entries(WORKFLOWS).forEach(([id, workflow]) => {
    console.log(chalk.cyan(`  ${id}`));
    console.log(`    ${workflow.name}`);
    console.log(chalk.gray(`    ${workflow.description}`));
    console.log(chalk.gray(`    Time: ${workflow.timeEstimate}`));
    console.log();
  });
  
  console.log(chalk.gray('Run'), chalk.cyan('sce workflows show <workflow-id>'), chalk.gray('to view details'));
  console.log(chalk.gray('Run'), chalk.cyan('sce workflows guide'), chalk.gray('to open full guide'));
}

/**
 * Show specific workflow details
 * 
 * @param {string} workflowId - Workflow ID
 */
async function showWorkflow(workflowId) {
  const workflow = WORKFLOWS[workflowId];
  
  if (!workflow) {
    console.log(chalk.red('❌ Unknown workflow:'), workflowId);
    console.log();
    console.log(chalk.gray('Available workflows:'));
    Object.keys(WORKFLOWS).forEach(id => {
      console.log(chalk.gray(`  - ${id}`));
    });
    return;
  }
  
  console.log(chalk.blue('📋'), chalk.bold(workflow.name));
  console.log();
  console.log(chalk.gray('Description:'), workflow.description);
  console.log(chalk.gray('Time Estimate:'), workflow.timeEstimate);
  console.log();
  
  // Try to read and display the workflow section
  try {
    const docsPath = path.join(__dirname, '../../docs', workflow.file);
    
    if (await fs.pathExists(docsPath)) {
      console.log(chalk.blue('📖 Full documentation:'));
      console.log(chalk.cyan(`  docs/${workflow.file}#${workflow.section}`));
      console.log();
      console.log(chalk.gray('Tip: Open the file in your editor for complete instructions'));
    } else {
      console.log(chalk.yellow('⚠️  Documentation file not found'));
      console.log(chalk.gray(`  Expected: docs/${workflow.file}`));
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not read documentation'));
  }
}

/**
 * Open full workflows guide
 */
async function openGuide() {
  const guidePath = path.join(__dirname, '../../docs/manual-workflows-guide.md');
  
  try {
    if (await fs.pathExists(guidePath)) {
      console.log(chalk.blue('📖 Manual Workflows Guide'));
      console.log();
      console.log(chalk.cyan('  docs/manual-workflows-guide.md'));
      console.log();
      console.log(chalk.gray('Open this file in your editor for complete workflow documentation'));
      console.log();
      console.log(chalk.blue('Contents:'));
      console.log(chalk.gray('  - Task Sync Workflow'));
      console.log(chalk.gray('  - Context Export Workflow'));
      console.log(chalk.gray('  - Prompt Generation Workflow'));
      console.log(chalk.gray('  - Workflow Checklists'));
      console.log(chalk.gray('  - Time Estimates'));
      console.log(chalk.gray('  - Troubleshooting'));
    } else {
      console.log(chalk.red('❌ Guide not found:'), 'docs/manual-workflows-guide.md');
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

/**
 * Track workflow completion
 * 
 * @param {string} workflowId - Workflow ID
 */
async function trackCompletion(workflowId) {
  const workflow = WORKFLOWS[workflowId];
  
  if (!workflow) {
    console.log(chalk.red('❌ Unknown workflow:'), workflowId);
    return;
  }
  
  console.log(chalk.green('✅'), chalk.bold(`${workflow.name} completed!`));
  console.log();
  console.log(chalk.gray('Time estimate:'), workflow.timeEstimate);
  console.log();
  console.log(chalk.blue('💡 Next steps:'));
  
  // Suggest next workflow based on current one
  const suggestions = {
    'task-sync': ['context-export', 'prompt-generation'],
    'context-export': ['prompt-generation', 'task-completion'],
    'prompt-generation': ['task-completion'],
    'daily': ['task-sync', 'context-export'],
    'task-completion': ['task-sync'],
    'spec-creation': ['task-sync', 'prompt-generation']
  };
  
  const nextWorkflows = suggestions[workflowId] || [];
  
  if (nextWorkflows.length > 0) {
    nextWorkflows.forEach(nextId => {
      const next = WORKFLOWS[nextId];
      console.log(chalk.cyan(`  sce workflows show ${nextId}`), chalk.gray(`- ${next.name}`));
    });
  } else {
    console.log(chalk.gray('  Continue with your work!'));
  }
}

/**
 * Main workflows command
 * 
 * @param {string} action - Action to perform (list, show, guide, complete)
 * @param {string} workflowId - Workflow ID (for show/complete actions)
 */
async function workflowsCommand(action = 'list', workflowId = null) {
  try {
    switch (action) {
      case 'list':
        await listWorkflows();
        break;
      
      case 'show':
        if (!workflowId) {
          console.log(chalk.red('❌ Workflow ID required'));
          console.log(chalk.gray('Usage:'), chalk.cyan('sce workflows show <workflow-id>'));
          return;
        }
        await showWorkflow(workflowId);
        break;
      
      case 'guide':
        await openGuide();
        break;
      
      case 'complete':
        if (!workflowId) {
          console.log(chalk.red('❌ Workflow ID required'));
          console.log(chalk.gray('Usage:'), chalk.cyan('sce workflows complete <workflow-id>'));
          return;
        }
        await trackCompletion(workflowId);
        break;
      
      default:
        console.log(chalk.red('❌ Unknown action:'), action);
        console.log();
        console.log(chalk.gray('Available actions:'));
        console.log(chalk.gray('  - list: List all workflows'));
        console.log(chalk.gray('  - show <id>: Show workflow details'));
        console.log(chalk.gray('  - guide: Open full guide'));
        console.log(chalk.gray('  - complete <id>: Mark workflow as complete'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

module.exports = workflowsCommand;
