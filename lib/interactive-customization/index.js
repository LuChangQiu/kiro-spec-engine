'use strict';

const moquiAdapter = require('./moqui-interactive-adapter');
const changePlanGateCore = require('./change-plan-gate-core');

module.exports = {
  ...changePlanGateCore,
  ...moquiAdapter
};
