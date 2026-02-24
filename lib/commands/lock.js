/**
 * Lock commands for Spec locking mechanism
 * @module lib/commands/lock
 */

const chalk = require('chalk');
const path = require('path');
const { LockManager } = require('../lock/lock-manager');
const { MachineIdentifier } = require('../lock/machine-identifier');

/**
 * Register lock commands
 * @param {import('commander').Command} program
 */
function registerLockCommands(program) {
  const lockCmd = program
    .command('lock')
    .description('Manage Spec locks for multi-user collaboration');

  // sce lock <spec-name>
  lockCmd
    .command('acquire <spec-name>')
    .alias('get')
    .description('Acquire a lock on a Spec')
    .option('-r, --reason <reason>', 'Reason for acquiring the lock')
    .option('-t, --timeout <hours>', 'Lock timeout in hours', '24')
    .action(async (specName, options) => {
      await acquireLock(specName, options);
    });

  // sce lock release <spec-name>
  lockCmd
    .command('release <spec-name>')
    .description('Release a lock on a Spec')
    .option('-f, --force', 'Force release regardless of ownership')
    .action(async (specName, options) => {
      await releaseLock(specName, options);
    });

  // sce lock status [spec-name]
  lockCmd
    .command('status [spec-name]')
    .description('Show lock status for Specs')
    .action(async (specName) => {
      await showLockStatus(specName);
    });

  // sce lock cleanup
  lockCmd
    .command('cleanup')
    .description('Remove all stale locks')
    .action(async () => {
      await cleanupStaleLocks();
    });

  // sce lock whoami
  lockCmd
    .command('whoami')
    .description('Display current machine identifier')
    .action(async () => {
      await showMachineInfo();
    });

  // sce unlock <spec-name> (alias)
  program
    .command('unlock <spec-name>')
    .description('Release a lock on a Spec (alias for lock release)')
    .option('-f, --force', 'Force release regardless of ownership')
    .action(async (specName, options) => {
      await releaseLock(specName, options);
    });
}


/**
 * Acquire a lock on a Spec
 */
async function acquireLock(specName, options) {
  const workspaceRoot = process.cwd();
  const lockManager = new LockManager(workspaceRoot);
  
  const timeout = parseInt(options.timeout, 10) || 24;
  const result = await lockManager.acquireLock(specName, {
    reason: options.reason,
    timeout
  });

  if (result.success) {
    console.log(chalk.green('✓') + ` Lock acquired on ${chalk.cyan(specName)}`);
    console.log(`  Owner: ${result.lock.owner}`);
    console.log(`  Machine: ${result.lock.hostname}`);
    if (result.lock.reason) {
      console.log(`  Reason: ${result.lock.reason}`);
    }
    console.log(`  Timeout: ${result.lock.timeout}h`);
  } else {
    console.log(chalk.red('✗') + ` Failed to acquire lock: ${result.error}`);
    if (result.existingLock) {
      console.log(chalk.yellow('\nCurrent lock holder:'));
      console.log(`  Owner: ${result.existingLock.owner}`);
      console.log(`  Machine: ${result.existingLock.hostname}`);
      console.log(`  Since: ${result.existingLock.timestamp}`);
      if (result.existingLock.reason) {
        console.log(`  Reason: ${result.existingLock.reason}`);
      }
    }
    process.exitCode = 1;
  }
}

/**
 * Release a lock on a Spec
 */
async function releaseLock(specName, options) {
  const workspaceRoot = process.cwd();
  const lockManager = new LockManager(workspaceRoot);
  
  const result = await lockManager.releaseLock(specName, {
    force: options.force
  });

  if (result.success) {
    if (result.message) {
      console.log(chalk.yellow('ℹ') + ` ${result.message}`);
    } else {
      const forceMsg = result.forced ? ' (forced)' : '';
      console.log(chalk.green('✓') + ` Lock released on ${chalk.cyan(specName)}${forceMsg}`);
    }
  } else {
    console.log(chalk.red('✗') + ` Failed to release lock: ${result.error}`);
    if (result.existingLock) {
      console.log(chalk.yellow('\nLock is owned by:'));
      console.log(`  Owner: ${result.existingLock.owner}`);
      console.log(`  Machine: ${result.existingLock.hostname}`);
      console.log(chalk.dim('\nUse --force to override'));
    }
    process.exitCode = 1;
  }
}

/**
 * Show lock status
 */
async function showLockStatus(specName) {
  const workspaceRoot = process.cwd();
  const lockManager = new LockManager(workspaceRoot);
  
  if (specName) {
    const status = await lockManager.getLockStatus(specName);
    displaySingleStatus(status);
  } else {
    const statuses = await lockManager.getLockStatus();
    if (statuses.length === 0) {
      console.log(chalk.dim('No Specs are currently locked'));
      return;
    }
    
    console.log(chalk.bold(`Locked Specs (${statuses.length}):\n`));
    for (const status of statuses) {
      displaySingleStatus(status);
      console.log();
    }
  }
}

/**
 * Display single lock status
 */
function displaySingleStatus(status) {
  const { specName, locked, lock, isStale, isOwnedByMe, duration } = status;
  
  if (!locked) {
    console.log(`${chalk.cyan(specName)}: ${chalk.dim('unlocked')}`);
    return;
  }

  const staleIndicator = isStale ? chalk.red(' [STALE]') : '';
  const ownerIndicator = isOwnedByMe ? chalk.green(' (you)') : '';
  
  console.log(`${chalk.cyan(specName)}: ${chalk.yellow('locked')}${staleIndicator}${ownerIndicator}`);
  console.log(`  Owner: ${lock.owner}`);
  console.log(`  Machine: ${lock.hostname}`);
  console.log(`  Duration: ${duration}`);
  if (lock.reason) {
    console.log(`  Reason: ${lock.reason}`);
  }
}


/**
 * Cleanup stale locks
 */
async function cleanupStaleLocks() {
  const workspaceRoot = process.cwd();
  const lockManager = new LockManager(workspaceRoot);
  
  const result = await lockManager.cleanupStaleLocks();
  
  if (result.cleaned === 0) {
    console.log(chalk.dim('No stale locks found'));
    return;
  }
  
  console.log(chalk.green('✓') + ` Cleaned ${result.cleaned} stale lock(s):`);
  for (const { specName, lock } of result.cleanedLocks) {
    console.log(`  - ${chalk.cyan(specName)} (was locked by ${lock.owner})`);
  }
  
  if (result.errors.length > 0) {
    console.log(chalk.yellow('\nErrors encountered:'));
    for (const { specName, error } of result.errors) {
      console.log(`  - ${specName}: ${error}`);
    }
  }
}

/**
 * Show machine info
 */
async function showMachineInfo() {
  const workspaceRoot = process.cwd();
  const configDir = path.join(workspaceRoot, '.sce', 'config');
  const machineIdentifier = new MachineIdentifier(configDir);
  
  const info = await machineIdentifier.getMachineInfo();
  
  console.log(chalk.bold('Machine Identifier:'));
  console.log(`  ID: ${info.id}`);
  console.log(`  Hostname: ${info.hostname}`);
  console.log(`  Platform: ${info.platform}`);
  console.log(`  User: ${info.user}`);
  console.log(`  Created: ${info.createdAt}`);
}

module.exports = { registerLockCommands };
