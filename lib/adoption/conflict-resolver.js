/**
 * Conflict Resolver
 * 
 * Manages interactive conflict resolution prompts and user decisions.
 * Provides three-tier resolution: skip-all, overwrite-all, or review-each.
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const DiffViewer = require('./diff-viewer');

/**
 * ConflictResolver class for interactive conflict resolution
 */
class ConflictResolver {
  constructor() {
    this.diffViewer = new DiffViewer();
  }

  /**
   * Displays conflict summary grouped by category
   * 
   * @param {FileConflict[]} conflicts - Array of conflicts
   * @returns {void}
   */
  displayConflictSummary(conflicts) {
    console.log();
    console.log(chalk.yellow('⚠️  Conflicts Detected'));
    console.log(chalk.yellow('═══════════════════════════════════════════════════════'));
    console.log();
    
    // Categorize conflicts
    const categorized = this.categorizeConflicts(conflicts);
    
    // Display by category
    if (categorized.steering.length > 0) {
      console.log(chalk.blue('Steering Files:'));
      categorized.steering.forEach(c => console.log(`  - ${c.path}`));
      console.log();
    }
    
    if (categorized.documentation.length > 0) {
      console.log(chalk.blue('Documentation:'));
      categorized.documentation.forEach(c => console.log(`  - ${c.path}`));
      console.log();
    }
    
    if (categorized.tools.length > 0) {
      console.log(chalk.blue('Tools:'));
      categorized.tools.forEach(c => console.log(`  - ${c.path}`));
      console.log();
    }
    
    if (categorized.other.length > 0) {
      console.log(chalk.blue('Other:'));
      categorized.other.forEach(c => console.log(`  - ${c.path}`));
      console.log();
    }
    
    console.log(chalk.yellow(`Total: ${conflicts.length} conflict(s)`));
    console.log(chalk.yellow('═══════════════════════════════════════════════════════'));
    console.log();
  }

  /**
   * Categorizes conflicts by type
   * 
   * @param {FileConflict[]} conflicts - Array of conflicts
   * @returns {CategorizedConflicts}
   */
  categorizeConflicts(conflicts) {
    return {
      steering: conflicts.filter(c => c.path.startsWith('steering/')),
      documentation: conflicts.filter(c => 
        c.path.endsWith('.md') && !c.path.startsWith('steering/')
      ),
      tools: conflicts.filter(c => c.path.startsWith('tools/')),
      other: conflicts.filter(c => 
        !c.path.startsWith('steering/') && 
        !c.path.startsWith('tools/') && 
        !c.path.endsWith('.md')
      )
    };
  }

  /**
   * Prompts user for overall conflict resolution strategy
   * 
   * @param {FileConflict[]} conflicts - Array of detected conflicts
   * @returns {Promise<ConflictStrategy>} - 'skip-all' | 'overwrite-all' | 'review-each'
   */
  async promptStrategy(conflicts) {
    const { strategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: 'How would you like to handle these conflicts?',
        choices: [
          {
            name: 'Skip conflicting files (keep existing files)',
            value: 'skip-all'
          },
          {
            name: 'Overwrite conflicting files (backup will be created)',
            value: 'overwrite-all'
          },
          {
            name: 'Review conflicts one by one',
            value: 'review-each'
          }
        ],
        default: 'skip-all'
      }
    ]);
    
    return strategy;
  }

  /**
   * Prompts user for resolution of a single file conflict
   * 
   * @param {FileConflict} conflict - The conflict to resolve
   * @param {number} currentIndex - Current conflict number (for display)
   * @param {number} totalConflicts - Total number of conflicts
   * @param {string} projectPath - Project root path
   * @returns {Promise<FileResolution>} - 'keep' | 'overwrite'
   */
  async promptFileResolution(conflict, currentIndex, totalConflicts, projectPath) {
    console.log();
    console.log(chalk.blue('─────────────────────────────────────────────────────'));
    console.log(chalk.blue(`Conflict ${currentIndex} of ${totalConflicts}`));
    console.log(chalk.blue('─────────────────────────────────────────────────────'));
    console.log();
    console.log(chalk.cyan('File:'), conflict.path);
    console.log();
    
    let resolution = null;
    
    while (resolution === null) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            {
              name: 'Keep existing file',
              value: 'keep'
            },
            {
              name: 'Use template file (backup will be created)',
              value: 'overwrite'
            },
            {
              name: 'View diff',
              value: 'view-diff'
            }
          ],
          default: 'keep'
        }
      ]);
      
      if (action === 'view-diff') {
        // Show diff
        const existingPath = path.join(projectPath, '.kiro', conflict.path);
        const templatePath = conflict.templatePath || path.join(projectPath, 'template', '.kiro', conflict.path);
        
        await this.diffViewer.showDiff(existingPath, templatePath);
        
        // Re-prompt with only keep/overwrite options
        const { finalAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'finalAction',
            message: 'After viewing the diff, what would you like to do?',
            choices: [
              {
                name: 'Keep existing file',
                value: 'keep'
              },
              {
                name: 'Use template file (backup will be created)',
                value: 'overwrite'
              }
            ],
            default: 'keep'
          }
        ]);
        
        resolution = finalAction;
      } else {
        resolution = action;
      }
    }
    
    return resolution;
  }

  /**
   * Processes all conflicts based on strategy and returns resolution map
   * 
   * @param {FileConflict[]} conflicts - Array of conflicts
   * @param {ConflictStrategy} strategy - Overall strategy
   * @param {string} projectPath - Project root path
   * @returns {Promise<ResolutionMap>} - Map of file paths to resolutions
   */
  async resolveConflicts(conflicts, strategy, projectPath) {
    const resolutionMap = {};
    
    if (strategy === 'skip-all') {
      // Mark all as 'keep'
      conflicts.forEach(conflict => {
        resolutionMap[conflict.path] = 'keep';
      });
    } else if (strategy === 'overwrite-all') {
      // Mark all as 'overwrite'
      conflicts.forEach(conflict => {
        resolutionMap[conflict.path] = 'overwrite';
      });
    } else if (strategy === 'review-each') {
      // Prompt for each conflict
      for (let i = 0; i < conflicts.length; i++) {
        const conflict = conflicts[i];
        const resolution = await this.promptFileResolution(
          conflict,
          i + 1,
          conflicts.length,
          projectPath
        );
        resolutionMap[conflict.path] = resolution;
      }
    }
    
    return resolutionMap;
  }
}

module.exports = ConflictResolver;
