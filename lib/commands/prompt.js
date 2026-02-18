/**
 * Prompt Command
 * 
 * Generates task-specific prompts for AI coding assistants
 */

const chalk = require('chalk');
const PromptGenerator = require('../context/prompt-generator');

/**
 * Generate task prompt
 * 
 * @param {string} specName - Spec name
 * @param {string} taskId - Task ID
 * @param {Object} options - Command options
 * @param {string} options.tool - Target tool (generic, claude-code, cursor, codex, SCE)
 * @param {number} options.maxLength - Maximum context length
 * @returns {Promise<void>}
 */
async function generatePrompt(specName, taskId, options = {}) {
  const projectPath = process.cwd();
  const generator = new PromptGenerator();
  
  console.log(chalk.red('🔥') + ' Generating Task Prompt');
  console.log();
  
  try {
    console.log(`Spec: ${chalk.cyan(specName)}`);
    console.log(`Task: ${chalk.cyan(taskId)}`);
    
    const targetTool = options.tool || 'generic';
    console.log(`Target Tool: ${chalk.cyan(targetTool)}`);
    console.log();
    
    const generateOptions = {
      targetTool,
      maxContextLength: options.maxLength || 10000
    };
    
    console.log('Generating prompt...');
    console.log();
    
    const result = await generator.generatePrompt(
      projectPath,
      specName,
      taskId,
      generateOptions
    );
    
    if (result.success) {
      console.log(chalk.green('✅ Prompt generated successfully'));
      console.log();
      console.log(`Prompt file: ${chalk.cyan(result.promptPath)}`);
      console.log(`Size: ${chalk.gray(formatBytes(result.size))}`);
      console.log();
      console.log('Usage:');
      console.log('  1. Copy the prompt file content');
      console.log('  2. Paste it into your AI coding assistant');
      console.log('  3. Follow the implementation guidelines');
      console.log('  4. Update task status after completion');
      console.log();
      
      // Tool-specific tips
      if (targetTool === 'claude-code') {
        console.log(chalk.blue('💡 Claude Code Tips:'));
        console.log('  • Copy the entire prompt into the chat');
        console.log('  • Reference specific sections as needed');
      } else if (targetTool === 'cursor') {
        console.log(chalk.blue('💡 Cursor Tips:'));
        console.log('  • Paste the prompt into the composer');
        console.log('  • Use Cmd+K to apply changes');
      } else if (targetTool === 'codex') {
        console.log(chalk.blue('💡 GitHub Copilot Tips:'));
        console.log('  • Include the prompt in code comments');
        console.log('  • Let Copilot suggest implementations');
      } else if (targetTool === 'SCE') {
        console.log(chalk.blue('💡 AI IDE Tips:'));
        console.log('  • Steering rules are loaded automatically');
        console.log('  • Use #File to reference specific files');
      }
    } else {
      console.log(chalk.red('❌ Prompt generation failed'));
      console.log();
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }
}

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

module.exports = {
  generatePrompt
};
