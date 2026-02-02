const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const CollaborationManager = require('../collab/collab-manager');

/**
 * Register collaboration commands
 * @param {Command} program - Commander program instance
 */
function registerCollabCommands(program) {
  const collab = program
    .command('collab')
    .description('Manage Spec-level collaboration for parallel development');

  // kse collab init
  collab
    .command('init <master-spec>')
    .description('Initialize a Master Spec with Sub-Specs')
    .option('-s, --sub-specs <specs...>', 'Sub-spec names')
    .option('-d, --dependencies <deps...>', 'Dependencies in format "spec:dep1,dep2"')
    .action(async (masterSpec, options) => {
      try {
        const workspaceRoot = process.cwd();
        const manager = new CollaborationManager(workspaceRoot);

        // Parse sub-specs
        const subSpecs = (options.subSpecs || []).map(name => ({ name, dependencies: [] }));

        // Parse dependencies if provided
        if (options.dependencies) {
          for (const depStr of options.dependencies) {
            const [specName, ...deps] = depStr.split(':');
            const spec = subSpecs.find(s => s.name === specName);
            if (spec && deps.length > 0) {
              spec.dependencies = deps[0].split(',').map(d => ({
                spec: d.trim(),
                type: 'requires-completion'
              }));
            }
          }
        }

        const result = await manager.initMasterSpec(masterSpec, subSpecs);

        if (result.success) {
          console.log(chalk.green('✓'), result.message);
          console.log(chalk.gray('  Master:'), masterSpec);
          for (const sub of result.subSpecs) {
            console.log(chalk.gray('  Sub:'), sub);
          }
        } else {
          console.error(chalk.red('✗'), result.error);
          if (result.created) {
            console.log(chalk.yellow('  Created specs:'), result.created.join(', '));
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // kse collab status
  collab
    .command('status [spec-name]')
    .description('Display collaboration status for all specs or a specific spec')
    .option('-g, --graph', 'Show dependency graph')
    .option('--critical-path', 'Highlight critical path in graph')
    .action(async (specName, options) => {
      try {
        const workspaceRoot = process.cwd();
        const manager = new CollaborationManager(workspaceRoot);

        if (options.graph) {
          const graph = await manager.generateDependencyGraph('text', {
            showCriticalPath: options.criticalPath
          });
          console.log(graph);
        } else {
          const status = await manager.getCollaborationStatus(specName);

          if (specName) {
            if (!status.found) {
              console.error(chalk.red('✗'), status.error);
              process.exit(1);
            }

            console.log(chalk.bold(`Spec: ${status.spec}`));
            console.log(chalk.gray('Type:'), status.metadata.type);
            console.log(chalk.gray('Status:'), status.metadata.status.current);
            if (status.metadata.assignment) {
              console.log(chalk.gray('Assigned to:'), status.metadata.assignment.kiroInstance);
            }
            if (status.metadata.dependencies && status.metadata.dependencies.length > 0) {
              console.log(chalk.gray('Dependencies:'));
              for (const dep of status.metadata.dependencies) {
                console.log(`  - ${dep.spec} (${dep.type})`);
              }
            }
          } else {
            console.log(chalk.bold(`Total Specs: ${status.total}`));
            console.log(chalk.bold(`Ready to Start: ${status.ready.length}`));
            console.log('');

            for (const { name, metadata } of status.specs) {
              const symbol = getStatusSymbol(metadata.status.current);
              const assignment = metadata.assignment 
                ? chalk.gray(`(${metadata.assignment.kiroInstance})`)
                : chalk.gray('(unassigned)');
              console.log(`${symbol} ${name} ${assignment}`);
            }

            if (status.ready.length > 0) {
              console.log('');
              console.log(chalk.green('Ready to start:'), status.ready.join(', '));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // kse collab assign
  collab
    .command('assign <spec-name> <kiro-instance>')
    .description('Assign a spec to a Kiro instance')
    .action(async (specName, kiroInstance) => {
      try {
        const workspaceRoot = process.cwd();
        const manager = new CollaborationManager(workspaceRoot);

        const result = await manager.assignSpec(specName, kiroInstance);

        if (result.success) {
          console.log(chalk.green('✓'), result.message);
        } else {
          console.error(chalk.red('✗'), result.error);
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // kse collab verify
  collab
    .command('verify <spec-name>')
    .description('Verify interface contracts for a spec')
    .action(async (specName) => {
      try {
        const workspaceRoot = process.cwd();
        const manager = new CollaborationManager(workspaceRoot);

        const result = await manager.verifyContracts(specName);

        if (result.valid) {
          console.log(chalk.green('✓'), result.message);
        } else {
          console.log(chalk.yellow('⚠'), result.message);
          if (result.results) {
            for (const r of result.results) {
              if (!r.valid) {
                console.log(chalk.red(`  ✗ ${r.interface}`));
                if (r.mismatches) {
                  for (const m of r.mismatches) {
                    console.log(chalk.gray(`    - ${m.message}`));
                  }
                }
              }
            }
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // kse collab integrate
  collab
    .command('integrate <spec-names...>')
    .description('Run integration tests across specs')
    .action(async (specNames) => {
      try {
        const workspaceRoot = process.cwd();
        const manager = new CollaborationManager(workspaceRoot);

        const results = await manager.runIntegrationTests(specNames);

        console.log(chalk.bold('Integration Test Results'));
        console.log(chalk.gray('========================'));
        console.log(`Total: ${results.total}`);
        console.log(chalk.green(`Passed: ${results.passed}`));
        console.log(chalk.red(`Failed: ${results.failed}`));
        console.log(chalk.yellow(`Blocked: ${results.blocked}`));

        if (results.failed > 0) {
          console.log('');
          console.log(chalk.red('Failed Tests:'));
          for (const r of results.results) {
            if (!r.success && !r.blocked) {
              console.log(chalk.red(`  ✗ ${r.name || path.basename(r.testPath)}`));
              console.log(chalk.gray(`    ${r.error}`));
            }
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // kse collab migrate
  collab
    .command('migrate <spec-name>')
    .description('Convert a standalone Spec to collaborative mode')
    .action(async (specName) => {
      try {
        const workspaceRoot = process.cwd();
        const manager = new CollaborationManager(workspaceRoot);

        // Check if already has collaboration metadata
        const existing = await manager.metadataManager.readMetadata(specName);
        if (existing) {
          console.log(chalk.yellow('⚠'), `Spec '${specName}' already has collaboration metadata`);
          process.exit(0);
        }

        // Create basic collaboration metadata
        const metadata = {
          version: '1.0.0',
          type: 'sub',
          dependencies: [],
          status: {
            current: 'not-started',
            updatedAt: new Date().toISOString()
          },
          interfaces: {
            provides: [],
            consumes: []
          }
        };

        await manager.metadataManager.writeMetadata(specName, metadata);
        console.log(chalk.green('✓'), `Migrated '${specName}' to collaborative mode`);
        console.log(chalk.gray('  You can now use collab commands with this Spec'));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
}

/**
 * Get status symbol
 * @param {string} status
 * @returns {string}
 */
function getStatusSymbol(status) {
  const symbols = {
    'completed': chalk.green('✓'),
    'in-progress': chalk.yellow('⧗'),
    'not-started': chalk.gray('○'),
    'blocked': chalk.red('✗')
  };
  return symbols[status] || '?';
}

module.exports = registerCollabCommands;
