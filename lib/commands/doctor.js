const chalk = require('chalk');
const pythonChecker = require('../python-checker');
const { getI18n } = require('../i18n');

/**
 * CLI Doctor Command Component
 * 
 * Verifies system requirements and provides diagnostics.
 * Checks Node.js version and Python availability.
 * 
 * Requirements: 7.5
 */
function doctorCommand() {
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

module.exports = doctorCommand;
