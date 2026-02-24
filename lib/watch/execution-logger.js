const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');

/**
 * ExecutionLogger - 执行日志记录器
 * 
 * 记录所有自动化执行，跟踪指标，管理日志轮转
 */
class ExecutionLogger extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      logDir: config.logDir || '.sce/watch/logs',
      logFile: config.logFile || 'execution.log',
      maxLogSize: config.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: config.maxLogFiles || 5,
      logLevel: config.logLevel || 'info', // 'debug', 'info', 'warn', 'error'
      enableRotation: config.enableRotation !== false,
      enableMetrics: config.enableMetrics !== false,
      ...config
    };
    
    // 日志级别优先级
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    // 指标数据
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
      averageDuration: 0,
      timeSaved: 0, // 估算节省的时间
      lastExecution: null,
      executionsByAction: {},
      errorsByType: {}
    };
    
    // 错误记录
    this.errors = [];
    this.maxErrors = config.maxErrors || 100;
    
    // 确保日志目录存在
    this._ensureLogDir();
  }

  /**
   * 确保日志目录存在
   * 
   * @private
   */
  _ensureLogDir() {
    try {
      fs.ensureDirSync(this.config.logDir);
    } catch (error) {
      this.emit('error', {
        message: 'Failed to create log directory',
        error,
        timestamp: new Date()
      });
    }
  }

  /**
   * 记录日志
   * 
   * @param {string} level - 日志级别
   * @param {string} event - 事件类型
   * @param {Object} data - 日志数据
   */
  log(level, event, data = {}) {
    // 检查日志级别
    if (!this._shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...data
    };

    // 写入日志文件
    this._writeLog(logEntry);

    // 更新指标
    if (this.config.enableMetrics) {
      this._updateMetrics(event, data);
    }

    // 记录错误
    if (level === 'error') {
      this._recordError(logEntry);
    }

    // 触发事件
    this.emit('log', logEntry);
    this.emit(`log:${level}`, logEntry);

    // 检查是否需要轮转
    if (this.config.enableRotation) {
      this._checkRotation();
    }
  }

  /**
   * 记录调试信息
   * 
   * @param {string} event - 事件类型
   * @param {Object} data - 数据
   */
  debug(event, data) {
    this.log('debug', event, data);
  }

  /**
   * 记录信息
   * 
   * @param {string} event - 事件类型
   * @param {Object} data - 数据
   */
  info(event, data) {
    this.log('info', event, data);
  }

  /**
   * 记录警告
   * 
   * @param {string} event - 事件类型
   * @param {Object} data - 数据
   */
  warn(event, data) {
    this.log('warn', event, data);
  }

  /**
   * 记录错误
   * 
   * @param {string} event - 事件类型
   * @param {Object} data - 数据
   */
  error(event, data) {
    this.log('error', event, data);
  }

  /**
   * 检查是否应该记录
   * 
   * @private
   * @param {string} level - 日志级别
   * @returns {boolean} 是否应该记录
   */
  _shouldLog(level) {
    const currentLevel = this.logLevels[this.config.logLevel] || 1;
    const messageLevel = this.logLevels[level] || 1;
    return messageLevel >= currentLevel;
  }

  /**
   * 写入日志
   * 
   * @private
   * @param {Object} logEntry - 日志条目
   */
  _writeLog(logEntry) {
    try {
      const logPath = path.join(this.config.logDir, this.config.logFile);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logPath, logLine, 'utf8');
    } catch (error) {
      this.emit('error', {
        message: 'Failed to write log',
        error,
        timestamp: new Date()
      });
    }
  }

  /**
   * 更新指标
   * 
   * @private
   * @param {string} event - 事件类型
   * @param {Object} data - 数据
   */
  _updateMetrics(event, data) {
    // 更新执行计数
    if (event === 'execution:success' || event === 'execution:error') {
      this.metrics.totalExecutions++;
      this.metrics.lastExecution = new Date();

      if (event === 'execution:success') {
        this.metrics.successfulExecutions++;
      } else {
        this.metrics.failedExecutions++;
      }

      // 更新持续时间
      if (data.duration) {
        this.metrics.totalDuration += data.duration;
        this.metrics.averageDuration = 
          this.metrics.totalDuration / this.metrics.totalExecutions;
      }

      // 按动作统计
      if (data.command) {
        const action = data.command.split(' ')[0]; // 获取命令的第一部分
        if (!this.metrics.executionsByAction[action]) {
          this.metrics.executionsByAction[action] = {
            count: 0,
            success: 0,
            failed: 0
          };
        }
        this.metrics.executionsByAction[action].count++;
        if (event === 'execution:success') {
          this.metrics.executionsByAction[action].success++;
        } else {
          this.metrics.executionsByAction[action].failed++;
        }
      }

      // 估算节省的时间（假设手动执行需要30秒）
      if (event === 'execution:success') {
        this.metrics.timeSaved += 30000; // 30 seconds in ms
      }
    }

    // 按错误类型统计
    if (event === 'execution:error' && data.error) {
      const errorType = data.error.split(':')[0] || 'Unknown';
      this.metrics.errorsByType[errorType] = 
        (this.metrics.errorsByType[errorType] || 0) + 1;
    }
  }

  /**
   * 记录错误
   * 
   * @private
   * @param {Object} logEntry - 日志条目
   */
  _recordError(logEntry) {
    this.errors.push(logEntry);

    // 限制错误记录数量
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
  }

  /**
   * 检查是否需要轮转
   * 
   * @private
   */
  _checkRotation() {
    try {
      const logPath = path.join(this.config.logDir, this.config.logFile);
      
      if (!fs.existsSync(logPath)) {
        return;
      }

      const stats = fs.statSync(logPath);
      
      if (stats.size >= this.config.maxLogSize) {
        this.rotate();
      }
    } catch (error) {
      this.emit('error', {
        message: 'Failed to check log rotation',
        error,
        timestamp: new Date()
      });
    }
  }

  /**
   * 轮转日志
   */
  rotate() {
    try {
      const logPath = path.join(this.config.logDir, this.config.logFile);
      
      if (!fs.existsSync(logPath)) {
        return;
      }

      // 删除最老的日志（如果存在）
      const oldestPath = path.join(
        this.config.logDir,
        `${this.config.logFile}.${this.config.maxLogFiles}`
      );
      if (fs.existsSync(oldestPath)) {
        fs.removeSync(oldestPath);
      }

      // 轮转现有日志文件
      for (let i = this.config.maxLogFiles - 1; i >= 1; i--) {
        const oldPath = path.join(
          this.config.logDir, 
          `${this.config.logFile}.${i}`
        );
        const newPath = path.join(
          this.config.logDir, 
          `${this.config.logFile}.${i + 1}`
        );

        if (fs.existsSync(oldPath)) {
          fs.moveSync(oldPath, newPath, { overwrite: true });
        }
      }

      // 移动当前日志
      const rotatedPath = path.join(
        this.config.logDir, 
        `${this.config.logFile}.1`
      );
      fs.moveSync(logPath, rotatedPath, { overwrite: true });

      this.emit('rotated', {
        timestamp: new Date(),
        rotatedFile: rotatedPath
      });

    } catch (error) {
      this.emit('error', {
        message: 'Failed to rotate logs',
        error,
        timestamp: new Date()
      });
    }
  }

  /**
   * 获取指标
   * 
   * @returns {Object} 指标数据
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExecutions > 0
        ? (this.metrics.successfulExecutions / this.metrics.totalExecutions * 100).toFixed(2) + '%'
        : '0%',
      timeSavedFormatted: this._formatDuration(this.metrics.timeSaved)
    };
  }

  /**
   * 获取错误列表
   * 
   * @param {number} limit - 限制数量
   * @returns {Array} 错误列表
   */
  getErrors(limit = null) {
    if (limit) {
      return this.errors.slice(-limit);
    }
    return [...this.errors];
  }

  /**
   * 清除错误
   */
  clearErrors() {
    this.errors = [];
    this.emit('errors:cleared');
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalDuration: 0,
      averageDuration: 0,
      timeSaved: 0,
      lastExecution: null,
      executionsByAction: {},
      errorsByType: {}
    };

    this.emit('metrics:reset');
  }

  /**
   * 导出指标到文件
   * 
   * @param {string} format - 格式 ('json' 或 'csv')
   * @param {string} outputPath - 输出路径
   * @returns {Promise<void>}
   */
  async exportMetrics(format = 'json', outputPath = null) {
    const metrics = this.getMetrics();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (!outputPath) {
      outputPath = path.join(
        this.config.logDir,
        `metrics-${timestamp}.${format}`
      );
    }

    try {
      if (format === 'json') {
        await fs.writeJson(outputPath, metrics, { spaces: 2 });
      } else if (format === 'csv') {
        const csv = this._metricsToCSV(metrics);
        await fs.writeFile(outputPath, csv, 'utf8');
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      this.emit('metrics:exported', {
        format,
        outputPath,
        timestamp: new Date()
      });

      return outputPath;
    } catch (error) {
      this.emit('error', {
        message: 'Failed to export metrics',
        error,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * 将指标转换为 CSV
   * 
   * @private
   * @param {Object} metrics - 指标数据
   * @returns {string} CSV 字符串
   */
  _metricsToCSV(metrics) {
    const lines = [];
    
    // 基本指标
    lines.push('Metric,Value');
    lines.push(`Total Executions,${metrics.totalExecutions}`);
    lines.push(`Successful Executions,${metrics.successfulExecutions}`);
    lines.push(`Failed Executions,${metrics.failedExecutions}`);
    lines.push(`Success Rate,${metrics.successRate}`);
    lines.push(`Average Duration,${metrics.averageDuration.toFixed(2)}ms`);
    lines.push(`Time Saved,${metrics.timeSavedFormatted}`);
    
    return lines.join('\n');
  }

  /**
   * 格式化持续时间
   * 
   * @private
   * @param {number} ms - 毫秒
   * @returns {string} 格式化的持续时间
   */
  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 读取日志
   * 
   * @param {number} lines - 读取的行数
   * @returns {Promise<Array>} 日志条目数组
   */
  async readLogs(lines = 100) {
    try {
      const logPath = path.join(this.config.logDir, this.config.logFile);
      
      if (!fs.existsSync(logPath)) {
        return [];
      }

      const content = await fs.readFile(logPath, 'utf8');
      const allLines = content.trim().split('\n').filter(line => line);
      
      // 获取最后 N 行
      const selectedLines = allLines.slice(-lines);
      
      // 解析 JSON
      return selectedLines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          return { error: 'Failed to parse log line', line };
        }
      });
    } catch (error) {
      this.emit('error', {
        message: 'Failed to read logs',
        error,
        timestamp: new Date()
      });
      return [];
    }
  }

  /**
   * 获取配置
   * 
   * @returns {Object} 配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 设置日志级别
   * 
   * @param {string} level - 日志级别
   */
  setLogLevel(level) {
    if (!this.logLevels.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }

    this.config.logLevel = level;
    this.emit('config:updated', { logLevel: level });
  }
}

module.exports = ExecutionLogger;
