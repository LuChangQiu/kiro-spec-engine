const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class ResultEmitter {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
  }

  async emit(result, options = {}) {
    if (!options.silent) {
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        this._printHumanReadable(result);
      }
    }

    const outputPath = options.out
      ? this._resolvePath(options.out)
      : null;

    if (outputPath) {
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeJson(outputPath, result, { spaces: 2 });
    }

    return {
      outputPath
    };
  }

  _printHumanReadable(result) {
    const decisionColor = result.decision === 'go'
      ? chalk.green
      : result.decision === 'conditional-go'
        ? chalk.yellow
        : chalk.red;

    console.log(chalk.red('🔥') + ' Spec Gate');
    console.log();
    console.log(`${chalk.gray('Spec:')} ${result.spec_id}`);
    console.log(`${chalk.gray('Run:')} ${result.run_id}`);
    console.log(`${chalk.gray('Decision:')} ${decisionColor(result.decision)}`);
    console.log(`${chalk.gray('Score:')} ${result.score}`);
    console.log();

    console.log(chalk.bold('Rule Results'));
    result.rules.forEach(rule => {
      const icon = rule.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${icon} ${rule.id} (${rule.score}/${rule.max_score})`);
    });

    if (result.failed_checks.length > 0) {
      console.log();
      console.log(chalk.bold('Failed Checks'));
      result.failed_checks.forEach(check => {
        console.log(`  - ${check.id} (hard_fail: ${check.hard_fail})`);
      });
    }

    if (result.next_actions.length > 0) {
      console.log();
      console.log(chalk.bold('Next Actions'));
      result.next_actions.forEach(action => console.log(`  - ${action}`));
    }
  }

  _resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    return path.join(this.projectPath, filePath);
  }
}

module.exports = {
  ResultEmitter
};

