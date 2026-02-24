/**
 * TemplateCreator - Main orchestrator for template creation workflow
 */

const SpecReader = require('./spec-reader');
const ContentGeneralizer = require('./content-generalizer');
const MetadataCollector = require('./metadata-collector');
const FrontmatterGenerator = require('./frontmatter-generator');
const TemplateValidator = require('./template-validator');
const TemplateExporter = require('./template-exporter');

class TemplateCreator {
  constructor(options = {}) {
    this.options = options;
    this.specReader = new SpecReader();
    this.contentGeneralizer = new ContentGeneralizer();
    this.metadataCollector = new MetadataCollector(options);
    this.frontmatterGenerator = new FrontmatterGenerator();
    this.templateValidator = new TemplateValidator();
    this.templateExporter = new TemplateExporter();
  }

  /**
   * Creates a template from an existing Spec
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} Creation result
   */
  async createTemplate(options) {
    const {
      spec,
      output,
      preview = false,
      dryRun = false,
      interactive = true
    } = options;

    try {
      console.log('🚀 Starting template creation...\n');

      // Step 1: Read and validate Spec
      console.log('📖 Step 1: Reading Spec...');
      const specInfo = await this.specReader.findSpec(spec);
      console.log(`   Found: ${specInfo.name}`);

      const validation = await this.specReader.validateSpecStructure(specInfo.path);
      if (!validation.valid) {
        throw new Error(`Missing required files: ${validation.missingFiles.join(', ')}`);
      }
      console.log(`   ✓ All required files present\n`);

      const fileContents = await this.specReader.readSpecFiles(specInfo.path);
      const specMetadata = this.specReader.extractSpecMetadata(specInfo.path, fileContents);

      // Step 2: Generalize content
      console.log('🔄 Step 2: Generalizing content...');
      const generalizationResult = this.contentGeneralizer.generalize(fileContents, specMetadata);
      console.log(`   Replacements: ${generalizationResult.summary.totalReplacements}`);
      console.log(`   Flags: ${generalizationResult.summary.totalFlags}\n`);

      // Step 3: Collect metadata
      console.log('📝 Step 3: Collecting metadata...');
      const metadata = await this.metadataCollector.collectMetadata(specMetadata, interactive);
      console.log(`   ✓ Metadata collected\n`);

      // Step 4: Generate frontmatter
      console.log('📄 Step 4: Generating frontmatter...');
      const frontmatter = this.frontmatterGenerator.generateFrontmatter(metadata);
      const filesWithFrontmatter = {};
      
      for (const [filename, fileData] of Object.entries(generalizationResult.files)) {
        if (fileData.generalized) {
          filesWithFrontmatter[filename] = this.frontmatterGenerator.addFrontmatter(
            fileData.generalized,
            frontmatter
          );
        }
      }
      console.log(`   ✓ Frontmatter added to all files\n`);

      // Step 5: Validate template
      console.log('✅ Step 5: Validating template...');
      const validationResult = await this.validateTemplate(filesWithFrontmatter, metadata);
      console.log(`   Quality Score: ${validationResult.score}/100`);
      console.log(`   Errors: ${validationResult.errors.length}`);
      console.log(`   Warnings: ${validationResult.warnings.length}\n`);

      if (validationResult.errors.length > 0) {
        console.log('❌ Validation Errors:');
        validationResult.errors.forEach(error => console.log(`   - ${error}`));
        console.log('');
      }

      if (validationResult.warnings.length > 0) {
        console.log('⚠️  Validation Warnings:');
        validationResult.warnings.forEach(warning => console.log(`   - ${warning}`));
        console.log('');
      }

      // Step 6: Preview (if requested)
      if (preview) {
        console.log('👀 Preview:');
        this.showPreview(fileContents, generalizationResult);
        console.log('');
      }

      // Step 7: Export template
      if (dryRun) {
        console.log('🏃 Dry run mode - skipping export\n');
        return {
          success: true,
          dryRun: true,
          metadata,
          validationResult
        };
      }

      console.log('📦 Step 6: Exporting template...');
      const exportResult = await this.templateExporter.exportTemplate(
        {
          metadata,
          files: filesWithFrontmatter,
          validationResult,
          generalizationResult
        },
        output
      );

      console.log(`   ✓ Template exported to: ${exportResult.outputDir}\n`);

      // Final summary
      console.log('✨ Template creation complete!\n');
      console.log('📁 Files created:');
      exportResult.filesCreated.forEach(file => console.log(`   - ${file}`));
      console.log('');
      console.log('📖 Next steps:');
      console.log(`   1. Review the template in: ${exportResult.outputDir}`);
      console.log(`   2. Check REVIEW_CHECKLIST.md for items to verify`);
      console.log(`   3. Test the template: sce spec create test --template ${metadata.name}`);
      console.log(`   4. Follow SUBMISSION_GUIDE.md to submit to repository`);
      console.log('');

      return exportResult;

    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
      throw error;
    }
  }

  /**
   * Validates template
   * @param {Object} files - Template files
   * @param {Object} metadata - Template metadata
   * @returns {Promise<Object>} Validation result
   */
  async validateTemplate(files, metadata) {
    const errors = [];
    const warnings = [];
    let score = 100;

    // Validate frontmatter in each file
    for (const [filename, content] of Object.entries(files)) {
      if (!content) continue;

      // Check for frontmatter
      if (!content.trim().startsWith('---')) {
        errors.push(`${filename}: Missing YAML frontmatter`);
        score -= 10;
        continue;
      }

      // Validate YAML syntax
      const yamlValidation = this.frontmatterGenerator.validateYaml(
        content.split('---')[1]
      );
      if (!yamlValidation.valid) {
        errors.push(`${filename}: Invalid YAML frontmatter - ${yamlValidation.errors.join(', ')}`);
        score -= 10;
      }

      // Check for remaining project-specific content (high confidence patterns)
      const projectSpecificPatterns = [
        /\.sce\/specs\/\d+-\d+-[a-z-]+/g,  // Specific spec paths
        /scene-capability-engine/g,  // Project name (unless it's the template itself)
      ];

      projectSpecificPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches && matches.length > 3) {  // Allow a few occurrences
          warnings.push(`${filename}: Possible project-specific content: ${matches[0]}`);
          score -= 2;
        }
      });

      // Check for template variable syntax
      const malformedVariables = content.match(/\{\{[^}]*\}\}(?!\})/g);
      if (malformedVariables) {
        malformedVariables.forEach(v => {
          if (!/^\{\{[A-Z_]+\}\}$/.test(v)) {
            warnings.push(`${filename}: Malformed template variable: ${v}`);
            score -= 1;
          }
        });
      }
    }

    // Validate metadata
    const metadataValidation = this.metadataCollector.validateMetadata(metadata);
    if (!metadataValidation.valid) {
      errors.push(...metadataValidation.errors);
      score -= 15;
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
      valid: errors.length === 0,
      score,
      errors,
      warnings,
      breakdown: {
        structure: errors.length === 0 ? 30 : 15,
        frontmatter: errors.filter(e => e.includes('frontmatter')).length === 0 ? 20 : 10,
        variables: warnings.filter(w => w.includes('variable')).length === 0 ? 20 : 15,
        content: warnings.filter(w => w.includes('project-specific')).length === 0 ? 20 : 15,
        references: 10
      }
    };
  }

  /**
   * Shows preview of changes
   * @param {Object} originalContent - Original Spec content
   * @param {Object} generalizationResult - Generalization result
   */
  showPreview(originalContent, generalizationResult) {
    for (const [filename, fileData] of Object.entries(generalizationResult.files)) {
      console.log(`\n📄 ${filename}:`);
      console.log(`   Replacements: ${fileData.replacements.length}`);
      
      fileData.replacements.forEach(r => {
        console.log(`   - ${r.pattern} → ${r.variable} (${r.count} times)`);
      });

      if (fileData.flags.length > 0) {
        console.log(`   Flags: ${fileData.flags.length}`);
        fileData.flags.forEach(f => {
          console.log(`   - Line ${f.line}: ${f.message} - "${f.content}"`);
        });
      }
    }
  }
}

module.exports = TemplateCreator;
