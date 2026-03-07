function printCloseLoopControllerSummary(chalk, summary) {
  console.log(chalk.blue('Autonomous close-loop controller summary'));
  console.log(chalk.gray(`  Status: ${summary.status}`));
  console.log(chalk.gray(`  Cycles: ${summary.cycles_performed}/${summary.max_cycles}`));
  console.log(chalk.gray(`  Processed goals: ${summary.processed_goals}`));
  console.log(chalk.gray(`  Completed: ${summary.completed_goals}`));
  console.log(chalk.gray(`  Failed: ${summary.failed_goals}`));
  console.log(chalk.gray(`  Pending queue goals: ${summary.pending_goals}`));
  if (summary.dedupe_enabled) {
    console.log(chalk.gray(`  Dedupe dropped: ${summary.dedupe_dropped_goals || 0}`));
  }
  console.log(chalk.gray(`  Stop reason: ${summary.stop_reason}`));
  if (summary.lock_enabled && summary.lock_file) {
    console.log(chalk.gray(`  Lock: ${summary.lock_file}`));
  }
  if (summary.controller_session && summary.controller_session.file) {
    console.log(chalk.gray(`  Session: ${summary.controller_session.file}`));
  }
  if (summary.done_archive_file) {
    console.log(chalk.gray(`  Done archive: ${summary.done_archive_file}`));
  }
  if (summary.failed_archive_file) {
    console.log(chalk.gray(`  Failed archive: ${summary.failed_archive_file}`));
  }
  if (summary.output_file) {
    console.log(chalk.gray(`  Output: ${summary.output_file}`));
  }
}

module.exports = {
  printCloseLoopControllerSummary
};
