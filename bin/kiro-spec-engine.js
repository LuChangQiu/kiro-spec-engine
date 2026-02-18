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
const registerCollabCommands = require('../lib/commands/collab');
const { registerSpecBootstrapCommand } = require('../lib/commands/spec-bootstrap');
const { registerSpecPipelineCommand } = require('../lib/commands/spec-pipeline');
const { registerSpecGateCommand } = require('../lib/commands/spec-gate');
const { registerValueCommands } = require('../lib/commands/value');
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

/**
 * Normalize `sco spec ...` compatibility routes.
 *
 * Supported routes:
 * - `sco spec bootstrap ...` -> `sco spec-bootstrap ...`
 * - `sco spec pipeline ...` -> `sco spec-pipeline ...`
 * - `sco spec gate ...` -> `sco spec-gate ...`
 * - `sco spec create <name> ...` -> `sco create-spec <name> ...`
 * - `sco spec <name> ...` -> `sco create-spec <name> ...` (legacy)
 *
 * @param {string[]} argv
 * @returns {string[]}
 */
function normalizeSpecCommandArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0) {
    return argv;
  }

  const normalized = [...argv];
  const commandIndex = findCommandIndex(normalized);
  if (commandIndex < 0 || normalized[commandIndex] !== 'spec') {
    return normalized;
  }

  const commandToken = normalized[commandIndex + 1];

  if (commandToken === 'bootstrap') {
    normalized.splice(commandIndex, 2, 'spec-bootstrap');
    return normalized;
  }

  if (commandToken === 'pipeline') {
    normalized.splice(commandIndex, 2, 'spec-pipeline');
    return normalized;
  }

  if (commandToken === 'gate') {
    normalized.splice(commandIndex, 2, 'spec-gate');
    return normalized;
  }

  if (commandToken === 'create') {
    normalized.splice(commandIndex, 2, 'create-spec');
    return normalized;
  }

  normalized.splice(commandIndex, 1, 'create-spec');
  return normalized;
}

/**
 * Find command token index after global options.
 * @param {string[]} args
 * @returns {number}
 */
function findCommandIndex(args) {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('-')) {
      return index;
    }

    if (token === '-l' || token === '--lang') {
      index += 1;
    }
  }

  return -1;
}

// 版本和基本信息
program
  .name(t('cli.name'))
  .description(t('cli.description'))
  .version(packageJson.version, '-v, --version', 'Display version number')
  .option('-l, --lang <locale>', 'Set language (en/zh)', (locale) => {
    i18n.setLocale(locale);
  })
  .option('--no-version-check', 'Suppress version mismatch warnings')
  .option('--skip-steering-check', 'Skip steering directory compliance check (not recommended)')
  .option('--force-steering-check', 'Force steering directory compliance check even if cache is valid');

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
      console.error(chalk.red('❌ Ultrawork tool not found. Please run: sco init'));
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
  .alias('spec')
  .description('Create a new spec directory')
  .option('-t, --template <template-id>', 'Use a template from the library')
  .option('-f, --force', 'Overwrite existing spec directory')
  .action(async (specName, options) => {
    const specPath = path.join(process.cwd(), '.kiro/specs', specName);
    
    try {
      // Check if using template
      if (options.template) {
        const TemplateManager = require('../lib/templates/template-manager');
        const manager = new TemplateManager();
        
        console.log(chalk.red('🔥') + ' Creating Spec from Template');
        console.log();
        console.log(`  ${chalk.gray('Spec:')} ${specName}`);
        console.log(`  ${chalk.gray('Template:')} ${options.template}`);
        console.log();
        
        await manager.applyTemplate(specName, options.template, {
          force: options.force
        });
        
        console.log(chalk.green('✅ Spec created successfully'));
        console.log();
        console.log(chalk.blue('📋 Next steps:'));
        console.log('  1. Review and customize the generated files');
        console.log('  2. Fill in project-specific details');
        console.log('  3. Start implementing tasks');
      } else {
        // Create empty spec directory
        await fs.ensureDir(specPath);
        console.log(chalk.green('✅ Created spec directory:'), specPath);
        console.log();
        console.log(chalk.blue('📋 Next steps:'));
        console.log('  1. Create requirements.md in the spec directory');
        console.log('  2. Enhance with: ' + chalk.cyan(`sco enhance requirements ${specPath}/requirements.md`));
        console.log();
        console.log(chalk.yellow('💡 Tip:'));
        console.log('  Use a template: ' + chalk.cyan(`sco spec create ${specName} --template <template-id>`));
        console.log('  Browse templates: ' + chalk.cyan('sco templates list'));
        console.log('  Legacy alias (still works): ' + chalk.cyan('kse templates list')); 
      }
    } catch (error) {
      console.error(chalk.red('❌ Error creating spec:'), error.message);
      if (error.suggestions) {
        console.log();
        console.log(chalk.yellow('💡 Suggestions:'));
        error.suggestions.forEach(s => console.log(`  • ${s}`));
      }
      process.exit(1);
    }
  });

// Spec bootstrap wizard command
registerSpecBootstrapCommand(program);

// Spec workflow pipeline command
registerSpecPipelineCommand(program);

// Spec gate command
registerSpecGateCommand(program);

// 系统诊断命令
program
  .command('doctor')
  .description(t('cli.commands.doctor.description'))
  .option('--docs', 'Show detailed document governance diagnostics')
  .option('--fix-gitignore', 'Check and fix .gitignore for team collaboration')
  .action((options) => {
    doctorCommand(options);
  });

// 项目接管命令
program
  .command('adopt')
  .description('Adopt existing project into SCO (Scene Capability Orchestrator)')
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
  .option('--to <version>', 'Target version (default: current sco version)')
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
  .description('Manage multiple SCO project workspaces');

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

// Environment configuration management commands
const envCommand = require('../lib/commands/env');

const envCmd = program
  .command('env <subcommand> [args...]')
  .description('Manage environment configurations');

envCmd.action(async (subcommand, args, options) => {
  const exitCode = await envCommand.handleCommand([subcommand, ...args]);
  process.exit(exitCode);
});

// Multi-repository management commands
const repoCommand = require('../lib/commands/repo');

const repoCmd = program
  .command('repo')
  .description('Manage multiple Git subrepositories');

repoCmd
  .command('init')
  .description('Initialize repository configuration')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--max-depth <depth>', 'Maximum scan depth', parseInt)
  .option('--exclude <paths>', 'Comma-separated paths to exclude')
  .option('--nested', 'Enable nested repository scanning (default)')
  .option('--no-nested', 'Disable nested repository scanning')
  .action(async (options) => {
    await repoCommand.initRepo(options);
  });

repoCmd
  .command('status')
  .description('Display repository status')
  .option('-v, --verbose', 'Show detailed status')
  .action(async (options) => {
    await repoCommand.statusRepo(options);
  });

repoCmd
  .command('exec <command>')
  .description('Execute command across repositories')
  .option('--dry-run', 'Show commands without executing')
  .action(async (command, options) => {
    await repoCommand.execRepo(command, options);
  });

repoCmd
  .command('health')
  .description('Check repository health')
  .action(async (options) => {
    await repoCommand.healthRepo(options);
  });

// Spec-level collaboration commands
registerCollabCommands(program);

// Autonomous control commands
const { registerAutoCommands } = require('../lib/commands/auto');
registerAutoCommands(program);

// Scene runtime commands
const { registerSceneCommands } = require('../lib/commands/scene');
registerSceneCommands(program);

// Lock commands for multi-user collaboration
const { registerLockCommands } = require('../lib/commands/lock');
registerLockCommands(program);

// Knowledge management commands
const { registerKnowledgeCommands } = require('../lib/commands/knowledge');
registerKnowledgeCommands(program);

// Orchestration commands
const { registerOrchestrateCommands } = require('../lib/commands/orchestrate');
registerOrchestrateCommands(program);

// Value realization and observability commands
registerValueCommands(program);

// Template management commands
const templatesCommand = require('../lib/commands/templates');

const templatesCmd = program
  .command('templates')
  .description('Manage Spec templates from official and custom sources');

templatesCmd
  .command('list')
  .description('List all available templates')
  .option('--category <category>', 'Filter by category')
  .option('--source <source>', 'Filter by source')
  .action(async (options) => {
    await templatesCommand.listTemplates(options);
  });

templatesCmd
  .command('search <keyword>')
  .description('Search templates by keyword')
  .option('--category <category>', 'Filter by category')
  .action(async (keyword, options) => {
    await templatesCommand.searchTemplates(keyword, options);
  });

templatesCmd
  .command('show <template-path>')
  .description('Show template details')
  .action(async (templatePath) => {
    await templatesCommand.showTemplate(templatePath);
  });

templatesCmd
  .command('update')
  .description('Update templates from sources')
  .option('--source <source>', 'Update specific source only')
  .option('--version <version>', 'Checkout specific version/tag')
  .action(async (options) => {
    await templatesCommand.updateTemplates(options);
  });

templatesCmd
  .command('add-source <name> <git-url>')
  .description('Add custom template source')
  .action(async (name, gitUrl) => {
    await templatesCommand.addSource(name, gitUrl);
  });

templatesCmd
  .command('remove-source <name>')
  .description('Remove template source')
  .action(async (name) => {
    await templatesCommand.removeSource(name);
  });

templatesCmd
  .command('sources')
  .description('List configured template sources')
  .action(async () => {
    await templatesCommand.listSources();
  });

templatesCmd
  .command('cache')
  .description('Manage template cache')
  .option('--clear', 'Clear cache')
  .option('--source <source>', 'Target specific source')
  .action(async (options) => {
    await templatesCommand.cacheCommand(options);
  });

templatesCmd
  .command('guide')
  .description('Display template usage guide')
  .action(async () => {
    await templatesCommand.displayGuide();
  });

templatesCmd
  .command('create-from-spec')
  .description('Create template from existing Spec')
  .option('--spec <identifier>', 'Spec identifier (number or name)')
  .option('--output <path>', 'Custom output directory')
  .option('--preview', 'Show diff before export')
  .option('--dry-run', 'Simulate without writing files')
  .option('--no-interactive', 'Use defaults for all prompts')
  .action(async (options) => {
    await templatesCommand.createFromSpec(options);
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

// Run steering directory compliance check before parsing commands
(async function() {
  const { runSteeringComplianceCheck } = require('../lib/steering');
  const normalizedArgs = normalizeSpecCommandArgs(process.argv.slice(2));
  process.argv = [process.argv[0], process.argv[1], ...normalizedArgs];
  
  // Check for bypass flags
  const args = process.argv.slice(2);
  const skipCheck = args.includes('--skip-steering-check') || 
                    process.env.KSE_SKIP_STEERING_CHECK === '1';
  const forceCheck = args.includes('--force-steering-check');
  
  // Run compliance check
  await runSteeringComplianceCheck({
    skip: skipCheck,
    force: forceCheck,
    projectPath: process.cwd(),
    version: packageJson.version
  });

  // 解析命令行参数
  program.parse();
})();
