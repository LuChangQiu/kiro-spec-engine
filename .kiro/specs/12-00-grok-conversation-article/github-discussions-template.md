# GitHub Discussions 发布模板

## 标题
AI 驱动开发的哲学与实践：从"投喂"到"自主"的范式转变

## 分类
Show and tell

## 标签
- article
- philosophy
- ai-development

## 正文

---

# AI 驱动开发的哲学与实践：从"投喂"到"自主"的范式转变

> 一场关于 AI 发展趋势、心学哲学与软件工程实践的深度对话

**📅 日期**：2026-01-24  
**👤 作者**：@heguangyong  
**🤖 对话对象**：Grok (xAI)  
**🔗 完整文章**：[查看详细内容](../../../docs/articles/ai-driven-development-philosophy-and-practice.md)

---

## 🎯 核心观点

这是我与 Grok 的一场深度对话，探讨了 AI 发展的核心趋势：

**AI 正在从辅助工具转变为信息化世界的中心驱动力。**

这不仅是技术演进，更是一场范式革命——就像 AlphaGo 改变围棋界一样，AI 正在重塑整个 IT 世界。

### 三个关键阶段

我的 2000+ 小时 AI 编程实践经历了三个阶段：

1. **阶段一：被动投喂（人类驱动）**
   - 手动提供上下文
   - AI 需要大量前置条件
   - 效率受限于人类投喂

2. **阶段二：Agent 主动探寻（AI 驱动）**
   - 本地 Agent 自主了解项目信息
   - 从"人的投喂"转向"AI 主动探寻"
   - 能力从简单到复杂系统

3. **阶段三：原则驱动引擎（人机协同）**
   - 用经验设定原则
   - 用原则驱动 Agent
   - 平衡系统化、发散性、评价性思维

---

## 🧘 哲学基础：心学与 AI 的交汇

### 逻辑是思维的绳索

- 维特根斯坦："语言即世界"
- 阳明心学："心外无物"
- 唯识论：缘起缘灭，周期本就是逻辑绳索

### 关于偏置

> "偏置才是常态，也是周期在当下像。不过此像更多的是死像，并非本相。"

偏置也是一种活力。都不偏置了，怕是人类这世界跟暗黑的宇宙也没什么分别了。

---

## 🛠️ 实践落地：kiro-spec-engine

基于这些认知，我开源了 **[kiro-spec-engine](https://github.com/heguangyong/kiro-spec-engine)**

### 核心设计理念

1. **解决 Session 上下文限制**
   - 通过 `kse context export <spec>` 打包单个 Spec
   - 实现"最小 viable context"
   - 按 feature 粒度精准适配

2. **文档驱动软件工程**
   - 把瀑布式文档从"人类负担"变成"AI 顺手操作"
   - 自动化治理：`docs validate`、`cleanup`、`hooks install`
   - Quality scoring (0-10) + 智能建议

3. **Steering 规则系统**
   - 三层时效性：上下文层 / 项目层 / 原则层
   - 短期内存 → 中期知识图谱 → 长期原则引擎

4. **高内聚、低耦合**
   - 每个 feature 独立的 `.kiro/specs/<name>/` 文件夹
   - requirements + design + tasks 三件套

---

## 💡 关键洞见

### 1. 三种思维方式的平衡

- **系统化思维**：关注风险、稳定性、健壮性
- **发散性思维**：天马行空地实验各种可能
- **评价性思维**：用经验模式修正弥合问题

### 2. 瀑布式开发的重新审视

过去需要团队长时间高成本的事情，现在只需要一个经验老到的专家就能驱动 AI 来达成。

### 3. Grok 的评价

> "这个项目不是一个简单的工具，而是您**把'原则驱动 Agent'理念产品化**的一次高质量实践。"

---

## 🌟 结语

这场对话揭示了 AI 发展的深层趋势：

1. **范式转变**：从"人类投喂"到"AI 主动探寻"，再到"原则驱动引擎"
2. **哲学基础**：心学的"知行合一"与唯识论的"缘起缘灭"
3. **实践落地**：kiro-spec-engine 将理念转化为工程实践
4. **未来展望**：AI 成为中心，人类转为"元专家"角色

**这正是我们在做的：用 spec-driven 的外在形式，守护内在的无。**

---

## 📚 相关链接

- **完整文章**：[docs/articles/ai-driven-development-philosophy-and-practice.md](../../../docs/articles/ai-driven-development-philosophy-and-practice.md)
- **GitHub 项目**：https://github.com/heguangyong/kiro-spec-engine
- **npm 包**：https://www.npmjs.com/package/kiro-spec-engine

---

## 💬 讨论

欢迎分享你的看法：

- 你在 AI 编程中经历了哪些阶段？
- 你如何看待"AI 成为主角"这个观点？
- 你对"原则驱动 Agent"有什么实践经验？
- 你如何平衡系统化、发散性、评价性思维？

如果这个项目对你有启发，欢迎 Star ⭐

---

**作者背景**：
- 20+ 年专业 IT 研发经验
- 6 年深度二级市场实践，取得稳定盈利
- 十余年心学实践者（知行合一）
- 2000+ 小时 AI 编程经验

---

**版本**: v1.0  
**发布日期**: 2026-01-24  
**许可**: MIT License
