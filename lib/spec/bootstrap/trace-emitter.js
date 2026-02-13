const chalk = require('chalk');

class TraceEmitter {
  emit(result, options = {}) {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.red('🔥') + ' Spec Bootstrap Wizard');
    console.log();
    console.log(`${chalk.gray('Spec:')} ${result.specName}`);
    console.log(`${chalk.gray('Mode:')} ${result.dryRun ? 'dry-run' : 'write'}`);
    console.log(`${chalk.gray('Template:')} ${result.trace.template}`);
    console.log(`${chalk.gray('Profile:')} ${result.trace.profile}`);
    console.log();

    if (result.dryRun) {
      console.log(chalk.yellow('⚠ Dry-run mode: no files were written.'));
      console.log();
      this._printPreview(result.preview || {});
    } else {
      console.log(chalk.green('✅ Draft files generated:'));
      Object.values(result.files || {}).forEach(filePath => {
        console.log(`  - ${filePath}`);
      });
    }

    console.log();
    console.log(chalk.blue('📌 Trace Summary'));
    console.log(`  - existing specs: ${result.trace.context.totalSpecs}`);
    console.log(`  - preferred language: ${result.trace.context.preferredLanguage}`);
    console.log(`  - non-interactive: ${result.trace.parameters.nonInteractive}`);
  }

  _printPreview(preview) {
    const sections = ['requirements', 'design', 'tasks'];

    sections.forEach(section => {
      const content = preview[section];
      if (!content) {
        return;
      }

      const lines = content
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, 5);

      console.log(chalk.cyan(`--- ${section}.md preview ---`));
      lines.forEach(line => console.log(`  ${line}`));
      console.log('  ...');
      console.log();
    });
  }
}

module.exports = { TraceEmitter };

