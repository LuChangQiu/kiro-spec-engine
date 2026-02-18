/**
 * Reporter
 * 
 * Formats and displays governance operation results
 */

const chalk = require('chalk');
const path = require('path');

class Reporter {
  constructor() {
    this.chalk = chalk;
  }
  
  /**
   * Display diagnostic report
   * 
   * @param {DiagnosticReport} report - Diagnostic report
   */
  displayDiagnostic(report) {
    console.log(this.chalk.bold.cyan('\n📋 Document Governance Diagnostic\n'));
    
    if (report.compliant) {
      console.log(this.chalk.green('✅ Project is compliant'));
      console.log('All documents follow the lifecycle management rules.\n');
      return;
    }
    
    console.log(this.chalk.yellow(`⚠️  Found ${report.violations.length} violation(s)\n`));
    
    // Group violations by type
    const byType = this.groupBy(report.violations, 'type');
    
    for (const [type, violations] of Object.entries(byType)) {
      console.log(this.chalk.bold.blue(`${this.formatType(type)} (${violations.length})`));
      
      for (const violation of violations) {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${this.chalk.gray(violation.path)}`);
        console.log(`     ${violation.description}`);
        console.log(`     ${this.chalk.cyan('→ ' + violation.recommendation)}`);
      }
      
      console.log();
    }
    
    // Display recommendations
    if (report.recommendations && report.recommendations.length > 0) {
      console.log(this.chalk.bold.blue('💡 Recommended Actions'));
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
      console.log();
    }
    
    // Display summary
    if (report.summary) {
      console.log(this.chalk.bold('Summary:'));
      console.log(`  Total violations: ${report.summary.totalViolations}`);
      if (report.summary.bySeverity) {
        console.log(`  Errors: ${report.summary.bySeverity.error || 0}`);
        console.log(`  Warnings: ${report.summary.bySeverity.warning || 0}`);
        console.log(`  Info: ${report.summary.bySeverity.info || 0}`);
      }
      console.log();
    }
  }
  
  /**
   * Display cleanup report
   * 
   * @param {CleanupReport} report - Cleanup report
   * @param {boolean} dryRun - Whether this was a dry run
   */
  displayCleanup(report, dryRun = false) {
    const title = dryRun ? 'Cleanup Preview (Dry Run)' : 'Cleanup Complete';
    console.log(this.chalk.bold.cyan(`\n🧹 ${title}\n`));
    
    if (report.deletedFiles.length === 0) {
      console.log(this.chalk.green('✅ No files to clean\n'));
      return;
    }
    
    const verb = dryRun ? 'Would delete' : 'Deleted';
    console.log(this.chalk.yellow(`${verb} ${report.deletedFiles.length} file(s):\n`));
    
    report.deletedFiles.forEach(file => {
      console.log(`  🗑️  ${this.chalk.gray(file)}`);
    });
    
    if (report.errors && report.errors.length > 0) {
      console.log();
      console.log(this.chalk.red(`❌ ${report.errors.length} error(s):`));
      report.errors.forEach(err => {
        console.log(`  • ${this.chalk.gray(err.path)}: ${err.error}`);
      });
    }
    
    console.log();
    
    if (dryRun) {
      console.log(this.chalk.cyan('💡 Run without --dry-run to actually delete these files\n'));
    } else if (report.success) {
      console.log(this.chalk.green('✅ Cleanup completed successfully\n'));
    } else {
      console.log(this.chalk.yellow('⚠️  Cleanup completed with errors\n'));
    }
  }
  
  /**
   * Display validation report
   * 
   * @param {ValidationReport} report - Validation report
   */
  displayValidation(report) {
    console.log(this.chalk.bold.cyan('\n✓ Document Structure Validation\n'));
    
    // Check if there are any errors or warnings
    const hasErrors = report.errors && report.errors.length > 0;
    const hasWarnings = report.warnings && report.warnings.length > 0;
    
    if (report.valid && !hasWarnings) {
      console.log(this.chalk.green('✅ Validation passed'));
      console.log('All document structures are compliant.\n');
      return;
    }
    
    if (hasErrors) {
      console.log(this.chalk.red(`❌ ${report.errors.length} error(s):\n`));
      
      report.errors.forEach(err => {
        console.log(`  ❌ ${this.chalk.gray(err.path)}`);
        console.log(`     ${err.message}`);
        console.log(`     ${this.chalk.cyan('→ ' + err.recommendation)}`);
        console.log();
      });
    }
    
    if (hasWarnings) {
      console.log(this.chalk.yellow(`⚠️  ${report.warnings.length} warning(s):\n`));
      
      report.warnings.forEach(warn => {
        console.log(`  ⚠️  ${this.chalk.gray(warn.path)}`);
        console.log(`     ${warn.message}`);
        console.log(`     ${this.chalk.cyan('→ ' + warn.recommendation)}`);
        console.log();
      });
    }
    
    // Display summary
    if (report.summary) {
      console.log(this.chalk.bold('Summary:'));
      console.log(`  Errors: ${report.summary.totalErrors}`);
      console.log(`  Warnings: ${report.summary.totalWarnings}`);
      console.log();
    }
  }
  
  /**
   * Display archive report
   * 
   * @param {ArchiveReport} report - Archive report
   * @param {boolean} dryRun - Whether this was a dry run
   */
  displayArchive(report, dryRun = false) {
    const title = dryRun ? 'Archive Preview (Dry Run)' : 'Archive Complete';
    console.log(this.chalk.bold.cyan(`\n📦 ${title}\n`));
    
    // Check if there are errors even with no moved files
    const hasErrors = report.errors && report.errors.length > 0;
    
    if (report.movedFiles.length === 0 && !hasErrors) {
      console.log(this.chalk.green('✅ No files to archive\n'));
      return;
    }
    
    if (report.movedFiles.length > 0) {
      const verb = dryRun ? 'Would move' : 'Moved';
      console.log(this.chalk.yellow(`${verb} ${report.movedFiles.length} file(s):\n`));
      
      report.movedFiles.forEach(move => {
        const fromBasename = path.basename(move.from);
        const toRelative = this.chalk.gray(move.to);
        console.log(`  📦 ${fromBasename}`);
        console.log(`     ${this.chalk.gray('→')} ${toRelative}`);
      });
      
      console.log();
    }
    
    if (hasErrors) {
      console.log(this.chalk.red(`❌ ${report.errors.length} error(s):`));
      report.errors.forEach(err => {
        console.log(`  • ${this.chalk.gray(err.path)}: ${err.error}`);
      });
      console.log();
    }
    
    if (dryRun && report.movedFiles.length > 0) {
      console.log(this.chalk.cyan('💡 Run without --dry-run to actually move these files\n'));
    } else if (report.success && report.movedFiles.length > 0) {
      console.log(this.chalk.green('✅ Archive completed successfully\n'));
    } else if (!report.success) {
      console.log(this.chalk.yellow('⚠️  Archive completed with errors\n'));
    }
  }
  
  /**
   * Display error message
   * 
   * @param {string} message - Error message
   */
  displayError(message) {
    console.log(this.chalk.red(`\n❌ Error: ${message}\n`));
  }
  
  /**
   * Display statistics
   * 
   * @param {Object} stats - Statistics object
   */
  displayStats(stats) {
    console.log(this.chalk.bold.cyan('\n📊 Document Compliance Statistics\n'));
    
    // Overall Summary
    console.log(this.chalk.bold('Overall Summary:'));
    console.log(`  Total Executions: ${stats.totalExecutions}`);
    console.log(`  Total Violations Found: ${stats.totalViolations}`);
    console.log(`  Total Cleanup Actions: ${stats.totalCleanupActions}`);
    console.log(`  Total Archive Actions: ${stats.totalArchiveActions}`);
    console.log(`  Total Errors: ${stats.totalErrors}`);
    console.log();
    
    // Time Range
    if (stats.firstExecution && stats.lastExecution) {
      console.log(this.chalk.bold('Time Range:'));
      console.log(`  First Execution: ${new Date(stats.firstExecution).toLocaleString()}`);
      console.log(`  Last Execution: ${new Date(stats.lastExecution).toLocaleString()}`);
      console.log();
    }
    
    // Executions by Tool
    if (Object.keys(stats.executionsByTool).length > 0) {
      console.log(this.chalk.bold('Executions by Tool:'));
      Object.entries(stats.executionsByTool)
        .sort((a, b) => b[1] - a[1])
        .forEach(([tool, count]) => {
          console.log(`  ${tool}: ${count}`);
        });
      console.log();
    }
    
    // Violations by Type
    if (Object.keys(stats.violationsByType).length > 0) {
      console.log(this.chalk.bold('Violations by Type:'));
      Object.entries(stats.violationsByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${this.formatType(type)}: ${count}`);
        });
      console.log();
    }
    
    // Violations Over Time (last 5)
    if (stats.violationsOverTime.length > 0) {
      console.log(this.chalk.bold('Recent Violations:'));
      const recent = stats.violationsOverTime.slice(-5);
      recent.forEach(entry => {
        const date = new Date(entry.timestamp).toLocaleString();
        console.log(`  ${date}: ${entry.count} violation(s)`);
      });
      console.log();
    }
    
    // Cleanup Actions Over Time (last 5)
    if (stats.cleanupActionsOverTime.length > 0) {
      console.log(this.chalk.bold('Recent Cleanup Actions:'));
      const recent = stats.cleanupActionsOverTime.slice(-5);
      recent.forEach(entry => {
        const date = new Date(entry.timestamp).toLocaleString();
        console.log(`  ${date}: ${entry.count} file(s) deleted`);
      });
      console.log();
    }
    
    // Recommendations
    console.log(this.chalk.cyan('💡 Run "sce docs report" to generate a detailed compliance report\n'));
  }
  
  /**
   * Display success message
   * 
   * @param {string} message - Success message
   */
  displaySuccess(message) {
    console.log(this.chalk.green(`\n✅ ${message}\n`));
  }
  
  /**
   * Display info message
   * 
   * @param {string} message - Info message
   */
  displayInfo(message) {
    console.log(this.chalk.cyan(`\nℹ️  ${message}\n`));
  }
  
  /**
   * Helper: Group array by property
   * 
   * @param {Array} array - Array to group
   * @param {string} property - Property to group by
   * @returns {Object} - Grouped object
   */
  groupBy(array, property) {
    return array.reduce((acc, item) => {
      const key = item[property];
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }
  
  /**
   * Helper: Format violation type
   * 
   * @param {string} type - Violation type
   * @returns {string} - Formatted type
   */
  formatType(type) {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
}

module.exports = Reporter;
