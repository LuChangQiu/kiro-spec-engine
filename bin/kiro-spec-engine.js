#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const { getI18n } = require('../lib/i18n');
const doctorCommand = require('../lib/commands/doctor');

const i18n = getI18n();
const t = (key, params) => i18n.t(key, params);

// Read version from package.json
const packageJson = require('../package.json');

const program = new Command();

// 版本和基本信息
program
  .name(t('cli.name'))
  .description(t('cli.description'))
  .version(packageJson.version, '-v, --version', 'Display version number')
  .option('-l, --lang <locale>', 'Set language (en/zh)', (locale) => {
    i18n.setLocale(locale);
  });

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
  .action(() => {
    doctorCommand();
  });

// 状态检查命令
program
  .command('status')
  .description('Check project status and available specs')
  .action(async () => {
    const kiroDir = path.join(process.cwd(), '.kiro');
    
    if (!fs.existsSync(kiroDir)) {
      console.log(chalk.yellow('⚠️  No Kiro Spec Engine project found in current directory'));
      console.log('Run: ' + chalk.cyan('kiro-spec-engine init') + ' to initialize');
      return;
    }

    console.log(chalk.red('🔥') + ' Kiro Spec Engine Project Status');
    console.log();

    // 检查工具状态
    const toolPath = path.join(kiroDir, 'tools/ultrawork_enhancer.py');
    const toolStatus = fs.existsSync(toolPath) ? chalk.green('✅ Available') : chalk.red('❌ Missing');
    console.log('Ultrawork Tool:', toolStatus);

    // 列出 Specs
    const specsDir = path.join(kiroDir, 'specs');
    if (fs.existsSync(specsDir)) {
      const specs = fs.readdirSync(specsDir).filter(item => 
        fs.statSync(path.join(specsDir, item)).isDirectory()
      );
      
      console.log();
      console.log(chalk.blue('📋 Available Specs:'));
      if (specs.length === 0) {
        console.log('  No specs found');
      } else {
        specs.forEach(spec => {
          const specPath = path.join(specsDir, spec);
          const hasReq = fs.existsSync(path.join(specPath, 'requirements.md'));
          const hasDesign = fs.existsSync(path.join(specPath, 'design.md'));
          const hasTasks = fs.existsSync(path.join(specPath, 'tasks.md'));
          
          console.log(`  ${spec}:`);
          console.log(`    Requirements: ${hasReq ? chalk.green('✅') : chalk.gray('⚪')}`);
          console.log(`    Design: ${hasDesign ? chalk.green('✅') : chalk.gray('⚪')}`);
          console.log(`    Tasks: ${hasTasks ? chalk.green('✅') : chalk.gray('⚪')}`);
        });
      }
    }
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