const fs = require('fs');
const path = require('path');

class I18n {
  constructor() {
    this.locale = this.detectLocale();
    this.messages = this.loadMessages(this.locale);
  }

  detectLocale() {
    // 优先级: 环境变量 > 系统语言 > 默认英文
    const envLocale = process.env.KIRO_LANG || process.env.LANG;
    
    if (envLocale) {
      if (envLocale.startsWith('zh')) return 'zh';
      if (envLocale.startsWith('en')) return 'en';
    }

    // 检测系统语言
    const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (systemLocale.startsWith('zh')) return 'zh';
    
    return 'en'; // 默认英文
  }

  loadMessages(locale) {
    try {
      const messagesPath = path.join(__dirname, '../locales', `${locale}.json`);
      return JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    } catch (error) {
      // 如果加载失败，回退到英文
      const fallbackPath = path.join(__dirname, '../locales', 'en.json');
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    }
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.messages;

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // 如果找不到，返回 key 本身
      }
    }

    // 替换参数
    if (typeof value === 'string') {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
      });
    }

    return value || key;
  }

  setLocale(locale) {
    this.locale = locale;
    this.messages = this.loadMessages(locale);
  }

  getLocale() {
    return this.locale;
  }
}

// 单例模式
let instance = null;

function getI18n() {
  if (!instance) {
    instance = new I18n();
  }
  return instance;
}

module.exports = { getI18n, I18n };