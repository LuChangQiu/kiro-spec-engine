/**
 * Decision Engine
 * Autonomous technical decision-making with documentation
 */

class DecisionEngine {
  constructor(projectContext = {}) {
    this.projectContext = projectContext;
    this.decisionHistory = [];
    this.outcomeTracking = new Map(); // decision type -> outcomes
  }
  
  /**
   * Choose technology stack
   * @param {Object} requirements - Requirements object
   * @returns {Object} - Technology choices
   */
  async chooseTechnologyStack(requirements) {
    const decision = {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      category: 'technology',
      decision: 'Technology Stack Selection',
      rationale: 'Based on project requirements and existing patterns',
      alternatives: [],
      impact: 'high',
      reversible: false
    };
    
    // Analyze project context
    const hasTypeScript = this.projectContext.hasTypeScript || false;
    const hasReact = this.projectContext.hasReact || false;
    
    const stack = {
      language: hasTypeScript ? 'TypeScript' : 'JavaScript',
      testing: 'Jest',
      buildTool: 'npm'
    };
    
    decision.choices = stack;
    decision.rationale = `Selected ${stack.language} for consistency with existing codebase`;
    
    this.documentDecision(decision);
    return stack;
  }
  
  /**
   * Select architecture pattern
   * @param {Object} requirements - Requirements object
   * @returns {string} - Architecture pattern
   */
  async selectArchitecturePattern(requirements) {
    const decision = {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      category: 'architecture',
      decision: 'Architecture Pattern Selection',
      alternatives: ['MVC', 'Layered', 'Microservices', 'Event-Driven'],
      impact: 'high',
      reversible: false
    };
    
    // Default to layered architecture for CLI tools
    const pattern = 'Layered';
    decision.choice = pattern;
    decision.rationale = 'Layered architecture provides clear separation of concerns for CLI tools';
    
    this.documentDecision(decision);
    return pattern;
  }
  
  /**
   * Choose testing framework
   * @param {string} language - Programming language
   * @returns {string} - Testing framework
   */
  async chooseTestingFramework(language) {
    const frameworks = {
      JavaScript: 'Jest',
      TypeScript: 'Jest',
      Python: 'pytest',
      Java: 'JUnit'
    };
    
    const framework = frameworks[language] || 'Jest';
    
    const decision = {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      category: 'technology',
      decision: `Testing Framework: ${framework}`,
      rationale: `Standard testing framework for ${language}`,
      alternatives: Object.values(frameworks).filter(f => f !== framework),
      impact: 'medium',
      reversible: true
    };
    
    this.documentDecision(decision);
    return framework;
  }
  
  /**
   * Select data structure
   * @param {Object} requirements - Requirements for data structure
   * @returns {string} - Data structure choice
   */
  async selectDataStructure(requirements) {
    const { accessPattern, size, operations } = requirements;
    
    let structure = 'Array';
    let rationale = 'Default choice for simple collections';
    
    if (operations?.includes('fast-lookup')) {
      structure = 'Map';
      rationale = 'Map provides O(1) lookup performance';
    } else if (operations?.includes('unique')) {
      structure = 'Set';
      rationale = 'Set ensures uniqueness automatically';
    } else if (accessPattern === 'queue') {
      structure = 'Array with shift/push';
      rationale = 'Array methods provide queue semantics';
    }
    
    const decision = {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      category: 'implementation',
      decision: `Data Structure: ${structure}`,
      rationale,
      alternatives: ['Array', 'Map', 'Set', 'Object'],
      impact: 'low',
      reversible: true
    };
    
    this.documentDecision(decision);
    return structure;
  }
  
  /**
   * Choose naming convention
   * @param {Object} context - Context information
   * @returns {Object} - Naming conventions
   */
  async chooseNamingConvention(context) {
    // Detect existing patterns from project
    const conventions = {
      files: 'kebab-case',
      classes: 'PascalCase',
      functions: 'camelCase',
      constants: 'UPPER_SNAKE_CASE',
      variables: 'camelCase'
    };
    
    const decision = {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      category: 'implementation',
      decision: 'Naming Conventions',
      rationale: 'Following JavaScript/Node.js community standards',
      conventions,
      impact: 'low',
      reversible: true
    };
    
    this.documentDecision(decision);
    return conventions;
  }
  
  /**
   * Determine file structure
   * @param {Array} components - Components to organize
   * @returns {Object} - File structure
   */
  async determineFileStructure(components) {
    const structure = {
      pattern: 'feature-based',
      directories: components.map(c => `lib/${c}`),
      rationale: 'Feature-based organization for better modularity'
    };
    
    const decision = {
      id: this.generateDecisionId(),
      timestamp: new Date().toISOString(),
      category: 'implementation',
      decision: 'File Structure Organization',
      rationale: structure.rationale,
      structure,
      impact: 'medium',
      reversible: true
    };
    
    this.documentDecision(decision);
    return structure;
  }
  
  /**
   * Decide if code should be refactored
   * @param {Object} code - Code metrics
   * @param {Object} metrics - Code metrics
   * @returns {boolean} - Should refactor
   */
  async shouldRefactor(code, metrics) {
    const { complexity, duplication, length } = metrics;
    
    const shouldRefactor = complexity > 10 || duplication > 0.2 || length > 300;
    
    if (shouldRefactor) {
      const decision = {
        id: this.generateDecisionId(),
        timestamp: new Date().toISOString(),
        category: 'quality',
        decision: 'Refactor Code',
        rationale: `Complexity: ${complexity}, Duplication: ${duplication}, Length: ${length}`,
        impact: 'medium',
        reversible: false
      };
      
      this.documentDecision(decision);
    }
    
    return shouldRefactor;
  }
  
  /**
   * Decide if tests should be added
   * @param {number} coverage - Current coverage
   * @param {Object} requirements - Requirements
   * @returns {boolean} - Should add tests
   */
  async shouldAddTests(coverage, requirements) {
    const targetCoverage = requirements.targetCoverage || 80;
    const shouldAdd = coverage < targetCoverage;
    
    if (shouldAdd) {
      const decision = {
        id: this.generateDecisionId(),
        timestamp: new Date().toISOString(),
        category: 'quality',
        decision: 'Add Tests',
        rationale: `Current coverage ${coverage}% below target ${targetCoverage}%`,
        impact: 'medium',
        reversible: false
      };
      
      this.documentDecision(decision);
    }
    
    return shouldAdd;
  }
  
  /**
   * Decide if optimization is needed
   * @param {Object} performance - Performance metrics
   * @param {Object} requirements - Requirements
   * @returns {boolean} - Should optimize
   */
  async shouldOptimize(performance, requirements) {
    const { responseTime, throughput } = performance;
    const { maxResponseTime, minThroughput } = requirements;
    
    const shouldOptimize = 
      (maxResponseTime && responseTime > maxResponseTime) ||
      (minThroughput && throughput < minThroughput);
    
    if (shouldOptimize) {
      const decision = {
        id: this.generateDecisionId(),
        timestamp: new Date().toISOString(),
        category: 'quality',
        decision: 'Optimize Performance',
        rationale: `Response time: ${responseTime}ms, Throughput: ${throughput} req/s`,
        impact: 'high',
        reversible: false
      };
      
      this.documentDecision(decision);
    }
    
    return shouldOptimize;
  }
  
  /**
   * Document a decision
   * @param {Object} decision - Decision details
   */
  documentDecision(decision) {
    this.decisionHistory.push(decision);
  }
  
  /**
   * Get decision history
   * @returns {Array} - Decision history
   */
  getDecisionHistory() {
    return this.decisionHistory;
  }
  
  /**
   * Track decision outcome
   * @param {string} decisionId - Decision ID
   * @param {boolean} success - Outcome success
   */
  trackOutcome(decisionId, success) {
    const decision = this.decisionHistory.find(d => d.id === decisionId);
    if (!decision) return;
    
    const category = decision.category;
    if (!this.outcomeTracking.has(category)) {
      this.outcomeTracking.set(category, { successes: 0, failures: 0 });
    }
    
    const outcomes = this.outcomeTracking.get(category);
    if (success) {
      outcomes.successes++;
    } else {
      outcomes.failures++;
    }
  }
  
  /**
   * Get success rate for decision category
   * @param {string} category - Decision category
   * @returns {number} - Success rate (0-1)
   */
  getSuccessRate(category) {
    const outcomes = this.outcomeTracking.get(category);
    if (!outcomes) return 0;
    
    const total = outcomes.successes + outcomes.failures;
    if (total === 0) return 0;
    
    return outcomes.successes / total;
  }
  
  /**
   * Generate unique decision ID
   * @returns {string} - Decision ID
   */
  generateDecisionId() {
    return `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = DecisionEngine;
