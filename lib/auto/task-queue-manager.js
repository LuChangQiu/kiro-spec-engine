/**
 * Task Queue Manager
 * Manages task execution order, dependencies, and status tracking
 */

const fs = require('fs-extra');
const path = require('path');

class TaskQueueManager {
  constructor() {
    this.tasks = [];
    this.taskMap = new Map(); // id -> task
    this.dependencyGraph = new Map(); // id -> [dependent task ids]
  }
  
  /**
   * Load tasks from tasks.md file
   * @param {string} tasksFilePath - Path to tasks.md
   */
  async loadTasks(tasksFilePath) {
    const content = await fs.readFile(tasksFilePath, 'utf-8');
    const tasks = this.parseTasks(content);
    
    for (const task of tasks) {
      this.addTask(task);
    }
    
    this.analyzeDependencies();
  }
  
  /**
   * Parse tasks from markdown content
   * @param {string} content - Markdown content
   * @returns {Array} - Parsed tasks
   */
  parseTasks(content) {
    const tasks = [];
    const lines = content.split('\n');
    const taskRegex = /^- \[([ x\-~])\](\*)?\s+(\d+(?:\.\d+)?)\s+(.+)/;
    
    for (const line of lines) {
      const match = line.match(taskRegex);
      if (match) {
        const [, status, optional, id, title] = match;
        
        const taskStatus = this.parseStatus(status);
        const isOptional = optional === '*';
        
        tasks.push({
          id,
          title: title.trim(),
          status: taskStatus,
          priority: this.calculatePriority(id),
          dependencies: this.extractDependencies(title),
          optional: isOptional,
          attempts: 0,
          error: null,
          startedAt: null,
          completedAt: null
        });
      }
    }
    
    return tasks;
  }
  
  /**
   * Parse task status from checkbox
   * @param {string} checkbox - Checkbox character
   * @returns {string} - Status
   */
  parseStatus(checkbox) {
    switch (checkbox) {
      case 'x': return 'completed';
      case '-': return 'in-progress';
      case '~': return 'queued';
      default: return 'queued';
    }
  }
  
  /**
   * Calculate task priority based on ID
   * @param {string} id - Task ID
   * @returns {number} - Priority (1-10)
   */
  calculatePriority(id) {
    // Earlier tasks have higher priority
    const parts = id.split('.');
    const major = parseInt(parts[0]) || 0;
    return Math.max(1, 11 - major);
  }
  
  /**
   * Extract dependencies from task title
   * @param {string} title - Task title
   * @returns {Array} - Dependency task IDs
   */
  extractDependencies(title) {
    // Look for "depends on X.Y" or "after X.Y" patterns
    const depRegex = /(?:depends on|after|requires)\s+(\d+(?:\.\d+)?)/gi;
    const dependencies = [];
    let match;
    
    while ((match = depRegex.exec(title)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }
  
  /**
   * Add task to queue
   * @param {Object} task - Task to add
   */
  addTask(task) {
    this.tasks.push(task);
    this.taskMap.set(task.id, task);
  }
  
  /**
   * Get next ready task
   * @returns {Object|null} - Next task or null
   */
  getNextTask() {
    // Filter ready tasks (dependencies satisfied, not completed/failed)
    const readyTasks = this.tasks.filter(task => 
      task.status === 'queued' && 
      !task.optional &&
      this.isTaskReady(task.id)
    );
    
    if (readyTasks.length === 0) {
      return null;
    }
    
    // Sort by priority (higher first)
    readyTasks.sort((a, b) => b.priority - a.priority);
    
    return readyTasks[0];
  }
  
  /**
   * Check if task is ready to execute
   * @param {string} taskId - Task ID
   * @returns {boolean}
   */
  isTaskReady(taskId) {
    const task = this.taskMap.get(taskId);
    if (!task) return false;
    
    // Check all dependencies are completed
    for (const depId of task.dependencies) {
      const depTask = this.taskMap.get(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Mark task as complete
   * @param {string} taskId - Task ID
   */
  markTaskComplete(taskId) {
    const task = this.taskMap.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
    }
  }
  
  /**
   * Mark task as failed
   * @param {string} taskId - Task ID
   * @param {Error} error - Error that caused failure
   */
  markTaskFailed(taskId, error) {
    const task = this.taskMap.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
      task.attempts++;
      
      // Block dependent tasks
      this.blockDependentTasks(taskId);
    }
  }
  
  /**
   * Block tasks that depend on failed task
   * @param {string} taskId - Failed task ID
   */
  blockDependentTasks(taskId) {
    const dependents = this.dependencyGraph.get(taskId) || [];
    for (const depId of dependents) {
      const task = this.taskMap.get(depId);
      if (task && task.status === 'queued') {
        task.status = 'blocked';
      }
    }
  }
  
  /**
   * Analyze dependencies and build dependency graph
   */
  analyzeDependencies() {
    // Build reverse dependency graph (task -> tasks that depend on it)
    for (const task of this.tasks) {
      for (const depId of task.dependencies) {
        if (!this.dependencyGraph.has(depId)) {
          this.dependencyGraph.set(depId, []);
        }
        this.dependencyGraph.get(depId).push(task.id);
      }
    }
    
    // Detect circular dependencies
    this.detectCircularDependencies();
  }
  
  /**
   * Detect circular dependencies
   * @throws {Error} - If circular dependency detected
   */
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (taskId) => {
      visited.add(taskId);
      recursionStack.add(taskId);
      
      const task = this.taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (!visited.has(depId)) {
            if (hasCycle(depId)) {
              return true;
            }
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }
      
      recursionStack.delete(taskId);
      return false;
    };
    
    for (const task of this.tasks) {
      if (!visited.has(task.id)) {
        if (hasCycle(task.id)) {
          throw new Error(`Circular dependency detected involving task ${task.id}`);
        }
      }
    }
  }
  
  /**
   * Set task priority
   * @param {string} taskId - Task ID
   * @param {number} priority - Priority (1-10)
   */
  setPriority(taskId, priority) {
    const task = this.taskMap.get(taskId);
    if (task) {
      task.priority = Math.max(1, Math.min(10, priority));
    }
  }
  
  /**
   * Reorder queue based on priorities
   */
  reorderQueue() {
    this.tasks.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Get queue status
   * @returns {Object} - Queue status
   */
  getQueueStatus() {
    return {
      total: this.tasks.length,
      queued: this.tasks.filter(t => t.status === 'queued').length,
      inProgress: this.tasks.filter(t => t.status === 'in-progress').length,
      completed: this.tasks.filter(t => t.status === 'completed').length,
      failed: this.tasks.filter(t => t.status === 'failed').length,
      blocked: this.tasks.filter(t => t.status === 'blocked').length
    };
  }
  
  /**
   * Get completed tasks
   * @returns {Array} - Completed tasks
   */
  getCompletedTasks() {
    return this.tasks.filter(t => t.status === 'completed');
  }
  
  /**
   * Get failed tasks
   * @returns {Array} - Failed tasks
   */
  getFailedTasks() {
    return this.tasks.filter(t => t.status === 'failed');
  }
  
  /**
   * Get remaining tasks
   * @returns {Array} - Remaining tasks
   */
  getRemainingTasks() {
    return this.tasks.filter(t => 
      t.status === 'queued' || 
      t.status === 'in-progress' || 
      t.status === 'blocked'
    );
  }
  
  /**
   * Get blocked tasks
   * @returns {Array} - Blocked tasks
   */
  getBlockedTasks() {
    return this.tasks.filter(t => t.status === 'blocked');
  }
  
  /**
   * Check if queue has remaining tasks
   * @returns {boolean}
   */
  hasRemainingTasks() {
    return this.getRemainingTasks().length > 0;
  }
}

module.exports = TaskQueueManager;
