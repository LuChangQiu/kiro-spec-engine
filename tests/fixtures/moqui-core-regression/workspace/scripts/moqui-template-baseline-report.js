#!/usr/bin/env node
'use strict';

const path = require('path');

const rootScriptPath = path.resolve(
  __dirname,
  '../../../../../scripts/moqui-template-baseline-report.js'
);

require(rootScriptPath);
