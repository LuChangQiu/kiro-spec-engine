const chalk = require('chalk');
const Table = require('cli-table3');

/**
 * OutputFormatter provides consistent formatting for command output
 * with color-coding and table support.
 */
class OutputFormatter {
  constructor() {
    this.chalk = chalk;
  }

  /**
   * Format data as table
   * @param {Object[]} data - Array of data objects
   * @param {Object} options - Table options
   * @param {string[]} options.head - Table header columns
   * @param {string[][]} options.rows - Table rows (optional, will be extracted from data if not provided)
   * @param {Object} options.style - Table style options (optional)
   * @returns {string} Formatted table string
   */
  formatTable(data, options = {}) {
    const tableConfig = {
      head: options.head || [],
      style: {
        head: ['cyan'],
        border: ['gray'],
        ...options.style
      }
    };

    const table = new Table(tableConfig);

    // If rows are provided directly, use them
    if (options.rows) {
      options.rows.forEach(row => table.push(row));
    } else if (Array.isArray(data) && data.length > 0) {
      // Otherwise, extract rows from data objects
      data.forEach(item => {
        const row = options.head.map(header => {
          const key = header.toLowerCase().replace(/\s+/g, '');
          return item[key] !== undefined ? String(item[key]) : '';
        });
        table.push(row);
      });
    }

    return table.toString();
  }

  /**
   * Format success message
   * @param {string} message - Success message
   * @returns {string} Formatted success message
   */
  success(message) {
    return chalk.green(`✅ ${message}`);
  }

  /**
   * Format error message
   * @param {string} message - Error message
   * @returns {string} Formatted error message
   */
  error(message) {
    return chalk.red(`❌ ${message}`);
  }

  /**
   * Format warning message
   * @param {string} message - Warning message
   * @returns {string} Formatted warning message
   */
  warning(message) {
    return chalk.yellow(`⚠️  ${message}`);
  }

  /**
   * Format info message
   * @param {string} message - Info message
   * @returns {string} Formatted info message
   */
  info(message) {
    return chalk.blue(`ℹ️  ${message}`);
  }

  /**
   * Create progress indicator
   * @param {string} message - Progress message
   * @returns {ProgressIndicator} Progress indicator object
   */
  createProgress(message) {
    return new ProgressIndicator(message);
  }
}

/**
 * ProgressIndicator provides a simple progress indicator for long-running operations
 */
class ProgressIndicator {
  constructor(message) {
    this.message = message;
    this.started = false;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.currentFrame = 0;
    this.interval = null;
  }

  /**
   * Start the progress indicator
   */
  start() {
    if (this.started) return;
    
    this.started = true;
    process.stdout.write(`${this.frames[0]} ${this.message}`);
    
    this.interval = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
    }, 80);
    if (this.interval && typeof this.interval.unref === 'function') {
      this.interval.unref();
    }
  }

  /**
   * Update the progress message
   * @param {string} message - New progress message
   */
  update(message) {
    this.message = message;
    if (this.started) {
      process.stdout.write(`\r${this.frames[this.currentFrame]} ${this.message}`);
    }
  }

  /**
   * Stop the progress indicator with a success message
   * @param {string} message - Success message (optional)
   */
  succeed(message) {
    this.stop();
    const finalMessage = message || this.message;
    console.log(chalk.green(`✅ ${finalMessage}`));
  }

  /**
   * Stop the progress indicator with an error message
   * @param {string} message - Error message (optional)
   */
  fail(message) {
    this.stop();
    const finalMessage = message || this.message;
    console.log(chalk.red(`❌ ${finalMessage}`));
  }

  /**
   * Stop the progress indicator with a warning message
   * @param {string} message - Warning message (optional)
   */
  warn(message) {
    this.stop();
    const finalMessage = message || this.message;
    console.log(chalk.yellow(`⚠️  ${finalMessage}`));
  }

  /**
   * Stop the progress indicator
   */
  stop() {
    if (!this.started) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    process.stdout.write('\r\x1b[K'); // Clear the line
    this.started = false;
  }
}

module.exports = OutputFormatter;
