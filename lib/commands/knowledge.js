/**
 * Knowledge Management CLI Commands
 */

const KnowledgeManager = require('../knowledge/knowledge-manager');
const chalk = require('chalk');
const Table = require('cli-table3');

/**
 * Register knowledge commands
 * @param {Object} program - Commander program
 */
function registerKnowledgeCommands(program) {
  const knowledge = program
    .command('knowledge')
    .alias('kb')
    .description('Manage personal knowledge base');
  
  // kse knowledge init
  knowledge
    .command('init')
    .description('Initialize knowledge base')
    .action(async () => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        if (await manager.isInitialized()) {
          console.log(chalk.yellow('⚠ Knowledge base already initialized'));
          return;
        }
        
        console.log(chalk.blue('Initializing knowledge base...'));
        await manager.initialize();
        
        console.log(chalk.green('✓ Knowledge base initialized'));
        console.log(chalk.gray('\nDirectory: .kiro/knowledge/'));
        console.log(chalk.gray('\nNext steps:'));
        console.log(chalk.gray('  kse knowledge add pattern "My First Pattern"'));
        console.log(chalk.gray('  kse knowledge list'));
        console.log(chalk.gray('  kse knowledge --help'));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse knowledge add
  knowledge
    .command('add <type> <title>')
    .description('Add new knowledge entry')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-c, --category <category>', 'Entry category')
    .action(async (type, title, options) => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];
        
        console.log(chalk.blue(`Creating ${type} entry: ${title}`));
        
        const result = await manager.addEntry(type, title, {
          tags,
          category: options.category
        });
        
        console.log(chalk.green('✓ Entry created'));
        console.log(chalk.gray(`ID: ${result.id}`));
        console.log(chalk.gray(`File: ${result.file}`));
        
        if (tags.length > 0) {
          console.log(chalk.gray(`Tags: ${tags.join(', ')}`));
        }
        
        console.log(chalk.gray('\nEdit the file to add content:'));
        console.log(chalk.gray(`  ${result.path}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse knowledge list
  knowledge
    .command('list')
    .description('List all knowledge entries')
    .option('-t, --type <type>', 'Filter by type')
    .option('--tag <tag>', 'Filter by tag')
    .option('--status <status>', 'Filter by status')
    .option('-s, --sort <field>', 'Sort by field (e.g., created:desc)')
    .action(async (options) => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        if (!await manager.isInitialized()) {
          console.log(chalk.yellow('Knowledge base not initialized. Run: kse knowledge init'));
          return;
        }
        
        const entries = await manager.listEntries({
          type: options.type,
          tag: options.tag,
          status: options.status,
          sort: options.sort || 'created:desc'
        });
        
        if (entries.length === 0) {
          console.log(chalk.gray('No entries found'));
          return;
        }
        
        const table = new Table({
          head: ['ID', 'Type', 'Title', 'Tags', 'Created'].map(h => chalk.cyan(h)),
          colWidths: [20, 12, 40, 25, 12]
        });
        
        for (const entry of entries) {
          table.push([
            entry.id.substring(0, 18) + '...',
            entry.type,
            entry.title.length > 37 ? entry.title.substring(0, 37) + '...' : entry.title,
            entry.tags.slice(0, 2).join(', '),
            new Date(entry.created).toLocaleDateString()
          ]);
        }
        
        console.log(table.toString());
        console.log(chalk.gray(`\nTotal: ${entries.length} entries`));
        
        const stats = await manager.getStats();
        console.log(chalk.gray(`By type: ${Object.entries(stats.byType).map(([k, v]) => `${k}(${v})`).join(', ')}`));
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse knowledge search
  knowledge
    .command('search <keyword>')
    .description('Search knowledge entries')
    .option('-f, --full-text', 'Search in file content')
    .action(async (keyword, options) => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        if (!await manager.isInitialized()) {
          console.log(chalk.yellow('Knowledge base not initialized. Run: kse knowledge init'));
          return;
        }
        
        console.log(chalk.blue(`Searching for: ${keyword}`));
        
        const results = await manager.search(keyword, {
          fullText: options.fullText
        });
        
        if (results.length === 0) {
          console.log(chalk.gray('No results found'));
          return;
        }
        
        console.log(chalk.green(`\n✓ Found ${results.length} results\n`));
        
        for (const result of results) {
          console.log(chalk.cyan(`${result.title}`));
          console.log(chalk.gray(`  ID: ${result.id}`));
          console.log(chalk.gray(`  Type: ${result.type}`));
          
          if (result.matches) {
            console.log(chalk.gray('  Matches:'));
            for (const match of result.matches) {
              console.log(chalk.gray(`    ${match.trim()}`));
            }
          }
          
          console.log();
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse knowledge show
  knowledge
    .command('show <id>')
    .description('Show knowledge entry')
    .option('--raw', 'Show raw markdown')
    .action(async (id, options) => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        const data = await manager.getEntry(id);
        
        if (options.raw) {
          console.log(data.content);
        } else {
          console.log(chalk.cyan.bold(`\n${data.metadata.title}\n`));
          console.log(chalk.gray(`ID: ${data.metadata.id}`));
          console.log(chalk.gray(`Type: ${data.metadata.type}`));
          console.log(chalk.gray(`Created: ${new Date(data.metadata.created).toLocaleString()}`));
          console.log(chalk.gray(`Updated: ${new Date(data.metadata.updated).toLocaleString()}`));
          
          if (data.metadata.tags.length > 0) {
            console.log(chalk.gray(`Tags: ${data.metadata.tags.join(', ')}`));
          }
          
          console.log('\n' + data.content);
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse knowledge delete
  knowledge
    .command('delete <id>')
    .description('Delete knowledge entry')
    .option('-f, --force', 'Skip confirmation')
    .option('--no-backup', 'Skip backup')
    .action(async (id, options) => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        const entry = await manager.indexManager.findById(id);
        if (!entry) {
          console.log(chalk.red(`Entry not found: ${id}`));
          return;
        }
        
        if (!options.force) {
          console.log(chalk.yellow(`⚠ Delete entry: ${entry.title}?`));
          console.log(chalk.gray('Use --force to skip confirmation'));
          return;
        }
        
        const result = await manager.deleteEntry(id, {
          backup: options.backup !== false
        });
        
        console.log(chalk.green('✓ Entry deleted'));
        console.log(chalk.gray(`Title: ${result.title}`));
        
        if (options.backup !== false) {
          console.log(chalk.gray('Backup created in .kiro/knowledge/.backups/'));
        }
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
  
  // kse knowledge stats
  knowledge
    .command('stats')
    .description('Show knowledge base statistics')
    .action(async () => {
      try {
        const manager = new KnowledgeManager(process.cwd());
        
        if (!await manager.isInitialized()) {
          console.log(chalk.yellow('Knowledge base not initialized. Run: kse knowledge init'));
          return;
        }
        
        const stats = await manager.getStats();
        
        console.log(chalk.cyan.bold('\nKnowledge Base Statistics\n'));
        
        console.log(chalk.white(`Total Entries: ${stats.totalEntries}`));
        
        console.log(chalk.white('\nBy Type:'));
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(chalk.gray(`  ${type}: ${count}`));
        }
        
        console.log(chalk.white('\nBy Status:'));
        for (const [status, count] of Object.entries(stats.byStatus)) {
          console.log(chalk.gray(`  ${status}: ${count}`));
        }
        
        if (Object.keys(stats.byTag).length > 0) {
          console.log(chalk.white('\nTop Tags:'));
          const sortedTags = Object.entries(stats.byTag)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
          
          for (const [tag, count] of sortedTags) {
            console.log(chalk.gray(`  ${tag}: ${count}`));
          }
        }
        
        console.log();
        
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    });
}

module.exports = { registerKnowledgeCommands };
