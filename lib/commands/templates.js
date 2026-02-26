/**
 * Templates Command
 * 
 * Manages SCE templates from official and custom sources
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const TemplateManager = require('../templates/template-manager');
const { TemplateError } = require('../templates/template-error');

/**
 * Format template list for display
 * 
 * @param {Array} templates - Template entries
 * @param {Object} options - Display options
 * @returns {void}
 */
function displayTemplateList(templates, options = {}) {
  const { source = null, category = null, type = null, compatibleWith = null } = options;
  
  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found'));
    
    if (source || category || type || compatibleWith) {
      console.log(chalk.gray('Try removing filters or updating templates'));
    } else {
      console.log(chalk.gray('Run'), chalk.cyan('sce templates update'), chalk.gray('to download templates'));
    }
    
    return;
  }
  
  // Group by category
  const byCategory = {};
  templates.forEach(template => {
    const cat = template.category || 'uncategorized';
    if (!byCategory[cat]) {
      byCategory[cat] = [];
    }
    byCategory[cat].push(template);
  });
  
  // Display each category
  Object.keys(byCategory).sort().forEach(cat => {
    console.log();
    console.log(chalk.blue.bold(`${cat}`));
    console.log();
    
    byCategory[cat].forEach(template => {
      const difficultyColor = {
        'beginner': chalk.green,
        'intermediate': chalk.yellow,
        'advanced': chalk.red
      }[template.difficulty] || chalk.gray;
      
      const sourcePrefix = template.source && template.source !== 'official' 
        ? chalk.gray(`[${template.source}] `) 
        : '';
      
      console.log(`  ${sourcePrefix}${chalk.cyan(template.id)}`);
      console.log(`    ${template.name}`);
      console.log(`    ${chalk.gray(template.description)}`);
      const templateType = template.template_type || 'spec-scaffold';
      const compatibility = formatCompatibilityRange(template);
      console.log(`    ${difficultyColor(template.difficulty)} • ${chalk.gray(template.tags.join(', '))}`);
      console.log(`    ${chalk.gray(`type=${templateType} compatibility=${compatibility}`)}`);
      console.log();
    });
  });
  
  console.log(chalk.gray(`Total: ${templates.length} template(s)`));
}

/**
 * Format template details for display
 * 
 * @param {Object} template - Template entry
 * @returns {void}
 */
function displayTemplateDetails(template) {
  console.log();
  console.log(chalk.blue.bold(template.name));
  console.log();
  
  console.log(chalk.gray('ID:'), chalk.cyan(template.id));
  console.log(chalk.gray('Category:'), template.category);
  
  const difficultyColor = {
    'beginner': chalk.green,
    'intermediate': chalk.yellow,
    'advanced': chalk.red
  }[template.difficulty] || chalk.gray;
  
  console.log(chalk.gray('Difficulty:'), difficultyColor(template.difficulty));
  console.log(chalk.gray('Type:'), template.template_type || 'spec-scaffold');
  console.log(chalk.gray('Compatibility:'), formatCompatibilityRange(template));

  if (template.risk_level) {
    console.log(chalk.gray('Risk Level:'), template.risk_level);
  }
  
  if (template.source) {
    console.log(chalk.gray('Source:'), template.source);
  }
  
  console.log();
  console.log(chalk.gray('Description:'));
  console.log(`  ${template.description}`);
  console.log();
  
  if (template.tags && template.tags.length > 0) {
    console.log(chalk.gray('Tags:'), template.tags.join(', '));
    console.log();
  }
  
  if (template.applicable_scenarios && template.applicable_scenarios.length > 0) {
    console.log(chalk.gray('Applicable Scenarios:'));
    template.applicable_scenarios.forEach(scenario => {
      console.log(`  • ${scenario}`);
    });
    console.log();
  }
  
  if (template.files && template.files.length > 0) {
    console.log(chalk.gray('Files:'));
    template.files.forEach(file => {
      console.log(`  • ${file}`);
    });
    console.log();
  }

  if (template.ontology_scope) {
    console.log(chalk.gray('Ontology Scope:'));
    const scopeKeys = ['domains', 'entities', 'relations', 'business_rules', 'decisions'];
    scopeKeys.forEach((key) => {
      const values = template.ontology_scope[key];
      if (Array.isArray(values) && values.length > 0) {
        console.log(`  • ${key}: ${values.join(', ')}`);
      }
    });
    console.log();
  }

  if (template.rollback_contract) {
    const strategy = template.rollback_contract.strategy || 'n/a';
    console.log(chalk.gray('Rollback Contract:'), `${template.rollback_contract.supported ? 'supported' : 'not-supported'} (strategy=${strategy})`);
    console.log();
  }
  
  if (template.author) {
    console.log(chalk.gray('Author:'), template.author);
  }
  
  if (template.created_at) {
    console.log(chalk.gray('Created:'), template.created_at);
  }
  
  if (template.updated_at) {
    console.log(chalk.gray('Updated:'), template.updated_at);
  }
  
  console.log();
  console.log(chalk.blue('Usage:'));
  if ((template.template_type || 'spec-scaffold') === 'spec-scaffold') {
    console.log(`  ${chalk.cyan(`sce spec create my-feature --template ${template.id}`)}`);
  } else {
    console.log(`  ${chalk.cyan(`sce templates show ${template.id}`)} ${chalk.gray('# inspect contract and owning workflow')}`);
  }
  console.log();
}

/**
 * List templates command
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function listTemplates(options = {}) {
  const {
    category = null,
    source = null,
    type = null,
    compatibleWith = null,
    risk = null
  } = options;
  
  console.log(chalk.red('🔥') + ' SCE Templates');
  
  try {
    const manager = new TemplateManager();
    const templates = await manager.listTemplates({
      category,
      source,
      templateType: type,
      compatibleWith,
      riskLevel: risk
    });
    
    displayTemplateList(templates, {
      category,
      source,
      type,
      compatibleWith
    });
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError) {
      if (error.suggestions && error.suggestions.length > 0) {
        console.log();
        console.log(chalk.yellow('💡 Suggestions:'));
        error.suggestions.forEach(suggestion => {
          console.log(`  • ${suggestion}`);
        });
      }
    }
    
    process.exit(1);
  }
}

/**
 * Search templates command
 * 
 * @param {string} keyword - Search keyword
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function searchTemplates(keyword, options = {}) {
  const {
    category = null,
    source = null,
    type = null,
    compatibleWith = null,
    risk = null
  } = options;
  
  console.log(chalk.red('🔥') + ` Searching templates for: ${chalk.cyan(keyword)}`);
  
  try {
    const manager = new TemplateManager();
    const templates = await manager.searchTemplates(keyword, {
      source,
      category,
      templateType: type,
      compatibleWith,
      riskLevel: risk
    });
    
    displayTemplateList(templates, {
      category,
      source,
      type,
      compatibleWith
    });
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * Show template details command
 * 
 * @param {string} templatePath - Template path (e.g., "web-features/rest-api")
 * @returns {Promise<void>}
 */
async function showTemplate(templatePath) {
  console.log(chalk.red('🔥') + ' Template Details');
  
  try {
    const manager = new TemplateManager();
    const template = await manager.showTemplate(templatePath);
    
    displayTemplateDetails(template);
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * Update templates command
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function updateTemplates(options = {}) {
  const { source = null, version = null } = options;
  
  const targetDesc = source 
    ? `source "${source}"` 
    : 'all sources';
  
  console.log(chalk.red('🔥') + ` Updating templates from ${targetDesc}...`);
  console.log();
  
  try {
    const manager = new TemplateManager();
    const result = await manager.updateTemplates(source, version);
    
    console.log(chalk.green('✅ Update complete!'));
    console.log();
    
    if (result.changes) {
      const { added, modified, deleted } = result.changes;
      
      if (added > 0) {
        console.log(chalk.green(`  Added: ${added} template(s)`));
      }
      
      if (modified > 0) {
        console.log(chalk.yellow(`  Modified: ${modified} template(s)`));
      }
      
      if (deleted > 0) {
        console.log(chalk.red(`  Deleted: ${deleted} template(s)`));
      }
      
      if (added === 0 && modified === 0 && deleted === 0) {
        console.log(chalk.gray('  No changes detected'));
      }
    }
    
    console.log();
    console.log(chalk.blue('💡 Next steps:'));
    console.log(`  ${chalk.cyan('sce templates list')} - View all templates`);
    console.log(`  ${chalk.cyan('sce templates search <keyword>')} - Search templates`);
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * Add template source command
 * 
 * @param {string} name - Source name
 * @param {string} gitUrl - Git repository URL
 * @returns {Promise<void>}
 */
async function addSource(name, gitUrl) {
  console.log(chalk.red('🔥') + ` Adding template source: ${chalk.cyan(name)}`);
  console.log();
  
  try {
    const manager = new TemplateManager();
    await manager.addSource(name, gitUrl);
    
    console.log(chalk.green('✅ Source added successfully!'));
    console.log();
    console.log(chalk.blue('💡 Next steps:'));
    console.log(`  ${chalk.cyan('sce templates update --source ' + name)} - Download templates from this source`);
    console.log(`  ${chalk.cyan('sce templates list --source ' + name)} - View templates from this source`);
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * Remove template source command
 * 
 * @param {string} name - Source name
 * @returns {Promise<void>}
 */
async function removeSource(name) {
  console.log(chalk.red('🔥') + ` Removing template source: ${chalk.cyan(name)}`);
  console.log();
  
  try {
    const manager = new TemplateManager();
    await manager.removeSource(name);
    
    console.log(chalk.green('✅ Source removed successfully!'));
    console.log();
    console.log(chalk.gray('Note: Cached templates from this source are still available'));
    console.log(chalk.gray('Run'), chalk.cyan('sce templates cache --clear --source ' + name), chalk.gray('to remove them'));
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * List template sources command
 * 
 * @returns {Promise<void>}
 */
async function listSources() {
  console.log(chalk.red('🔥') + ' Template Sources');
  console.log();
  
  try {
    const manager = new TemplateManager();
    const sources = await manager.listSources();
    
    if (sources.length === 0) {
      console.log(chalk.yellow('No template sources configured'));
      console.log();
      console.log(chalk.gray('Add a source:'), chalk.cyan('sce templates add-source <name> <git-url>'));
      return;
    }
    
    sources.forEach(source => {
      const typeLabel = source.type === 'official' 
        ? chalk.blue('[Official]') 
        : chalk.gray('[Custom]');
      
      const statusLabel = source.enabled 
        ? chalk.green('✓ Enabled') 
        : chalk.gray('✗ Disabled');
      
      console.log(`${typeLabel} ${chalk.cyan(source.name)}`);
      console.log(`  URL: ${source.url}`);
      console.log(`  Status: ${statusLabel}`);
      
      if (source.last_updated) {
        console.log(`  Last Updated: ${new Date(source.last_updated).toLocaleString()}`);
      }
      
      if (source.version) {
        console.log(`  Version: ${source.version}`);
      }
      
      console.log();
    });
    
    console.log(chalk.blue('💡 Commands:'));
    console.log(`  ${chalk.cyan('sce templates update')} - Update all sources`);
    console.log(`  ${chalk.cyan('sce templates add-source <name> <url>')} - Add custom source`);
    console.log(`  ${chalk.cyan('sce templates remove-source <name>')} - Remove source`);
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * Cache management command
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function cacheCommand(options = {}) {
  const { clear = false, source = null } = options;
  
  console.log(chalk.red('🔥') + ' Template Cache');
  console.log();
  
  try {
    const manager = new TemplateManager();
    
    if (clear) {
      // Clear cache
      const targetDesc = source 
        ? `source "${source}"` 
        : 'all sources';
      
      console.log(chalk.yellow(`Clearing cache for ${targetDesc}...`));
      console.log();
      
      await manager.clearCache(source);
      
      console.log(chalk.green('✅ Cache cleared successfully!'));
      console.log();
      console.log(chalk.gray('Run'), chalk.cyan('sce templates update'), chalk.gray('to re-download templates'));
      
    } else {
      // Show cache status
      const status = await manager.getCacheStatus();
      
      if (!status || Object.keys(status.sources || {}).length === 0) {
        console.log(chalk.yellow('Cache is empty'));
        console.log();
        console.log(chalk.gray('Run'), chalk.cyan('sce templates update'), chalk.gray('to download templates'));
        return;
      }
      
      console.log(chalk.blue('Cache Status:'));
      console.log();
      
      Object.entries(status.sources).forEach(([sourceName, sourceInfo]) => {
        console.log(chalk.cyan(sourceName));
        console.log(`  Templates: ${sourceInfo.template_count}`);
        console.log(`  Size: ${formatBytes(sourceInfo.size_bytes)}`);
        console.log(`  Last Updated: ${new Date(sourceInfo.last_updated).toLocaleString()}`);
        
        if (sourceInfo.version) {
          console.log(`  Version: ${sourceInfo.version}`);
        }
        
        console.log();
      });
      
      if (status.last_check) {
        console.log(chalk.gray(`Last Check: ${new Date(status.last_check).toLocaleString()}`));
        console.log();
      }
      
      console.log(chalk.blue('💡 Commands:'));
      console.log(`  ${chalk.cyan('sce templates cache --clear')} - Clear all cache`);
      console.log(`  ${chalk.cyan('sce templates cache --clear --source <name>')} - Clear specific source`);
      console.log(`  ${chalk.cyan('sce templates update')} - Update cached templates`);
    }
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error instanceof TemplateError && error.suggestions) {
      console.log();
      console.log(chalk.yellow('💡 Suggestions:'));
      error.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
    }
    
    process.exit(1);
  }
}

/**
 * Format compatibility range for display
 *
 * @param {Object} template - Template metadata
 * @returns {string} Compatibility text
 */
function formatCompatibilityRange(template) {
  const min = template.min_sce_version || '*';
  const max = template.max_sce_version || '*';
  return `${min}..${max}`;
}

/**
 * Format bytes to human-readable string
 * 
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Display template guide
 * 
 * @returns {Promise<void>}
 */
async function displayGuide() {
  console.log(chalk.red('🔥') + ' SCE Template Guide');
  console.log();
  
  console.log(chalk.blue.bold('What are SCE Templates?'));
  console.log();
  console.log('SCE templates include spec scaffolds, capability templates, and runtime playbooks.');
  console.log('They provide reusable contracts for generation, execution, and verification workflows.');
  console.log();
  
  console.log(chalk.blue.bold('Quick Start:'));
  console.log();
  console.log(`1. ${chalk.cyan('sce templates list')} - Browse available templates`);
  console.log(`2. ${chalk.cyan('sce templates show <template-id>')} - View template details`);
  console.log(`3. ${chalk.cyan('sce spec create my-feature --template <template-id>')} - Apply scaffold template`);
  console.log();
  
  console.log(chalk.blue.bold('Common Commands:'));
  console.log();
  console.log(`  ${chalk.cyan('sce templates list')} - List all templates`);
  console.log(`  ${chalk.cyan('sce templates search <keyword>')} - Search templates`);
  console.log(`  ${chalk.cyan('sce templates update')} - Update template library`);
  console.log(`  ${chalk.cyan('sce templates sources')} - Manage template sources`);
  console.log(`  ${chalk.cyan('sce templates cache')} - View cache status`);
  console.log();
  
  console.log(chalk.blue.bold('Custom Sources:'));
  console.log();
  console.log('You can add your own template repositories:');
  console.log(`  ${chalk.cyan('sce templates add-source my-templates https://github.com/user/templates.git')}`);
  console.log();
  
  console.log(chalk.blue.bold('Documentation:'));
  console.log();
  console.log('For more information, see:');
  console.log(`  ${chalk.gray('docs/spec-workflow.md')}`);
  console.log(`  ${chalk.gray('https://github.com/heguangyong/scene-capability-engine')}`);
  console.log();
}

/**
 * Create template from existing Spec command
 * 
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function createFromSpec(options = {}) {
  const {
    spec,
    output = null,
    preview = false,
    dryRun = false,
    interactive = true
  } = options;
  
  if (!spec) {
    console.log(chalk.red('❌ Error: Spec identifier is required'));
    console.log();
    console.log(chalk.gray('Usage:'), chalk.cyan('sce templates create-from-spec --spec <identifier>'));
    console.log();
    console.log(chalk.gray('Example:'), chalk.cyan('sce templates create-from-spec --spec 22-00'));
    process.exit(1);
  }
  
  try {
    const TemplateCreator = require('../templates/template-creator');
    const creator = new TemplateCreator({ interactive });
    
    const result = await creator.createTemplate({
      spec,
      output,
      preview,
      dryRun,
      interactive
    });
    
    if (!result.dryRun) {
      console.log(chalk.green('✅ Template created successfully!'));
    }
    
  } catch (error) {
    console.log();
    console.log(chalk.red('❌ Error:'), error.message);
    
    if (error.stack && process.env.DEBUG) {
      console.log();
      console.log(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

module.exports = {
  listTemplates,
  searchTemplates,
  showTemplate,
  updateTemplates,
  addSource,
  removeSource,
  listSources,
  cacheCommand,
  displayGuide,
  createFromSpec
};
