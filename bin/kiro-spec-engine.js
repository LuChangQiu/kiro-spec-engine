#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { getI18n } = require('../lib/i18n');
const doctorCommand = require('../lib/commands/doctor');
const adoptCommand = require('../lib/commands/adopt');
const upgradeCommand = require('../lib/commands/upgrade');
const rollbackCommand = require('../lib/commands/rollback');
const watchCommands = require('../lib/commands/watch');
const workflowsCommand = require('../lib/commands/workflows');
const VersionChecker = require('../lib/version/version-checker');

const i18n = getI18n();
const t = (key, params) => i18n.t(key, params);

// Read version from package.json
const packageJson = require('../package.json');

// Create version checker instance
const versionChecker = new VersionChecker();

// Helper function to check version before command execution
async function checkVersionBeforeCommand(options = {}) {
  const projectPath = process.cwd();
  const noVersionCheck = options.noVersionCheck || false;
  
  if (!noVersionCheck) {
    await versionChecker.checkVersion(projectPath, { noVersionCheck });
  }
}

const program = new Command();

// 版本和基本信息
program
  .name(t('cli.name'))
  .description(t('cli.description'))
  .version(packageJson.version, '-v, --version', 'Display version number')
  .option('-l, --lang <locale>', 'Set language (en/zh)', (locale) => {
    i18n.setLocale(locale);
  })
  .option('--no-version-check', 'Suppress version mismatch warnings');

// 初始化项目命令
program
  .command('init [project-name]')
  .description(t('cli.commands.init.description'))
  .option('-f, --force', t('cli.commands.init.forceOption'))
  .action(async (projectName, options) => {
    console.log(chalk.red('🔥') + ' ' + t('cli.commands.init.description'));
    console.log();

    // 获取项目名称
    if (!projectName) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: t('cli.commands.init.projectNamePrompt'),
          default: path.basename(process.cwd())
        }
      ]);
      projectName = answers.projectName;
    }

    // 检查是否已存在 .kiro 目录
    const kiroDir = path.join(process.cwd(), '.kiro');
    if (fs.existsSync(kiroDir) && !options.force) {
      console.log(chalk.yellow(t('cli.commands.init.alreadyExists')));
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: t('cli.commands.init.overwritePrompt'),
          default: false
        }
      ]);
      if (!overwrite) {
        console.log(t('cli.commands.init.cancelled'));
        return;
      }
    }

    try {
      // 复制模板文件
      const templateDir = path.join(__dirname, '../template');
      await fs.copy(templateDir, process.cwd(), { overwrite: true });

      // 更新项目配置
      await updateProjectConfig(projectName);

      console.log();
      console.log(chalk.green(t('cli.commands.init.success')));
      console.log();
      console.log(chalk.blue(t('cli.commands.init.nextSteps')));
      console.log('  1. ' + t('cli.commands.init.step1'));
      console.log('  2. ' + t('cli.commands.init.step2'));
      console.log('  3. ' + t('cli.commands.init.step3'));
      console.log();
      console.log(chalk.red('🔥') + ' ' + t('cli.commands.init.startJourney'));
    } catch (error) {
      console.error(chalk.red(t('cli.commands.init.error')), error.message);
      process.exit(1);
    }
  });

// 增强文档命令
program
  .command('enhance <stage> <file>')
  .description('Enhance document quality with Ultrawork spirit')
  .option('-r, --requirements <file>', 'Requirements file (needed for design stage)')
  .action(async (stage, file, options) => {
    console.log(chalk.red('🔥') + ` Starting ${stage} stage Ultrawork enhancement...`);
    
    // 检查 Python 和工具是否可用
    const toolPath = path.join(process.cwd(), '.kiro/tools/ultrawork_enhancer.py');
    if (!fs.existsSync(toolPath)) {
      console.error(chalk.red('❌ Ultrawork tool not found. Please run: kiro-spec-engine init'));
      process.exit(1);
    }

    // 构建 Python 命令
    let args = [toolPath, stage, file];
    if (stage === 'design' && options.requirements) {
      args.push(options.requirements);
    }

    // 执行 Python 工具
    const python = spawn('python', args, { stdio: 'inherit' });
    
    python.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Ultrawork enhancement completed!'));
      } else {
        console.error(chalk.red('❌ Enhancement failed with code:'), code);
        process.exit(code);
      }
    });

    python.on('error', (error) => {
      console.error(chalk.red('❌ Error running Python tool:'), error.message);
      console.log(chalk.yellow('💡 Make sure Python 3.8+ is installed and in PATH'));
      process.exit(1);
    });
  });

// 创建 Spec 命令
program
  .command('create-spec <spec-name>')
  .description('Create a new spec directory')
  .action(async (specName) => {
    const specPath = path.join(process.cwd(), '.kiro/specs', specName);
    
    try {
      await fs.ensureDir(specPath);
      console.log(chalk.green('✅ Created spec directory:'), specPath);
      console.log();
      console.log(chalk.blue('📋 Next steps:'));
      console.log('  1. Create requirements.md in the spec directory');
      console.log('  2. Enhance with: ' + chalk.cyan(`kiro-spec-engine enhance requirements ${specPath}/requirements.md`));
    } catch (error) {
      console.error(chalk.red('❌ Error creating spec:'), error.message);
      process.exit(1);
    }
  });

// 系统诊断命令
program
  .command('doctor')
  .description(t('cli.commands.doctor.description'))
  .option('--docs', 'Show detailed document governance diagnostics')
  .action((options) => {
    doctorCommand(options);
  });

// 项目接管命令
program
  .command('adopt')
  .description('Adopt existing project into Kiro Spec Engine')
  .option('--interactive', 'Enable interactive mode (legacy behavior with prompts)')
  .option('--dry-run', 'Show what would change without making changes')
  .option('--verbose', 'Show detailed logs')
  .option('--no-backup', 'Skip backup creation (dangerous, not recommended)')
  .option('--skip-update', 'Skip template file updates')
  .option('--force', 'Force overwrite conflicting files (legacy, creates backup first)')
  .option('--auto', 'Skip confirmations (legacy, use --interactive for old behavior)')
  .option('--mode <mode>', 'Force specific adoption mode (legacy: fresh/partial/full)')
  .action((options) => {
    adoptCommand(options);
  });

// 项目升级命令
program
  .command('upgrade')
  .description('Upgrade project to newer version')
  .option('--auto', 'Skip confirmations (use with caution)')
  .option('--dry-run', 'Show upgrade plan without making changes')
  .option('--to <version>', 'Target version (default: current kse version)')
  .action((options) => {
    upgradeCommand(options);
  });

// 回滚命令
program
  .command('rollback')
  .description('Restore project from backup')
  .option('--auto', 'Skip confirmations (use with caution)')
  .option('--backup <id>', 'Specific backup ID to restore')
  .action((options) => {
    rollbackCommand(options);
  });

// 状态检查命令
const statusCommand = require('../lib/commands/status');

program
  .command('status')
  .description('Check project status and available specs')
  .option('--verbose', 'Show detailed information')
  .option('--team', 'Show team activity')
  .action(async (options) => {
    await statusCommand(options);
  });

// 版本信息命令
program
  .command('version-info')
  .description('Display detailed version information')
  .action(async () => {
    const projectPath = process.cwd();
    await versionChecker.displayVersionInfo(projectPath);
  });

// Watch mode commands
const watchCmd = program
  .command('watch')
  .description('Manage watch mode for automated file monitoring');

watchCmd
  .command('start')
  .description('Start watch mode')
  .option('-c, --config <path>', 'Custom config file path')
  .option('-p, --patterns <patterns>', 'Override patterns (comma-separated)')
  .action(watchCommands.startWatch);

watchCmd
  .command('stop')
  .description('Stop watch mode')
  .action(watchCommands.stopWatch);

watchCmd
  .command('status')
  .description('Show watch mode status')
  .action(watchCommands.statusWatch);

watchCmd
  .command('logs')
  .description('Display execution logs')
  .option('-t, --tail <lines>', 'Number of lines to show', '50')
  .option('-f, --follow', 'Follow mode (tail -f)')
  .action(watchCommands.logsWatch);

watchCmd
  .command('metrics')
  .description('Display automation metrics')
  .option('--format <format>', 'Output format (text/json)', 'text')
  .action(watchCommands.metricsWatch);

watchCmd
  .command('init')
  .description('Initialize watch configuration')
  .option('-f, --force', 'Overwrite existing config')
  .action(watchCommands.initWatch);

watchCmd
  .command('presets')
  .description('List available watch presets')
  .action(watchCommands.listPresetsWatch);

watchCmd
  .command('install <preset>')
  .description('Install a watch preset')
  .option('-f, --force', 'Overwrite existing actions')
  .action(watchCommands.installPresetWatch);

// Workflows commands
const workflowsCmd = program
  .command('workflows [action] [workflow-id]')
  .description('Manage manual workflows and checklists')
  .action(async (action, workflowId) => {
    await workflowsCommand(action, workflowId);
  });

// Document governance commands
const docsCommand = require('../lib/commands/docs');

const docsCmd = program
  .command('docs')
  .description('Document governance and lifecycle management');

docsCmd
  .command('diagnose')
  .alias('diagnostic')
  .description('Scan project for document violations')
  .action(async () => {
    const exitCode = await docsCommand('diagnose');
    process.exit(exitCode);
  });

docsCmd
  .command('cleanup')
  .description('Remove temporary documents')
  .option('--dry-run, --dry', 'Preview changes without applying them')
  .option('-i, --interactive', 'Prompt for confirmation before each deletion')
  .option('--spec <name>', 'Target specific Spec directory')
  .action(async (options) => {
    const exitCode = await docsCommand('cleanup', options);
    process.exit(exitCode);
  });

docsCmd
  .command('validate')
  .description('Validate document structure')
  .option('--spec <name>', 'Validate specific Spec directory')
  .option('--all', 'Validate all Spec directories')
  .action(async (options) => {
    const exitCode = await docsCommand('validate', options);
    process.exit(exitCode);
  });

docsCmd
  .command('archive')
  .description('Organize Spec artifacts into subdirectories')
  .option('--spec <name>', 'Target Spec directory (required)')
  .option('--dry-run, --dry', 'Preview changes without applying them')
  .action(async (options) => {
    const exitCode = await docsCommand('archive', options);
    process.exit(exitCode);
  });

docsCmd
  .command('hooks <action>')
  .description('Manage Git hooks (install, uninstall, status)')
  .action(async (action) => {
    const exitCode = await docsCommand('hooks', { _: [action] });
    process.exit(exitCode);
  });

docsCmd
  .command('config [key] [value]')
  .description('Display or modify configuration')
  .option('--set', 'Set configuration value (use with key and value arguments)')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (key, value, options) => {
    // Build options object for the docs command
    const cmdOptions = {
      set: options.set,
      reset: options.reset,
      _: ['config']
    };
    
    // Add key and value if provided
    if (key) cmdOptions._.push(key);
    if (value) cmdOptions._.push(value);
    
    const exitCode = await docsCommand('config', cmdOptions);
    process.exit(exitCode);
  });

docsCmd
  .command('stats')
  .description('Display compliance statistics')
  .action(async () => {
    const exitCode = await docsCommand('stats');
    process.exit(exitCode);
  });

docsCmd
  .command('report')
  .description('Generate compliance report')
  .action(async () => {
    const exitCode = await docsCommand('report');
    process.exit(exitCode);
  });

docsCmd
  .command('check-refs')
  .alias('check-references')
  .description('Check for incorrect project references and placeholders')
  .option('--report', 'Save report to file')
  .option('--verbose', 'Show detailed error information')
  .action(async (options) => {
    const exitCode = await docsCommand('check-refs', options);
    process.exit(exitCode);
  });

// DevOps integration commands
const opsCommand = require('../lib/commands/ops');

const opsCmd = program
  .command('ops <subcommand> [args...]')
  .description('DevOps integration foundation commands');

// Note: The ops command handles its own subcommand routing internally
opsCmd.action(async (subcommand, args, options) => {
  await opsCommand(subcommand, args, options);
});

// Multi-workspace management commands
const workspaceCommand = require('../lib/commands/workspace-multi');

const workspaceCmd = program
  .command('workspace')
  .description('Manage multiple kse project workspaces');

workspaceCmd
  .command('create <name>')
  .description('Create a new workspace')
  .option('-p, --path <path>', 'Workspace path (defaults to current directory)')
  .action(async (name, options) => {
    await workspaceCommand.createWorkspace(name, options);
  });

workspaceCmd
  .command('list')
  .alias('ls')
  .description('List all workspaces')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    await workspaceCommand.listWorkspaces(options);
  });

workspaceCmd
  .command('switch <name>')
  .description('Switch to a workspace')
  .action(async (name) => {
    await workspaceCommand.switchWorkspace(name);
  });

workspaceCmd
  .command('remove <name>')
  .alias('rm')
  .description('Remove a workspace')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (name, options) => {
    await workspaceCommand.removeWorkspace(name, options);
  });

workspaceCmd
  .command('info [name]')
  .description('Show workspace information (defaults to current workspace)')
  .action(async (name) => {
    await workspaceCommand.infoWorkspace(name);
  });

// 更新项目配置的辅助函数
async function updateProjectConfig(projectName) {
  const envPath = path.join(process.cwd(), '.kiro/steering/ENVIRONMENT.md');
  const contextPath = path.join(process.cwd(), '.kiro/steering/CURRENT_CONTEXT.md');

  // 更新 ENVIRONMENT.md
  if (fs.existsSync(envPath)) {
    let content = await fs.readFile(envPath, 'utf8');
    content = content.replace(/\[请修改为你的项目名称\]/g, projectName);
    await fs.writeFile(envPath, content);
  }

  // 更新 CURRENT_CONTEXT.md
  if (fs.existsSync(contextPath)) {
    let content = await fs.readFile(contextPath, 'utf8');
    content = content.replace(/新项目/g, projectName);
    await fs.writeFile(contextPath, content);
  }
}

// 解析命令行参数
program.parse();