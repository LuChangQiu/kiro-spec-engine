/**
 * Progress Tracker
 * Real-time monitoring and reporting of autonomous execution
 */

const fs = require('fs-extra');
const path = require('path');

class ProgressTracker {
  constructor() {
    this.currentPhase = 'initialization';
    this.overallProgress = 0;
    this.phaseProgress = {
      requirements: 0,
      design: 0,
      tasks: 0,
      implementation: 0,
      qa: 0
    };
    this.executionLog = [];
    this.startTime = Date.now();
    this.currentTask = null;
    this.tasksCompleted = 0;
    this.tasksTotal = 0;
    this.errorsEncountered = 0;
    this.errorsResolved = 0;
    this.taskDurations = new Map(); // taskId -> duration
    this.historicalDataPath = path.join(process.cwd(), '.sce', 'auto', 'historical-data.json');
    this.historicalData = {
      taskDurations: {}, // taskType -> [durations]
      phaseDurations: {}, // phase -> [durations]
      errorRates: {} // taskType -> error count
    };
    
    // Load historical data
    this.loadHistoricalData();
  }
  
  /**
   * Update current phase
   * @param {string} phase - Phase name
   * @param {number} percentage - Progress percentage (0-100)
   */
  async updateProgress(phase, percentage) {
    this.currentPhase = phase;
    this.phaseProgress[phase] = Math.min(100, Math.max(0, percentage));
    
    // Calculate overall progress (weighted average)
    const weights = {
      requirements: 0.15,
      design: 0.15,
      tasks: 0.10,
      implementation: 0.50,
      qa: 0.10
    };
    
    this.overallProgress = Object.keys(weights).reduce((sum, p) => {
      return sum + (this.phaseProgress[p] * weights[p]);
    }, 0);
    
    await this.logAction('progress-update', {
      phase,
      percentage,
      overallProgress: this.overallProgress
    });
  }
  
  /**
   * Log an action
   * @param {string} action - Action type
   * @param {Object} details - Action details
   */
  async logAction(action, details = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'action',
      phase: this.currentPhase,
      task: this.currentTask,
      data: {
        message: action,
        details,
        duration: null
      },
      metadata: {
        attemptNumber: 1,
        success: true,
        impact: 'low'
      }
    };
    
    this.executionLog.push(entry);
    return entry;
  }
  
  /**
   * Log a decision
   * @param {Object} decision - Decision details
   */
  async logDecision(decision) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: 'decision',
      phase: this.currentPhase,
      task: this.currentTask,
      data: {
        message: decision.decision,
        details: {
          rationale: decision.rationale,
          alternatives: decision.alternatives || [],
          impact: decision.impact || 'medium'
        },
        duration: null
      },
      metadata: {
        attemptNumber: 1,
        success: true,
        impact: decision.impact || 'medium'
      }
    };
    
    this.executionLog.push(entry);
    return entry;
  }
  
  /**
   * Log an error and recovery attempt
   * @param {Error} error - Error object
   * @param {Object} recovery - Recovery details
   */
  async logError(error, recovery = {}) {
    this.errorsEncountered++;
    
    if (recovery.success) {
      this.errorsResolved++;
    }
    
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: recovery.success ? 'recovery' : 'error',
      phase: this.currentPhase,
      task: this.currentTask,
      data: {
        message: error.message,
        details: {
          errorType: error.name,
          stack: error.stack,
          recovery: recovery
        },
        duration: recovery.duration || null
      },
      metadata: {
        attemptNumber: recovery.attemptNumber || 1,
        success: recovery.success || false,
        impact: 'high'
      }
    };
    
    this.executionLog.push(entry);
    return entry;
  }
  
  /**
   * Set current task
   * @param {string} taskId - Task ID
   */
  setCurrentTask(taskId) {
    // Record start time for duration tracking
    if (this.currentTask && this.taskDurations.has(this.currentTask)) {
      const startTime = this.taskDurations.get(this.currentTask);
      const duration = Date.now() - startTime;
      
      // Extract task type (e.g., "2.1" -> "implementation")
      const taskType = this.inferTaskType(this.currentTask);
      
      // Record duration for estimation improvement
      this.recordTaskDuration(taskType, duration);
    }
    
    this.currentTask = taskId;
    this.taskDurations.set(taskId, Date.now());
  }
  
  /**
   * Infer task type from task ID
   * @param {string} taskId - Task ID
   * @returns {string} - Task type
   */
  inferTaskType(taskId) {
    // Simple heuristic: use first number as task type indicator
    const match = taskId.match(/^(\d+)/);
    if (!match) return 'unknown';
    
    const taskNum = parseInt(match[1]);
    
    // Map task numbers to types (based on common patterns)
    if (taskNum <= 2) return 'setup';
    if (taskNum <= 5) return 'core-implementation';
    if (taskNum <= 8) return 'feature-implementation';
    if (taskNum <= 12) return 'cli-implementation';
    if (taskNum <= 15) return 'integration';
    if (taskNum <= 17) return 'documentation';
    
    return 'other';
  }
  
  /**
   * Record task duration for learning
   * @param {string} taskType - Task type
   * @param {number} duration - Duration in milliseconds
   */
  async recordTaskDuration(taskType, duration) {
    if (!this.historicalData.taskDurations[taskType]) {
      this.historicalData.taskDurations[taskType] = [];
    }
    
    this.historicalData.taskDurations[taskType].push(duration);
    
    // Keep only last 100 entries per type
    if (this.historicalData.taskDurations[taskType].length > 100) {
      this.historicalData.taskDurations[taskType].shift();
    }
    
    await this.saveHistoricalData();
  }
  
  /**
   * Get estimated task duration based on historical data
   * @param {string} taskType - Task type
   * @returns {number} - Estimated duration in milliseconds
   */
  getEstimatedTaskDuration(taskType) {
    const durations = this.historicalData.taskDurations[taskType];
    
    if (!durations || durations.length === 0) {
      // Default estimates (in milliseconds)
      const defaults = {
        'setup': 60000, // 1 minute
        'core-implementation': 300000, // 5 minutes
        'feature-implementation': 600000, // 10 minutes
        'cli-implementation': 180000, // 3 minutes
        'integration': 240000, // 4 minutes
        'documentation': 120000, // 2 minutes
        'other': 300000 // 5 minutes
      };
      return defaults[taskType] || 300000;
    }
    
    // Calculate weighted average (more weight to recent data)
    const weights = durations.map((_, i) => i + 1);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    const weightedSum = durations.reduce((sum, duration, i) => {
      return sum + (duration * weights[i]);
    }, 0);
    
    return weightedSum / totalWeight;
  }
  
  /**
   * Load historical data from disk
   */
  async loadHistoricalData() {
    try {
      if (await fs.pathExists(this.historicalDataPath)) {
        this.historicalData = await fs.readJson(this.historicalDataPath);
      }
    } catch (error) {
      console.warn('Failed to load historical data:', error.message);
    }
  }
  
  /**
   * Save historical data to disk
   */
  async saveHistoricalData() {
    try {
      await fs.ensureDir(path.dirname(this.historicalDataPath));
      await fs.writeJson(this.historicalDataPath, this.historicalData, { spaces: 2 });
    } catch (error) {
      console.warn('Failed to save historical data:', error.message);
    }
  }
  
  /**
   * Update task counts
   * @param {number} completed - Completed tasks
   * @param {number} total - Total tasks
   */
  updateTaskCounts(completed, total) {
    this.tasksCompleted = completed;
    this.tasksTotal = total;
  }
  
  /**
   * Get current status
   * @returns {Object} - Current status
   */
  getCurrentStatus() {
    return {
      phase: this.currentPhase,
      overallProgress: Math.round(this.overallProgress),
      currentTask: this.currentTask,
      tasksCompleted: this.tasksCompleted,
      tasksTotal: this.tasksTotal,
      errorsEncountered: this.errorsEncountered,
      errorsResolved: this.errorsResolved,
      startedAt: new Date(this.startTime).toISOString(),
      estimatedCompletion: this.getEstimatedCompletion(),
      recentActions: this.getRecentActions(5)
    };
  }
  
  /**
   * Get progress summary
   * @returns {Object} - Progress summary
   */
  getProgressSummary() {
    const elapsed = Date.now() - this.startTime;
    const elapsedMinutes = Math.floor(elapsed / 60000);
    
    return {
      overallProgress: Math.round(this.overallProgress),
      phaseProgress: this.phaseProgress,
      currentPhase: this.currentPhase,
      tasksCompleted: this.tasksCompleted,
      tasksTotal: this.tasksTotal,
      tasksRemaining: this.tasksTotal - this.tasksCompleted,
      errorsEncountered: this.errorsEncountered,
      errorsResolved: this.errorsResolved,
      errorRecoveryRate: this.getErrorRecoveryRate(),
      elapsedTime: `${elapsedMinutes} minutes`,
      estimatedCompletion: this.getEstimatedCompletion()
    };
  }
  
  /**
   * Get detailed report
   * @returns {Object} - Detailed report
   */
  getDetailedReport() {
    return {
      summary: this.getProgressSummary(),
      timeline: this.getExecutionTimeline(),
      metrics: {
        taskCompletionRate: this.getTaskCompletionRate(),
        errorRecoveryRate: this.getErrorRecoveryRate(),
        averageTaskDuration: this.getAverageTaskDuration()
      },
      log: this.executionLog
    };
  }
  
  /**
   * Get execution timeline
   * @returns {Array} - Timeline entries
   */
  getExecutionTimeline() {
    return this.executionLog.map(entry => ({
      timestamp: entry.timestamp,
      type: entry.type,
      phase: entry.phase,
      message: entry.data.message,
      success: entry.metadata.success
    }));
  }
  
  /**
   * Get recent actions
   * @param {number} count - Number of recent actions
   * @returns {Array} - Recent actions
   */
  getRecentActions(count = 10) {
    return this.executionLog.slice(-count).map(entry => ({
      timestamp: entry.timestamp,
      type: entry.type,
      message: entry.data.message,
      success: entry.metadata.success
    }));
  }
  
  /**
   * Get task completion rate
   * @returns {number} - Completion rate (0-1)
   */
  getTaskCompletionRate() {
    if (this.tasksTotal === 0) return 0;
    return this.tasksCompleted / this.tasksTotal;
  }
  
  /**
   * Get error recovery rate
   * @returns {number} - Recovery rate (0-1)
   */
  getErrorRecoveryRate() {
    if (this.errorsEncountered === 0) return 1;
    return this.errorsResolved / this.errorsEncountered;
  }
  
  /**
   * Get average task duration
   * @returns {number} - Average duration in milliseconds
   */
  getAverageTaskDuration() {
    const taskActions = this.executionLog.filter(e => 
      e.type === 'action' && e.data.duration
    );
    
    if (taskActions.length === 0) return 0;
    
    const totalDuration = taskActions.reduce((sum, e) => sum + e.data.duration, 0);
    return totalDuration / taskActions.length;
  }
  
  /**
   * Get estimated completion time
   * @returns {string|null} - ISO timestamp or null
   */
  getEstimatedCompletion() {
    if (this.overallProgress === 0) return null;
    
    // Use historical data for better estimation
    const remainingTasks = this.tasksTotal - this.tasksCompleted;
    
    if (remainingTasks > 0 && this.currentTask) {
      const taskType = this.inferTaskType(this.currentTask);
      const avgDuration = this.getEstimatedTaskDuration(taskType);
      const estimatedRemaining = avgDuration * remainingTasks;
      
      const completionTime = new Date(Date.now() + estimatedRemaining);
      return completionTime.toISOString();
    }
    
    // Fallback to simple calculation
    const elapsed = Date.now() - this.startTime;
    const estimatedTotal = (elapsed / this.overallProgress) * 100;
    const remaining = estimatedTotal - elapsed;
    
    const completionTime = new Date(Date.now() + remaining);
    return completionTime.toISOString();
  }
  
  /**
   * Export report to file
   * @param {string} format - Format (json, markdown)
   * @param {string} outputPath - Output file path
   */
  async exportReport(format, outputPath) {
    const fs = require('fs-extra');
    const report = this.getDetailedReport();
    
    if (format === 'json') {
      await fs.writeJson(outputPath, report, { spaces: 2 });
    } else if (format === 'markdown') {
      const markdown = this.generateMarkdownReport(report);
      await fs.writeFile(outputPath, markdown, 'utf-8');
    }
  }
  
  /**
   * Generate markdown report
   * @param {Object} report - Report data
   * @returns {string} - Markdown content
   */
  generateMarkdownReport(report) {
    const { summary, timeline, metrics } = report;
    
    let md = '# Autonomous Execution Report\n\n';
    md += `**Generated**: ${new Date().toISOString()}\n\n`;
    
    md += '## Summary\n\n';
    md += `- **Overall Progress**: ${summary.overallProgress}%\n`;
    md += `- **Current Phase**: ${summary.currentPhase}\n`;
    md += `- **Tasks**: ${summary.tasksCompleted}/${summary.tasksTotal} completed\n`;
    md += `- **Errors**: ${summary.errorsResolved}/${summary.errorsEncountered} resolved\n`;
    md += `- **Elapsed Time**: ${summary.elapsedTime}\n`;
    md += `- **Estimated Completion**: ${summary.estimatedCompletion || 'N/A'}\n\n`;
    
    md += '## Phase Progress\n\n';
    for (const [phase, progress] of Object.entries(summary.phaseProgress)) {
      md += `- **${phase}**: ${progress}%\n`;
    }
    md += '\n';
    
    md += '## Metrics\n\n';
    md += `- **Task Completion Rate**: ${(metrics.taskCompletionRate * 100).toFixed(1)}%\n`;
    md += `- **Error Recovery Rate**: ${(metrics.errorRecoveryRate * 100).toFixed(1)}%\n`;
    md += `- **Average Task Duration**: ${(metrics.averageTaskDuration / 1000).toFixed(1)}s\n\n`;
    
    md += '## Timeline\n\n';
    for (const entry of timeline.slice(-20)) {
      const icon = entry.success ? '✅' : '❌';
      md += `- ${icon} **${entry.timestamp}** [${entry.type}] ${entry.message}\n`;
    }
    
    return md;
  }
}

module.exports = ProgressTracker;
