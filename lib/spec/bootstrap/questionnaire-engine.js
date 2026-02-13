const inquirer = require('inquirer');

const DEFAULT_ANSWERS = {
  problemStatement: 'Define the feature scope and the expected business outcome.',
  primaryFlow: 'Capture user flow, data flow, and observable outputs.',
  verificationPlan: 'Define verification checks and acceptance coverage.'
};

class QuestionnaireEngine {
  constructor(options = {}) {
    this.maxQuestions = options.maxQuestions || 3;
    this.prompt = options.prompt || inquirer.prompt;
  }

  async collect(options = {}) {
    const defaults = this._buildDefaults(options);

    if (options.nonInteractive) {
      return defaults;
    }

    const questions = [
      {
        type: 'input',
        name: 'specName',
        message: 'Spec name (for example: 112-00-feature-name):',
        default: defaults.specName,
        validate: input => input && input.trim() ? true : 'Spec name is required'
      },
      {
        type: 'input',
        name: 'problemStatement',
        message: 'What problem should this Spec solve?',
        default: defaults.problemStatement
      },
      {
        type: 'input',
        name: 'primaryFlow',
        message: 'What is the primary implementation flow?',
        default: defaults.primaryFlow
      },
      {
        type: 'input',
        name: 'verificationPlan',
        message: 'How should this Spec be validated?',
        default: defaults.verificationPlan
      }
    ].slice(0, this.maxQuestions + 1);

    const answers = await this.prompt(questions);
    return {
      ...defaults,
      ...answers,
      questionCount: questions.length
    };
  }

  _buildDefaults(options = {}) {
    return {
      specName: options.specName || '',
      problemStatement: options.problemStatement || DEFAULT_ANSWERS.problemStatement,
      primaryFlow: options.primaryFlow || DEFAULT_ANSWERS.primaryFlow,
      verificationPlan: options.verificationPlan || DEFAULT_ANSWERS.verificationPlan,
      questionCount: 0
    };
  }
}

module.exports = { QuestionnaireEngine, DEFAULT_ANSWERS };

