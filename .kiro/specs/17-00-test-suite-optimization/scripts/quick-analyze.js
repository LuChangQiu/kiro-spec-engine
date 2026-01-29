/**
 * Quick analysis script to evaluate current test suite
 */

const path = require('path');
const fs = require('fs-extra');
const { loadConfig, findJavaScriptFiles, extractTestCases, writeJsonFile } = require('./utils');
const CoverageAnalyzer = require('./coverage-analyzer');

async function quickAnalyze() {
  console.log('🔍 Starting Quick Test Suite Analysis...\n');
  
  // Load configuration
  const configPath = path.join(__dirname, '../config.json');
  const config = await loadConfig(configPath);
  const testConfig = config.testSuiteOptimization;
  
  // 1. Analyze Integration Test Coverage
  console.log('📊 Step 1: Analyzing Integration Test Coverage');
  console.log('─'.repeat(60));
  
  const analyzer = new CoverageAnalyzer(testConfig);
  const coverageReport = await analyzer.analyzeCoverage(
    testConfig.paths.lib,
    testConfig.paths.tests
  );
  
  console.log(`Total Critical Paths: ${coverageReport.totalCriticalPaths}`);
  console.log(`Covered Paths: ${coverageReport.coveredPaths}`);
  console.log(`Coverage: ${coverageReport.coveragePercentage}%`);
  console.log('\nCoverage by Feature Area:');
  
  for (const [area, stats] of Object.entries(coverageReport.byFeatureArea)) {
    if (stats.total > 0) {
      console.log(`  ${area}: ${stats.covered}/${stats.total} (${stats.percentage}%)`);
    }
  }
  
  console.log('\n⚠️  Uncovered Critical Paths:');
  if (coverageReport.uncoveredPaths.length === 0) {
    console.log('  ✅ All critical paths are covered!');
  } else {
    coverageReport.uncoveredPaths.slice(0, 10).forEach(path => {
      console.log(`  - [${path.priority}] ${path.description}`);
    });
    if (coverageReport.uncoveredPaths.length > 10) {
      console.log(`  ... and ${coverageReport.uncoveredPaths.length - 10} more`);
    }
  }
  
  // 2. Analyze Test File Sizes
  console.log('\n\n📈 Step 2: Analyzing Test File Sizes');
  console.log('─'.repeat(60));
  
  const testFiles = await findJavaScriptFiles(testConfig.paths.tests, {
    recursive: true,
    exclude: ['node_modules', 'fixtures', 'helpers']
  });
  
  const testFileStats = [];
  for (const testFile of testFiles) {
    const content = await fs.readFile(testFile, 'utf-8');
    const lines = content.split('\n').length;
    
    // Count test cases
    const testMatches = content.match(/(?:it|test)\s*\(/g);
    const testCount = testMatches ? testMatches.length : 0;
    
    const relativePath = path.relative(process.cwd(), testFile);
    
    testFileStats.push({
      path: relativePath,
      tests: testCount,
      lines
    });
  }
  
  // Sort by test count
  testFileStats.sort((a, b) => b.tests - a.tests);
  
  console.log('\nTop 15 Test Files by Test Count:');
  testFileStats.slice(0, 15).forEach((file, index) => {
    const flag = file.tests > testConfig.thresholds.maxTestsPerFile ? '⚠️ ' : '  ';
    console.log(`${flag}${index + 1}. ${file.path}`);
    console.log(`     Tests: ${file.tests}, Lines: ${file.lines}`);
  });
  
  const excessiveFiles = testFileStats.filter(f => f.tests > testConfig.thresholds.maxTestsPerFile);
  console.log(`\n⚠️  Files exceeding threshold (${testConfig.thresholds.maxTestsPerFile} tests): ${excessiveFiles.length}`);
  
  // 3. Calculate Statistics
  console.log('\n\n📊 Step 3: Overall Statistics');
  console.log('─'.repeat(60));
  
  const totalTests = testFileStats.reduce((sum, f) => sum + f.tests, 0);
  const integrationTests = testFileStats
    .filter(f => f.path.includes('integration'))
    .reduce((sum, f) => sum + f.tests, 0);
  const unitTests = totalTests - integrationTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`  Unit Tests: ${unitTests} (${Math.round(unitTests/totalTests*100)}%)`);
  console.log(`  Integration Tests: ${integrationTests} (${Math.round(integrationTests/totalTests*100)}%)`);
  console.log(`\nTest Files: ${testFileStats.length}`);
  console.log(`  Files > ${testConfig.thresholds.maxTestsPerFile} tests: ${excessiveFiles.length}`);
  console.log(`  Average tests per file: ${Math.round(totalTests / testFileStats.length)}`);
  
  // 4. Generate Recommendations
  console.log('\n\n💡 Step 4: Recommendations');
  console.log('─'.repeat(60));
  
  const recommendations = [];
  
  if (coverageReport.coveragePercentage < testConfig.thresholds.criticalPathCoverage) {
    recommendations.push({
      priority: 'HIGH',
      type: 'Add Integration Tests',
      description: `Only ${coverageReport.coveragePercentage}% of critical paths are covered. Add integration tests for uncovered paths.`,
      impact: `${coverageReport.uncoveredPaths.length} critical paths need coverage`
    });
  }
  
  if (excessiveFiles.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'Consolidate Unit Tests',
      description: `${excessiveFiles.length} test files exceed the ${testConfig.thresholds.maxTestsPerFile} test threshold.`,
      impact: `Potential to reduce ${excessiveFiles.reduce((sum, f) => sum + (f.tests - testConfig.thresholds.maxTestsPerFile), 0)} tests`
    });
  }
  
  if (integrationTests < 20) {
    recommendations.push({
      priority: 'HIGH',
      type: 'Expand Integration Tests',
      description: `Only ${integrationTests} integration tests exist. This may not provide sufficient end-to-end coverage.`,
      impact: 'CI pipeline may miss critical regressions'
    });
  }
  
  recommendations.forEach((rec, index) => {
    console.log(`\n${index + 1}. [${rec.priority}] ${rec.type}`);
    console.log(`   ${rec.description}`);
    console.log(`   Impact: ${rec.impact}`);
  });
  
  // 5. Save Results
  console.log('\n\n💾 Saving Results...');
  console.log('─'.repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    coverage: coverageReport,
    testFileStats: testFileStats.slice(0, 20),
    statistics: {
      totalTests,
      unitTests,
      integrationTests,
      testFiles: testFileStats.length,
      excessiveFiles: excessiveFiles.length
    },
    recommendations
  };
  
  const outputPath = path.join(__dirname, '../results/quick-analysis.json');
  await writeJsonFile(outputPath, results);
  console.log(`✅ Results saved to: ${outputPath}`);
  
  // Generate markdown report
  const mdReport = generateMarkdownReport(results);
  const mdPath = path.join(__dirname, '../results/quick-analysis.md');
  await fs.writeFile(mdPath, mdReport);
  console.log(`✅ Report saved to: ${mdPath}`);
  
  console.log('\n✨ Analysis Complete!\n');
}

function generateMarkdownReport(results) {
  const { coverage, statistics, recommendations } = results;
  
  let md = '# Test Suite Quick Analysis Report\n\n';
  md += `**Generated:** ${new Date(results.timestamp).toLocaleString()}\n\n`;
  md += '---\n\n';
  
  md += '## 📊 Summary\n\n';
  md += `- **Total Tests:** ${statistics.totalTests}\n`;
  md += `- **Unit Tests:** ${statistics.unitTests} (${Math.round(statistics.unitTests/statistics.totalTests*100)}%)\n`;
  md += `- **Integration Tests:** ${statistics.integrationTests} (${Math.round(statistics.integrationTests/statistics.totalTests*100)}%)\n`;
  md += `- **Critical Path Coverage:** ${coverage.coveragePercentage}%\n`;
  md += `- **Test Files:** ${statistics.testFiles}\n`;
  md += `- **Files Exceeding Threshold:** ${statistics.excessiveFiles}\n\n`;
  
  md += '## 🎯 Critical Path Coverage\n\n';
  md += `**Overall:** ${coverage.coveredPaths}/${coverage.totalCriticalPaths} paths covered (${coverage.coveragePercentage}%)\n\n`;
  md += '### By Feature Area\n\n';
  md += '| Feature Area | Covered | Total | Coverage |\n';
  md += '|--------------|---------|-------|----------|\n';
  
  for (const [area, stats] of Object.entries(coverage.byFeatureArea)) {
    if (stats.total > 0) {
      md += `| ${area} | ${stats.covered} | ${stats.total} | ${stats.percentage}% |\n`;
    }
  }
  
  md += '\n### Uncovered Critical Paths\n\n';
  if (coverage.uncoveredPaths.length === 0) {
    md += '✅ All critical paths are covered!\n\n';
  } else {
    coverage.uncoveredPaths.slice(0, 15).forEach(path => {
      md += `- **[${path.priority}]** ${path.description}\n`;
    });
    if (coverage.uncoveredPaths.length > 15) {
      md += `\n*... and ${coverage.uncoveredPaths.length - 15} more*\n`;
    }
  }
  
  md += '\n## 📈 Test File Analysis\n\n';
  md += '### Top Test Files by Test Count\n\n';
  md += '| File | Tests | Lines |\n';
  md += '|------|-------|-------|\n';
  
  results.testFileStats.slice(0, 15).forEach(file => {
    const flag = file.tests > 50 ? '⚠️ ' : '';
    md += `| ${flag}${file.path} | ${file.tests} | ${file.lines} |\n`;
  });
  
  md += '\n## 💡 Recommendations\n\n';
  recommendations.forEach((rec, index) => {
    md += `### ${index + 1}. [${rec.priority}] ${rec.type}\n\n`;
    md += `${rec.description}\n\n`;
    md += `**Impact:** ${rec.impact}\n\n`;
  });
  
  md += '---\n\n';
  md += '*Generated by Test Suite Optimizer (Spec 17-00)*\n';
  
  return md;
}

// Run analysis
quickAnalyze().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
