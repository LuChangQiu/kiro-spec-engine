/**
 * Context Command
 * 
 * Exports spec context for cross-tool usage
 */

const chalk = require('chalk');
const ContextExporter = require('../context/context-exporter');

/**
 * Export spec context
 * 
 * @param {string} specName - Spec name
 * @param {Object} options - Command options
 * @param {boolean} options.requirements - Include requirements (default: true)
 * @param {boolean} options.design - Include design (default: true)
 * @param {boolean} options.tasks - Include tasks (default: true)
 * @param {boolean} options.steering - Include steering rules
 * @param {string} options.steeringFiles - Comma-separated list of steering files
 * @returns {Promise<void>}
 */
async function exportContext(specName, options = {}) {
  const projectPath = process.cwd();
  const exporter = new ContextExporter();
  
  console.log(chalk.red('🔥') + ' Exporting Context');
  console.log();
  
  try {
    console.log(`Spec: ${chalk.cyan(specName)}`);
    console.log();
    
    // Parse options
    const exportOptions = {
      includeRequirements: options.requirements !== false,
      includeDesign: options.design !== false,
      includeTasks: options.tasks !== false,
      includeSteering: options.steering === true,
      steeringFiles: options.steeringFiles 
        ? options.steeringFiles.split(',').map(f => f.trim())
        : []
    };
    
    console.log('Export options:');
    console.log(`  Requirements: ${exportOptions.includeRequirements ? chalk.green('✓') : chalk.gray('✗')}`);
    console.log(`  Design: ${exportOptions.includeDesign ? chalk.green('✓') : chalk.gray('✗')}`);
    console.log(`  Tasks: ${exportOptions.includeTasks ? chalk.green('✓') : chalk.gray('✗')}`);
    console.log(`  Steering: ${exportOptions.includeSteering ? chalk.green('✓') : chalk.gray('✗')}`);
    
    if (exportOptions.includeSteering && exportOptions.steeringFiles.length > 0) {
      console.log(`  Steering files: ${chalk.gray(exportOptions.steeringFiles.join(', '))}`);
    }
    
    console.log();
    console.log('Exporting...');
    console.log();
    
    const result = await exporter.exportContext(
      projectPath,
      specName,
      exportOptions
    );
    
    if (result.success) {
      console.log(chalk.green('✅ Context exported successfully'));
      console.log();
      console.log(`Export file: ${chalk.cyan(result.exportPath)}`);
      console.log(`Sections: ${chalk.gray(result.sections)}`);
      console.log(`Size: ${chalk.gray(formatBytes(result.size))}`);
      console.log();
      console.log('Usage:');
      console.log('  1. Copy the exported file to your AI coding assistant');
      console.log('  2. Reference specific sections when working on tasks');
      console.log('  3. Update task status in the original tasks.md after completion');
    } else {
      console.log(chalk.red('❌ Export failed'));
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
  exportContext
};
