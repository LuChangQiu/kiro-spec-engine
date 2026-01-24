const chalk = require('chalk');
const pythonChecker = require('../python-checker');
const { getI18n } = require('../i18n');
const DiagnosticEngine = require('../governance/diagnostic-engine');
const ConfigManager = require('../governance/config-manager');
const path = require('path');

/**
 * CLI Doctor Command Component
 * 
 * Verifies system requirements and provides diagnostics.
 * Checks Node.js version, Python availability, and document compliance.
 * 
 * Requirements: 7.5, 10.2
 */
async function doctorCommand(options = {}) {
  const i18n = getI18n();
  
  console.log(chalk.red('🔥') + ' ' + i18n.t('cli.commands.doctor.title'));
  console.log();
  console.log(i18n.t('cli.commands.doctor.checking'));
  console.log();
  
  // Check Node.js version
  const nodeVersion = process.version;
  const nodeStatus = chalk.green('✓');
  console.log(`${nodeStatus} ${i18n.t('cli.commands.doctor.nodejs')}: ${chalk.cyan(nodeVersion)}`);
  
  // Check Python availability
  const pythonStatus = pythonChecker.checkPython();
  
  if (pythonStatus.available) {
    const pythonOk = chalk.green('✓');
    console.log(`${pythonOk} ${i18n.t('cli.commands.doctor.python')}: ${chalk.cyan(pythonStatus.version)}`);
  } else {
    const pythonFail = chalk.red('✗');
    console.log(`${pythonFail} ${i18n.t('cli.commands.doctor.python')}: ${chalk.yellow(pythonStatus.message)}`);
    console.log();
    console.log(chalk.yellow(i18n.t('cli.commands.doctor.python_note')));
    console.log();
    console.log(chalk.blue(i18n.t('python.install_header')));
    console.log(pythonChecker.getInstallInstructions());
  }
  
  console.log();
  console.log(chalk.blue('─'.repeat(60)));
  console.log();
  
  // Check document compliance
  await checkDocumentCompliance(options);
  
  console.log();
  console.log(chalk.blue('─'.repeat(60)));
  console.log();
  
  // Summary
  if (pythonStatus.available) {
    console.log(chalk.green('✅ ' + i18n.t('cli.commands.doctor.all_good')));
    console.log(i18n.t('cli.commands.doctor.ready'));
  } else {
    console.log(chalk.yellow('⚠️  ' + i18n.t('cli.commands.doctor.python_missing')));
    console.log(i18n.t('cli.commands.doctor.basic_features'));
    console.log(i18n.t('cli.commands.doctor.ultrawork_unavailable'));
  }
  
  console.log();
}

/**
 * Check document compliance
 * 
 * @param {Object} options - Command options
 * @param {boolean} options.docs - Whether to show detailed diagnostics
 */
async function checkDocumentCompliance(options = {}) {
  try {
    const projectPath = process.cwd();
    
    // Load configuration
    const configManager = new ConfigManager(projectPath);
    const config = await configManager.load();
    
    // Run diagnostic scan
    const diagnosticEngine = new DiagnosticEngine(projectPath, config);
    const report = await diagnosticEngine.scan();
    
    // Display results based on options
    if (options.docs) {
      // Detailed diagnostics mode
      displayDetailedDiagnostics(report);
    } else {
      // Brief compliance status
      displayBriefCompliance(report);
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Document compliance check failed:'), error.message);
  }
}

/**
 * Display brief document compliance status
 * 
 * @param {Object} report - Diagnostic report
 */
function displayBriefCompliance(report) {
  console.log(chalk.bold('Document Compliance:'));
  
  if (report.compliant) {
    console.log(chalk.green('  ✓ All documents follow lifecycle management rules'));
  } else {
    const errorCount = report.summary.bySeverity.error || 0;
    const warningCount = report.summary.bySeverity.warning || 0;
    
    if (errorCount > 0) {
      console.log(chalk.red(`  ✗ ${errorCount} error(s) found`));
    }
    if (warningCount > 0) {
      console.log(chalk.yellow(`  ⚠ ${warningCount} warning(s) found`));
    }
    
    console.log(chalk.cyan(`  → Run 'kse doctor --docs' for detailed diagnostics`));
  }
}

/**
 * Display detailed document diagnostics
 * 
 * @param {Object} report - Diagnostic report
 */
function displayDetailedDiagnostics(report) {
  console.log(chalk.bold.cyan('Document Governance Diagnostic:'));
  console.log();
  
  if (report.compliant) {
    console.log(chalk.green('  ✅ Project is compliant'));
    console.log('  All documents follow the lifecycle management rules.');
    return;
  }
  
  console.log(chalk.yellow(`  ⚠️  Found ${report.violations.length} violation(s)`));
  console.log();
  
  // Group violations by type
  const byType = groupBy(report.violations, 'type');
  
  for (const [type, violations] of Object.entries(byType)) {
    console.log(chalk.blue(`  ${formatType(type)} (${violations.length})`));
    
    for (const violation of violations) {
      const icon = violation.severity === 'error' ? '❌' : '⚠️';
      const relativePath = path.relative(process.cwd(), violation.path);
      console.log(`    ${icon} ${chalk.gray(relativePath)}`);
      console.log(`       ${violation.description}`);
      console.log(`       ${chalk.cyan('→ ' + violation.recommendation)}`);
    }
    
    console.log();
  }
  
  // Display recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    console.log(chalk.blue('  💡 Recommended Actions:'));
    report.recommendations.forEach(rec => {
      console.log(`    • ${rec}`);
    });
  }
}

/**
 * Helper: Group array by property
 * 
 * @param {Array} array - Array to group
 * @param {string} property - Property to group by
 * @returns {Object} - Grouped object
 */
function groupBy(array, property) {
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
function formatType(type) {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

module.exports = doctorCommand;
