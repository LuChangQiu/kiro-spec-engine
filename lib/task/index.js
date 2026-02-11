/**
 * Task module exports
 * @module lib/task
 */

const TaskClaimer = require('./task-claimer');
const { TaskStatusStore } = require('./task-status-store');

module.exports = {
  TaskClaimer,
  TaskStatusStore
};
