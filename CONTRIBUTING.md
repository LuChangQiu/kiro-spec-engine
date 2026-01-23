# Contributing to Kiro Spec Engine

Thank you for your interest in contributing to Kiro Spec Engine! 🔥

## 🌍 Adding New Languages

We welcome translations to make Kiro Spec Engine accessible to more developers worldwide.

### Steps to Add a New Language

1. **Create Language File**
   - Copy `locales/en.json` to `locales/[language-code].json`
   - Example: `locales/ja.json` for Japanese

2. **Translate All Strings**
   - Translate all text values in the JSON file
   - Keep the JSON structure and keys unchanged
   - Maintain emoji and formatting

3. **Update Language Detection**
   - Edit `lib/i18n.js`
   - Add detection logic in the `detectLocale()` method:
   ```javascript
   if (envLocale.startsWith('ja')) return 'ja';
   if (systemLocale.startsWith('ja')) return 'ja';
   ```

4. **Create Translated README**
   - Copy `README.md` to `README.[language-code].md`
   - Example: `README.ja.md` for Japanese
   - Translate all content
   - Add language switcher at the top

5. **Update Main README**
   - Add your language to the "Supported Languages" section
   - Add link to translated README

6. **Test Your Translation**
   ```bash
   npm link
   kiro-spec-engine --lang [language-code] init
   # Or use the short alias
   kse --lang [language-code] init
   ```

7. **Submit Pull Request**
   - Create a PR with your changes
   - Include screenshots of the translated interface
   - Describe what language you added

### Translation Guidelines

- **Be Consistent**: Use consistent terminology throughout
- **Keep It Natural**: Translate meaning, not word-for-word
- **Preserve Formatting**: Keep emoji, markdown, and code blocks
- **Test Thoroughly**: Test all commands with your translation

## 🐛 Reporting Bugs

- Use GitHub Issues
- Include steps to reproduce
- Specify your environment (OS, Node version, etc.)

## 💡 Suggesting Features

- Open a GitHub Issue with the "enhancement" label
- Describe the feature and its use case
- Explain how it aligns with the Ultrawork spirit

## 📝 Code Contributions

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🔥 Ultrawork Spirit in Contributions

When contributing, embody the Ultrawork spirit:

- **Never settle for "good enough"** - Strive for excellence
- **Continuous improvement** - Iterate on feedback
- **Persistent effort** - Don't give up on challenging problems

---

Thank you for helping make Kiro Spec Engine better! 🙏