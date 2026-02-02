/**
 * Autonomous Engine
 * Central orchestrator for autonomous execution
 */

const StateManager = require('./state-manager');
const TaskQueueManager = require('./task-queue-manager');
const ErrorRecoveryManager = require('./error-recovery-manager');
const ProgressTracker = require('./progress-tracker');
const DecisionEngine = require('./decision-engine');
const { CheckpointManager, CHECKPOINT_TYPES } = require('./checkpoint-manager');
const { mergeConfigs } = require('./config-schema');
const path = require('path');

class AutonomousEngine {
  constructor(specName, config = {}) {
    this.specName = specName;
    this.config = config;
    
    // Initialize managers
    this.stateManager = new StateManager(specName);
    this.taskQueue = new TaskQueueManager();
    this.errorRecovery = new ErrorRecoveryManager(config.errorRecovery);
    this.progress = new ProgressTracker();
    this.decisions = new DecisionEngine();
    this.checkpoints = new CheckpointManager(config);
    
    // State
    this.isRunning = false;
    this.isPaused = false;
    this.currentTask = null;
    
    // Set pause callback for error recovery
    this.errorRecovery.setPauseCallback(async (data) => {
      await this.pause();
      await this.checkpoints.createCheckpoint(CHECKPOINT_TYPES.FATAL_ERROR, data);
    });
  }
  
  /**
   * Initialize engine
   * @param {Object} options - Initialization options
   */
  async initialize(options = {}) {
    await this.stateManager.initialize();
    await this.checkpoints.initialize();
    
    // Load or create state
    const existingState = await this.stateManager.loadState();
    if (existingState) {
      this.state = existingState;
    } else {
      this.state = this.stateManager.createInitialState({ config: this.config });
      await this.stateManager.saveState(this.state);
    }
    
    await this.progress.logAction('engine-initialized', { specName: this.specName });
  }
  
  /**
   * Start autonomous execution
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Engine is already running');
    }
    
    this.isRunning = true;
    this.isPaused = false;
    
    this.state.status.isRunning = true;
    this.state.status.isPaused = false;
    await this.stateManager.saveState(this.state);
    
    await this.progress.logAction('engine-started');
  }
  
  /**
   * Pause execution
   */
  async pause() {
    this.isPaused = true;
    
    this.state.status.isPaused = true;
    await this.stateManager.saveState(this.state);
    
    await this.progress.logAction('engine-paused');
  }
  
  /**
   * Resume execution
   */
  async resume() {
    if (!this.isPaused) {
      throw new Error('Engine is not paused');
    }
    
    this.isPaused = false;
    
    this.state.status.isPaused = false;
    await this.stateManager.saveState(this.state);
    
    await this.progress.logAction('engine-resumed');
  }
  
  /**
   * Stop execution
   */
  async stop() {
    this.isRunning = false;
    this.isPaused = false;
    
    this.state.status.isRunning = false;
    this.state.status.isPaused = false;
    await this.stateManager.saveState(this.state);
    
    await this.progress.logAction('engine-stopped');
  }
  
  /**
   * Execute task queue
   */
  async executeTaskQueue() {
    const tasksFile = path.join(process.cwd(), '.kiro', 'specs', this.specName, 'tasks.md');
    await this.taskQueue.loadTasks(tasksFile);
    
    const queueStatus = this.taskQueue.getQueueStatus();
    this.progress.updateTaskCounts(queueStatus.completed, queueStatus.total);
    
    await this.progress.updateProgress('implementation', 0);
    
    while (this.taskQueue.hasRemainingTasks() && this.isRunning && !this.isPaused) {
      const task = this.taskQueue.getNextTask();
      
      if (!task) {
        // No ready tasks, check if blocked
        const blocked = this.taskQueue.getBlockedTasks();
        if (blocked.length > 0) {
          await this.progress.logAction('tasks-blocked', { count: blocked.length });
          break;
        }
        break;
      }
      
      await this.executeTask(task);
      
      // Update progress
      const status = this.taskQueue.getQueueStatus();
      const progress = (status.completed / status.total) * 100;
      await this.progress.updateProgress('implementation', progress);
      this.progress.updateTaskCounts(status.completed, status.total);
    }
    
    return this.progress.getExecutionLog();
  }
  
  /**
   * Execute single task
   * @param {Object} task - Task to execute
   */
  async executeTask(task) {
    this.currentTask = task.id;
    this.progress.setCurrentTask(task.id);
    
    await this.progress.logAction('task-started', { taskId: task.id, title: task.title });
    
    try {
      // Mark task as in progress
      task.status = 'in-progress';
      
      // Simulate task execution (actual implementation would execute real task)
      // For MVP, we just mark as complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mark task as complete
      this.taskQueue.markTaskComplete(task.id);
      
      await this.progress.logAction('task-completed', { taskId: task.id });
      
    } catch (error) {
      await this.handleTaskError(task, error);
    }
  }
  
  /**
   * Handle task error
   * @param {Object} task - Task that failed
   * @param {Error} error - Error object
   */
  async handleTaskError(task, error) {
    await this.progress.logError(error, { taskId: task.id });
    
    // Attempt recovery
    const recovery = await this.errorRecovery.attemptRecovery(error, { task });
    
    if (recovery.success) {
      await this.progress.logAction('error-recovered', { 
        taskId: task.id,
        strategy: recovery.strategy
      });
      
      // Retry task
      await this.executeTask(task);
    } else {
      // Mark task as failed
      this.taskQueue.markTaskFailed(task.id, error);
      
      await this.progress.logError(error, { 
        taskId: task.id,
        success: false,
        attemptNumber: recovery.attemptNumber
      });
      
      if (recovery.requiresUserIntervention) {
        await this.pause();
      }
    }
  }
  
  /**
   * Create checkpoint
   * @param {string} type - Checkpoint type
   * @param {Object} data - Checkpoint data
   */
  async createCheckpoint(type, data = {}) {
    const checkpoint = await this.checkpoints.createCheckpoint(type, {
      ...data,
      phase: this.state.status.phase,
      state: this.state
    });
    
    this.state.checkpoints.latest = checkpoint.id;
    this.state.checkpoints.history.push(checkpoint.id);
    await this.stateManager.saveState(this.state);
    
    return checkpoint;
  }
  
  /**
   * Wait for user approval at checkpoint
   * @param {Object} checkpoint - Checkpoint object
   */
  async waitForUserApproval(checkpoint) {
    if (!checkpoint.requiresUserApproval) {
      return true;
    }
    
    await this.pause();
    return await this.checkpoints.waitForUserInput(checkpoint);
  }
  
  /**
   * Skip checkpoint
   * @param {Object} checkpoint - Checkpoint object
   */
  async skipCheckpoint(checkpoint) {
    await this.progress.logAction('checkpoint-skipped', { 
      checkpointId: checkpoint.id,
      type: checkpoint.type
    });
  }
  
  /**
   * Save current state
   */
  async saveState() {
    this.state.status.lastUpdated = new Date().toISOString();
    await this.stateManager.saveState(this.state);
  }
  
  /**
   * Load saved state
   */
  async loadState() {
    const state = await this.stateManager.loadState();
    if (state) {
      this.state = state;
    }
    return state;
  }
  
  /**
   * Create Spec autonomously from description
   * @param {string} featureDescription - Feature description
   * @returns {Object} - Creation result
   */
  async createSpecAutonomously(featureDescription) {
    await this.progress.logAction('spec-creation-started', { description: featureDescription });
    
    const result = {
      requirementsCreated: false,
      designCreated: false,
      tasksCreated: false,
      userConfirmationsRequested: 0
    };
    
    try {
      // Generate requirements
      await this.generateRequirements(featureDescription);
      result.requirementsCreated = true;
      
      // Generate design
      await this.generateDesign(featureDescription);
      result.designCreated = true;
      
      // Generate tasks
      await this.generateTasks(featureDescription);
      result.tasksCreated = true;
      
      await this.progress.logAction('spec-creation-completed');
      
    } catch (error) {
      await this.progress.logError(error, { phase: 'spec-creation' });
      throw error;
    }
    
    return result;
  }
  
  /**
   * Generate requirements document
   * @param {string} featureDescription - Feature description
   */
  async generateRequirements(featureDescription) {
    await this.progress.updateProgress('requirements', 0);
    
    // Simplified: In real implementation, this would use AI to generate requirements
    const requirements = `# Requirements: ${featureDescription}\n\n## User Stories\n\nTBD\n`;
    
    const fs = require('fs-extra');
    const reqPath = path.join(process.cwd(), '.kiro', 'specs', this.specName, 'requirements.md');
    await fs.writeFile(reqPath, requirements, 'utf-8');
    
    await this.progress.updateProgress('requirements', 100);
    await this.progress.logAction('requirements-generated');
  }
  
  /**
   * Generate design document
   * @param {string} featureDescription - Feature description
   */
  async generateDesign(featureDescription) {
    await this.progress.updateProgress('design', 0);
    
    // Simplified: In real implementation, this would use AI to generate design
    const design = `# Design: ${featureDescription}\n\n## Architecture\n\nTBD\n`;
    
    const fs = require('fs-extra');
    const designPath = path.join(process.cwd(), '.kiro', 'specs', this.specName, 'design.md');
    await fs.writeFile(designPath, design, 'utf-8');
    
    await this.progress.updateProgress('design', 100);
    await this.progress.logAction('design-generated');
  }
  
  /**
   * Generate tasks document
   * @param {string} featureDescription - Feature description
   */
  async generateTasks(featureDescription) {
    await this.progress.updateProgress('tasks', 0);
    
    // Simplified: In real implementation, this would use AI to generate tasks
    const tasks = `# Tasks: ${featureDescription}\n\n- [ ] 1. Implement feature\n`;
    
    const fs = require('fs-extra');
    const tasksPath = path.join(process.cwd(), '.kiro', 'specs', this.specName, 'tasks.md');
    await fs.writeFile(tasksPath, tasks, 'utf-8');
    
    await this.progress.updateProgress('tasks', 100);
    await this.progress.logAction('tasks-generated');
  }
  
  /**
   * Get current status
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      specName: this.specName,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentTask: this.currentTask,
      progress: this.progress.getCurrentStatus(),
      queueStatus: this.taskQueue.getQueueStatus()
    };
  }
}

module.exports = AutonomousEngine;
