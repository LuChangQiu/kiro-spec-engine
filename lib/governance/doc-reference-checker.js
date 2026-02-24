/**
 * Document Reference Checker
 * 
 * Checks for incorrect project references and unresolved placeholders in documentation
 */

const fs = require('fs-extra');
const path = require('path');

class DocReferenceChecker {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    
    // Common incorrect references to check
    this.incorrectReferences = [
      '上海图书馆',
      'MinIO',
      '测试项目',
      '简化测试项目',
      'SCE AI-OS'
    ];
    
    // Placeholder patterns to check
    this.placeholderPatterns = [
      /\[TODO:.*?\]/g,
      /\[项目名称.*?\]/g,
      /\[请修改.*?\]/g,
      /\[根据项目.*?\]/g
    ];
    
    // Files to check
    this.filesToCheck = [
      '.sce/specs/SPEC_WORKFLOW_GUIDE.md',
      '.sce/steering/ENVIRONMENT.md',
      '.sce/steering/CURRENT_CONTEXT.md',
      '.sce/README.md',
      'README.md',
      'package.json'
    ];
  }
  
  /**
   * Check all documentation files
   * 
   * @returns {Promise<Object>} Check results
   */
  async checkAll() {
    const results = {
      incorrectReferences: [],
      unresolvedPlaceholders: [],
      filesChecked: 0,
      issuesFound: 0
    };
    
    for (const file of this.filesToCheck) {
      const filePath = path.join(this.projectRoot, file);
      
      if (await fs.pathExists(filePath)) {
        results.filesChecked++;
        const fileResults = await this.checkFile(filePath);
        
        if (fileResults.incorrectReferences.length > 0) {
          results.incorrectReferences.push({
            file,
            references: fileResults.incorrectReferences
          });
          results.issuesFound += fileResults.incorrectReferences.length;
        }
        
        if (fileResults.unresolvedPlaceholders.length > 0) {
          results.unresolvedPlaceholders.push({
            file,
            placeholders: fileResults.unresolvedPlaceholders
          });
          results.issuesFound += fileResults.unresolvedPlaceholders.length;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Check a single file
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File check results
   */
  async checkFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const results = {
      incorrectReferences: [],
      unresolvedPlaceholders: []
    };
    
    // Check for incorrect references
    lines.forEach((line, index) => {
      this.incorrectReferences.forEach(ref => {
        if (line.includes(ref)) {
          results.incorrectReferences.push({
            line: index + 1,
            content: line.trim(),
            reference: ref
          });
        }
      });
    });
    
    // Check for unresolved placeholders (only in non-template files)
    if (!filePath.includes('template/')) {
      lines.forEach((line, index) => {
        this.placeholderPatterns.forEach(pattern => {
          const matches = line.match(pattern);
          if (matches) {
            matches.forEach(match => {
              results.unresolvedPlaceholders.push({
                line: index + 1,
                content: line.trim(),
                placeholder: match
              });
            });
          }
        });
      });
    }
    
    return results;
  }
  
  /**
   * Generate report
   * 
   * @param {Object} results - Check results
   * @returns {string} Formatted report
   */
  generateReport(results) {
    let report = '# Document Reference Check Report\n\n';
    report += `**Date**: ${new Date().toISOString().split('T')[0]}\n`;
    report += `**Files Checked**: ${results.filesChecked}\n`;
    report += `**Issues Found**: ${results.issuesFound}\n\n`;
    
    if (results.issuesFound === 0) {
      report += '✅ **No issues found!** All documentation is clean.\n';
      return report;
    }
    
    // Incorrect references
    if (results.incorrectReferences.length > 0) {
      report += '## 🔴 Incorrect Project References\n\n';
      results.incorrectReferences.forEach(item => {
        report += `### ${item.file}\n\n`;
        item.references.forEach(ref => {
          report += `- **Line ${ref.line}**: Found "${ref.reference}"\n`;
          report += `  \`\`\`\n  ${ref.content}\n  \`\`\`\n\n`;
        });
      });
    }
    
    // Unresolved placeholders
    if (results.unresolvedPlaceholders.length > 0) {
      report += '## 🟡 Unresolved Placeholders\n\n';
      results.unresolvedPlaceholders.forEach(item => {
        report += `### ${item.file}\n\n`;
        item.placeholders.forEach(ph => {
          report += `- **Line ${ph.line}**: ${ph.placeholder}\n`;
          report += `  \`\`\`\n  ${ph.content}\n  \`\`\`\n\n`;
        });
      });
    }
    
    // Recommendations
    report += '## 💡 Recommendations\n\n';
    if (results.incorrectReferences.length > 0) {
      report += '1. Remove or replace incorrect project references\n';
      report += '2. Ensure all documentation reflects the correct project identity\n';
    }
    if (results.unresolvedPlaceholders.length > 0) {
      report += '3. Replace all [TODO: ...] placeholders with actual project information\n';
      report += '4. Update ENVIRONMENT.md with correct project details\n';
    }
    
    return report;
  }
  
  /**
   * Save report to file
   * 
   * @param {string} report - Report content
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async saveReport(report, outputPath) {
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, report, 'utf-8');
  }
}

module.exports = DocReferenceChecker;
