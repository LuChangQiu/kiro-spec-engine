# Design Document: Test Suite Optimization

## Overview

This design addresses the optimization of the kiro-spec-engine test suite to balance comprehensive quality validation with fast CI/CD feedback. The current test suite contains 1389 tests running in ~21 seconds, but the CI pipeline only runs 10 integration tests in ~15 seconds. This design provides a systematic approach to:

1. Evaluate integration test coverage adequacy
2. Identify and consolidate redundant unit tests
3. Establish clear test classification guidelines
4. Maintain CI/CD performance under 20 seconds
5. Ensure critical paths are properly validated

The optimization will be achieved through static analysis tools that analyze the codebase and test suite, generating actionable recommendations without requiring manual review of every test.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Suite Optimizer                      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Coverage   │  │  Redundancy  │  │     Test     │
    │   Analyzer   │  │   Analyzer   │  │  Classifier  │
    └──────────────┘  └──────────────┘  └──────────────┘
                │             │             │
                └─────────────┼─────────────┘
                              ▼
                    ┌──────────────────┐
                    │  Report Generator│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Recommendations  │
                    │   (JSON/MD)      │
                    └──────────────────┘
```

### Component Responsibilities

1. **Coverage Analyzer**: Identifies critical paths and maps them to existing integration tests
2. **Redundancy Analyzer**: Detects duplicate or excessive test cases within test files
3. **Test Classifier**: Categorizes tests as unit vs integration based on dependencies
4. **Report Generator**: Produces actionable reports with specific recommendations

## Components and Interfaces

### 1. Coverage Analyzer

**Purpose**: Identify critical paths in the codebase and determine which lack integration test coverage.

**Interface**:
```javascript
class CoverageAnalyzer {
  /**
   * Analyze codebase to identify critical paths
   * @param {string} libPath - Path to lib directory
   * @param {string} testsPath - Path to tests directory
   * @returns {Promise<CoverageReport>}
   */
  async analyzeCoverage(libPath, testsPath);
  
  /**
   * Identify critical paths by feature area
   * @param {string} libPath - Path to lib directory
   * @returns {Promise<CriticalPath[]>}
   */
  async identifyCriticalPaths(libPath);
  
  /**
   * Map integration tests to critical paths
   * @param {CriticalPath[]} paths - Critical paths
   * @param {string} integrationTestsPath - Path to integration tests
   * @returns {Promise<CoverageMapping>}
   */
  async mapTestsToPaths(paths, integrationTestsPath);
}

interface CriticalPath {
  id: string;
  featureArea: string; // 'workspace', 'adoption', 'governance', etc.
  description: string;
  entryPoints: string[]; // File paths
  dependencies: string[]; // Other modules involved
  priority: 'high' | 'medium' | 'low';
}

interface CoverageReport {
  totalCriticalPaths: number;
  coveredPaths: number;
  uncoveredPaths: CriticalPath[];
  coveragePercentage: number;
  byFeatureArea: {
    [featureArea: string]: {
      total: number;
      covered: number;
      percentage: number;
    }
  };
}
```

**Critical Path Identification Strategy**:
- **Entry Points**: Commands in `lib/commands/` directory
- **Feature Areas**: Based on `lib/` subdirectories (workspace, adoption, governance, operations, watch)
- **Priority Assignment**:
  - High: User-facing commands, data persistence operations
  - Medium: Configuration management, validation logic
  - Low: Utility functions, formatting operations

### 2. Redundancy Analyzer

**Purpose**: Identify redundant or excessive test cases that can be consolidated or removed.

**Interface**:
```javascript
class RedundancyAnalyzer {
  /**
   * Analyze test files for redundancy
   * @param {string} testsPath - Path to tests directory
   * @returns {Promise<RedundancyReport>}
   */
  async analyzeRedundancy(testsPath);
  
  /**
   * Detect similar test cases within a file
   * @param {string} testFilePath - Path to test file
   * @returns {Promise<SimilarityGroup[]>}
   */
  async detectSimilarTests(testFilePath);
  
  /**
   * Identify tests with excessive assertions
   * @param {string} testFilePath - Path to test file
   * @returns {Promise<ExcessiveTest[]>}
   */
  async identifyExcessiveTests(testFilePath);
}

interface RedundancyReport {
  filesAnalyzed: number;
  filesWithExcessiveTests: TestFileAnalysis[];
  totalRedundantTests: number;
  estimatedTimeSavings: number; // in seconds
  recommendations: Recommendation[];
}

interface TestFileAnalysis {
  filePath: string;
  testCount: number;
  redundancyScore: number; // 0-100
  similarityGroups: SimilarityGroup[];
  excessiveTests: ExcessiveTest[];
  recommendations: string[];
}

interface SimilarityGroup {
  tests: string[]; // Test names
  similarity: number; // 0-100
  reason: string; // Why they're similar
  consolidationSuggestion: string;
}

interface ExcessiveTest {
  testName: string;
  assertionCount: number;
  lineCount: number;
  suggestion: string;
}

interface Recommendation {
  type: 'consolidate' | 'remove' | 'split' | 'simplify';
  filePath: string;
  testNames: string[];
  reason: string;
  expectedTimeSavings: number;
  priority: 'high' | 'medium' | 'low';
}
```

**Redundancy Detection Strategies**:
1. **Structural Similarity**: Compare test structure (setup, assertions, teardown)
2. **Code Coverage Overlap**: Identify tests covering identical code paths
3. **Assertion Patterns**: Detect tests with similar assertion sequences
4. **Edge Case Duplication**: Find multiple tests for the same edge case

### 3. Test Classifier

**Purpose**: Classify tests as unit or integration based on their dependencies and scope.

**Interface**:
```javascript
class TestClassifier {
  /**
   * Classify all tests in the test suite
   * @param {string} testsPath - Path to tests directory
   * @returns {Promise<ClassificationReport>}
   */
  async classifyTests(testsPath);
  
  /**
   * Analyze a single test file
   * @param {string} testFilePath - Path to test file
   * @returns {Promise<TestClassification>}
   */
  async analyzeTestFile(testFilePath);
  
  /**
   * Determine if a test should be integration or unit
   * @param {TestCase} testCase - Test case to classify
   * @returns {TestType}
   */
  classifyTestCase(testCase);
}

interface ClassificationReport {
  totalTests: number;
  unitTests: number;
  integrationTests: number;
  misclassifiedTests: MisclassifiedTest[];
  recommendations: ClassificationRecommendation[];
}

interface TestClassification {
  filePath: string;
  currentLocation: 'unit' | 'integration';
  suggestedLocation: 'unit' | 'integration';
  testCases: TestCaseClassification[];
}

interface TestCaseClassification {
  testName: string;
  type: 'unit' | 'integration';
  confidence: number; // 0-100
  reasons: string[];
  dependencies: string[]; // External dependencies detected
}

interface MisclassifiedTest {
  filePath: string;
  testName: string;
  currentLocation: 'unit' | 'integration';
  suggestedLocation: 'unit' | 'integration';
  reason: string;
}

interface ClassificationRecommendation {
  action: 'move' | 'split' | 'keep';
  filePath: string;
  targetLocation: string;
  reason: string;
}
```

**Classification Criteria**:

**Unit Test Indicators**:
- No file system operations (or all mocked)
- No external process execution
- Tests single function/class
- Fast execution (< 100ms)
- No real dependencies

**Integration Test Indicators**:
- Real file system operations
- Multiple components interacting
- External process execution
- Tests end-to-end workflows
- Moderate execution time (< 5s)

### 4. Report Generator

**Purpose**: Generate comprehensive reports with actionable recommendations.

**Interface**:
```javascript
class ReportGenerator {
  /**
   * Generate comprehensive optimization report
   * @param {CoverageReport} coverage - Coverage analysis
   * @param {RedundancyReport} redundancy - Redundancy analysis
   * @param {ClassificationReport} classification - Classification analysis
   * @returns {Promise<OptimizationReport>}
   */
  async generateReport(coverage, redundancy, classification);
  
  /**
   * Export report in specified format
   * @param {OptimizationReport} report - Report to export
   * @param {string} format - 'json' | 'markdown' | 'html'
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportReport(report, format, outputPath);
  
  /**
   * Generate prioritized action plan
   * @param {OptimizationReport} report - Optimization report
   * @returns {ActionPlan}
   */
  generateActionPlan(report);
}

interface OptimizationReport {
  summary: {
    currentState: TestSuiteMetrics;
    projectedState: TestSuiteMetrics;
    estimatedImprovements: Improvements;
  };
  coverage: CoverageReport;
  redundancy: RedundancyReport;
  classification: ClassificationReport;
  actionPlan: ActionPlan;
  generatedAt: string;
}

interface TestSuiteMetrics {
  totalTests: number;
  unitTests: number;
  integrationTests: number;
  executionTime: number;
  ciExecutionTime: number;
  coveragePercentage: number;
}

interface Improvements {
  testsRemoved: number;
  testsConsolidated: number;
  integrationTestsAdded: number;
  timeSaved: number;
  ciTimeSaved: number;
}

interface ActionPlan {
  highPriority: Action[];
  mediumPriority: Action[];
  lowPriority: Action[];
  estimatedTotalTime: number; // hours
}

interface Action {
  id: string;
  type: 'add_integration_test' | 'consolidate_tests' | 'remove_test' | 'move_test';
  description: string;
  filePath: string;
  details: any;
  estimatedTime: number; // minutes
  impact: 'high' | 'medium' | 'low';
}
```

## Data Models

### Test Suite Configuration

```javascript
interface TestSuiteConfig {
  ciConfig: {
    maxExecutionTime: number; // seconds
    testPattern: string;
    parallel: boolean;
    bail: boolean;
  };
  localConfig: {
    maxExecutionTime: number; // seconds
    testPattern: string;
    coverage: boolean;
  };
  thresholds: {
    maxTestsPerFile: number;
    maxAssertionsPerTest: number;
    minCoveragePercentage: number;
    criticalPathCoverage: number;
  };
  featureAreas: string[];
}
```

### Analysis Results Storage

```javascript
interface AnalysisResults {
  timestamp: string;
  version: string;
  coverage: CoverageReport;
  redundancy: RedundancyReport;
  classification: ClassificationReport;
  report: OptimizationReport;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Critical Path Identification Completeness

*For any* valid codebase structure with defined entry points and feature areas, the Coverage Analyzer should identify all critical paths that match the identification criteria (commands, multi-component workflows, data persistence operations).

**Validates: Requirements 1.1**

### Property 2: Coverage Gap Detection Accuracy

*For any* set of critical paths and integration tests, the Coverage Analyzer should correctly identify which paths lack test coverage, with no false positives or false negatives.

**Validates: Requirements 1.2, 1.3**

### Property 3: Feature Area Categorization Correctness

*For any* critical path with identifiable feature indicators (file location, module dependencies), the Coverage Analyzer should assign it to the correct feature area (workspace, adoption, governance, operations, watch).

**Validates: Requirements 1.4**

### Property 4: Coverage Percentage Calculation Accuracy

*For any* set of critical paths and their coverage status, the calculated coverage percentage should equal (covered paths / total paths) × 100, rounded to two decimal places.

**Validates: Requirements 1.5**

### Property 5: Excessive Test File Identification

*For any* test file, if it contains more than the configured threshold (default: 50) test cases, it should be identified in the redundancy report.

**Validates: Requirements 2.1**

### Property 6: Redundant Test Detection

*For any* test file containing tests with similar structure, assertions, or code coverage, the Redundancy Analyzer should group them as similar tests with a similarity score.

**Validates: Requirements 2.2**

### Property 7: Coverage Overlap Detection

*For any* pair of unit test and integration test, if they cover the same code paths, the Redundancy Analyzer should identify the unit test as potentially redundant.

**Validates: Requirements 2.4**

### Property 8: Recommendation Completeness

*For any* analysis result (coverage, redundancy, or classification), the generated report should include specific, actionable recommendations with file paths and descriptions.

**Validates: Requirements 2.5, 6.5**

### Property 9: Test Classification Correctness

*For any* test case, it should be classified as integration if it has multiple component dependencies or real I/O operations, and as unit if it tests a single component with mocked dependencies.

**Validates: Requirements 3.3, 3.4**

### Property 10: CI Execution Time Compliance

*For any* CI pipeline configuration and set of integration tests, the total execution time should be verified to be under 20 seconds, and if adding tests would exceed this, optimization recommendations should be generated.

**Validates: Requirements 4.1, 4.2, 4.3, 7.5**

### Property 11: CI Output Completeness

*For any* CI pipeline execution, the output should include both execution time (in seconds) and test count (number of tests run).

**Validates: Requirements 4.5**

### Property 12: Local Test Execution Time Compliance

*For any* local test suite execution, the total execution time should be under 30 seconds for the full suite.

**Validates: Requirements 5.2**

### Property 13: Local Test Output Completeness

*For any* local test execution, the output should include coverage metrics (percentage) and execution time (in seconds).

**Validates: Requirements 5.5**

### Property 14: Test Template Generation

*For any* critical path that lacks integration test coverage, the system should generate a test template that includes the path description, entry points, and suggested test structure.

**Validates: Requirements 7.1**

### Property 15: Metric Calculation Accuracy

*For any* test suite, all calculated metrics (mutation score, test ratio, average execution time) should be mathematically correct based on the underlying data.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 16: Slow Test Flagging

*For any* test with execution time greater than 100ms, it should be flagged in the optimization report with its actual execution time.

**Validates: Requirements 8.4**

### Property 17: Flakiness Tracking Accuracy

*For any* test that fails intermittently across multiple runs, the flakiness tracker should record the failure rate and flag it as flaky if the rate is above the threshold.

**Validates: Requirements 8.5**

### Property 18: Feature Area Test Categorization

*For any* test file, it should be categorized into a feature area based on its file path or the modules it tests.

**Validates: Requirements 9.1**

### Property 19: Test Distribution Calculation

*For any* test suite categorized by feature areas, the count of tests per feature area should equal the sum of all tests in that category.

**Validates: Requirements 9.2**

### Property 20: Threshold-Based File Splitting Recommendation

*For any* test file exceeding the configured maximum test count threshold, the system should generate a recommendation to split the file.

**Validates: Requirements 10.2**

## Error Handling

### Error Categories

1. **File System Errors**
   - Missing test directories
   - Unreadable test files
   - Invalid file permissions
   - **Handling**: Log error, skip file, continue analysis with remaining files

2. **Parse Errors**
   - Invalid JavaScript syntax in test files
   - Malformed test structure
   - **Handling**: Log error with file path and line number, skip file, continue analysis

3. **Analysis Errors**
   - Unable to determine test dependencies
   - Ambiguous test classification
   - **Handling**: Log warning, use conservative classification (mark as integration if uncertain)

4. **Configuration Errors**
   - Missing or invalid configuration values
   - **Handling**: Use default values, log warning about defaults being used

5. **Resource Errors**
   - Insufficient memory for large test suites
   - Timeout during analysis
   - **Handling**: Process in batches, provide partial results with warning

### Error Recovery Strategies

```javascript
class ErrorHandler {
  /**
   * Handle file system errors gracefully
   * @param {Error} error - The error that occurred
   * @param {string} context - Context where error occurred
   * @returns {ErrorRecoveryAction}
   */
  handleFileSystemError(error, context) {
    // Log error
    // Skip problematic file
    // Continue with remaining files
    // Include error in final report
  }
  
  /**
   * Handle parse errors with detailed reporting
   * @param {Error} error - Parse error
   * @param {string} filePath - File that failed to parse
   * @returns {ErrorRecoveryAction}
   */
  handleParseError(error, filePath) {
    // Log error with file path and line number
    // Skip file
    // Add to "unparseable files" section of report
  }
  
  /**
   * Handle analysis errors with conservative defaults
   * @param {Error} error - Analysis error
   * @param {string} testCase - Test case being analyzed
   * @returns {ErrorRecoveryAction}
   */
  handleAnalysisError(error, testCase) {
    // Log warning
    // Use conservative classification
    // Mark with low confidence score
  }
}
```

### Validation

All inputs should be validated before processing:

```javascript
interface ValidationRules {
  paths: {
    libPath: 'must exist and be readable';
    testsPath: 'must exist and be readable';
    outputPath: 'must be writable';
  };
  config: {
    maxExecutionTime: 'must be positive number';
    maxTestsPerFile: 'must be positive integer';
    thresholds: 'must be between 0 and 100';
  };
  testFiles: {
    extension: 'must be .test.js or .spec.js';
    syntax: 'must be valid JavaScript';
  };
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive validation:

**Unit Tests**: Validate specific examples, edge cases, and error conditions
- Test specific file analysis scenarios
- Test error handling paths
- Test report generation with known inputs
- Test configuration validation

**Property Tests**: Verify universal properties across all inputs
- Test coverage calculation accuracy with random test suites
- Test redundancy detection with generated test files
- Test classification correctness with various test patterns
- Test metric calculations with random data

### Property-Based Testing Configuration

**Library**: fast-check (already in devDependencies)

**Configuration**:
- Minimum 100 iterations per property test
- Each property test references its design document property
- Tag format: `Feature: test-suite-optimization, Property {number}: {property_text}`

**Example Property Test**:
```javascript
const fc = require('fast-check');

describe('Coverage Percentage Calculation', () => {
  // Feature: test-suite-optimization, Property 4: Coverage Percentage Calculation Accuracy
  it('should calculate coverage percentage correctly for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // total paths
        fc.integer({ min: 0, max: 100 }), // covered paths
        (total, covered) => {
          fc.pre(covered <= total); // covered can't exceed total
          
          const result = calculateCoveragePercentage(covered, total);
          const expected = total === 0 ? 0 : Math.round((covered / total) * 100 * 100) / 100;
          
          return Math.abs(result - expected) < 0.01; // Allow for floating point precision
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Test Examples

```javascript
describe('CoverageAnalyzer', () => {
  describe('identifyCriticalPaths', () => {
    it('should identify command files as high priority critical paths', async () => {
      const mockLibPath = '/mock/lib';
      const mockFiles = [
        'lib/commands/workspace-multi.js',
        'lib/utils/path-utils.js'
      ];
      
      const analyzer = new CoverageAnalyzer();
      const paths = await analyzer.identifyCriticalPaths(mockLibPath, mockFiles);
      
      const commandPath = paths.find(p => p.entryPoints.includes('lib/commands/workspace-multi.js'));
      expect(commandPath).toBeDefined();
      expect(commandPath.priority).toBe('high');
    });
    
    it('should handle empty lib directory gracefully', async () => {
      const analyzer = new CoverageAnalyzer();
      const paths = await analyzer.identifyCriticalPaths('/empty/lib', []);
      
      expect(paths).toEqual([]);
    });
  });
});

describe('RedundancyAnalyzer', () => {
  describe('detectSimilarTests', () => {
    it('should detect tests with identical assertion patterns', async () => {
      const testFile = `
        test('should handle null', () => {
          expect(() => fn(null)).toThrow();
        });
        test('should handle undefined', () => {
          expect(() => fn(undefined)).toThrow();
        });
      `;
      
      const analyzer = new RedundancyAnalyzer();
      const groups = await analyzer.detectSimilarTests(testFile);
      
      expect(groups).toHaveLength(1);
      expect(groups[0].tests).toHaveLength(2);
      expect(groups[0].similarity).toBeGreaterThan(80);
    });
  });
});
```

### Integration Test Strategy

Integration tests should validate the complete analysis workflow:

```javascript
describe('Test Suite Optimization Integration', () => {
  it('should analyze a real test suite and generate actionable report', async () => {
    const optimizer = new TestSuiteOptimizer({
      libPath: './lib',
      testsPath: './tests',
      outputPath: './analysis-results'
    });
    
    const report = await optimizer.analyze();
    
    // Verify report structure
    expect(report.summary).toBeDefined();
    expect(report.coverage).toBeDefined();
    expect(report.redundancy).toBeDefined();
    expect(report.classification).toBeDefined();
    expect(report.actionPlan).toBeDefined();
    
    // Verify actionable recommendations
    expect(report.actionPlan.highPriority.length).toBeGreaterThan(0);
    
    // Verify report can be exported
    await optimizer.exportReport(report, 'markdown', './analysis-results/report.md');
    expect(fs.existsSync('./analysis-results/report.md')).toBe(true);
  });
});
```

### Test Coverage Goals

- **Critical paths**: 100% coverage (all analysis components)
- **Core business logic**: >90% coverage (analyzers, classifiers)
- **Utility functions**: >85% coverage (report generation, calculations)
- **Error handling**: 100% coverage (all error paths tested)
- **Overall project**: >85% coverage

## Implementation Notes

### Performance Considerations

1. **Parallel Processing**: Analyze test files in parallel using worker threads
2. **Caching**: Cache parsed ASTs to avoid re-parsing files
3. **Incremental Analysis**: Support analyzing only changed files
4. **Memory Management**: Process large test suites in batches

### Technology Stack

- **Language**: JavaScript (Node.js)
- **Parser**: @babel/parser for JavaScript AST parsing
- **Testing**: Jest for unit tests, fast-check for property tests
- **Reporting**: markdown-it for report generation
- **CLI**: commander for command-line interface

### File Structure

```
.kiro/specs/17-00-test-suite-optimization/
├── requirements.md
├── design.md
├── tasks.md
├── scripts/
│   ├── coverage-analyzer.js
│   ├── redundancy-analyzer.js
│   ├── test-classifier.js
│   ├── report-generator.js
│   └── optimizer-cli.js
├── tests/
│   ├── unit/
│   │   ├── coverage-analyzer.test.js
│   │   ├── redundancy-analyzer.test.js
│   │   ├── test-classifier.test.js
│   │   └── report-generator.test.js
│   └── properties/
│       ├── coverage-properties.test.js
│       ├── redundancy-properties.test.js
│       └── classification-properties.test.js
└── results/
    ├── analysis-report.md
    ├── analysis-report.json
    └── action-plan.md
```

### Configuration File

```json
{
  "testSuiteOptimization": {
    "paths": {
      "lib": "./lib",
      "tests": "./tests",
      "output": "./.kiro/specs/17-00-test-suite-optimization/results"
    },
    "thresholds": {
      "maxTestsPerFile": 50,
      "maxAssertionsPerTest": 10,
      "minCoveragePercentage": 85,
      "criticalPathCoverage": 100,
      "ciMaxExecutionTime": 20,
      "localMaxExecutionTime": 30,
      "slowTestThreshold": 100
    },
    "featureAreas": [
      "workspace",
      "adoption",
      "governance",
      "operations",
      "watch",
      "utils",
      "commands"
    ],
    "analysis": {
      "detectRedundancy": true,
      "classifyTests": true,
      "identifyCriticalPaths": true,
      "generateTemplates": true
    }
  }
}
```

## Traceability Matrix

| Requirement | Design Component | Correctness Property |
|-------------|------------------|---------------------|
| 1.1 | CoverageAnalyzer.identifyCriticalPaths() | Property 1 |
| 1.2, 1.3 | CoverageAnalyzer.mapTestsToPaths() | Property 2 |
| 1.4 | CoverageAnalyzer (feature area categorization) | Property 3 |
| 1.5 | CoverageReport.coveragePercentage | Property 4 |
| 2.1 | RedundancyAnalyzer (file test count) | Property 5 |
| 2.2 | RedundancyAnalyzer.detectSimilarTests() | Property 6 |
| 2.4 | RedundancyAnalyzer (coverage overlap) | Property 7 |
| 2.5, 6.5 | ReportGenerator.generateReport() | Property 8 |
| 3.3, 3.4 | TestClassifier.classifyTestCase() | Property 9 |
| 4.1, 4.2, 4.3, 7.5 | CI time validation | Property 10 |
| 4.5 | CI output formatting | Property 11 |
| 5.2 | Local test execution | Property 12 |
| 5.5 | Local test output | Property 13 |
| 7.1 | Template generation | Property 14 |
| 8.1, 8.2, 8.3 | Metric calculations | Property 15 |
| 8.4 | Slow test detection | Property 16 |
| 8.5 | Flakiness tracking | Property 17 |
| 9.1 | Feature area categorization | Property 18 |
| 9.2 | Test distribution calculation | Property 19 |
| 10.2 | File splitting recommendations | Property 20 |

---

**Version**: v1.0  
**Last Updated**: 2026-01-29  
**Status**: Ready for Review
