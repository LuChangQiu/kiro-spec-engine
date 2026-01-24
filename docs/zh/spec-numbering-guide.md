# Spec 编号策略指南

> 为你的 Spec 选择合适编号策略的完整指南

## 概述

Kiro Spec Engine 使用两部分编号系统：`{主序号}-{从序号}-{描述}`

- **主序号**：代表功能领域或主题（01, 02, 03, ...）
- **从序号**：代表该领域内的迭代或子功能（00, 01, 02, ...）
- **描述**：使用 kebab-case 格式的 Spec 描述

**示例**：
- `01-00-user-authentication`（用户认证）
- `01-01-add-oauth-support`（添加 OAuth 支持）
- `02-00-payment-system`（支付系统）

## 何时使用主序号 vs 从序号

### 策略 1：简单项目（推荐大多数情况）

**适用场景**：少于 20 个独立功能的项目

**方法**：只使用主序号，从序号始终为 `00`

```
01-00-user-authentication      # 用户认证
02-00-payment-integration      # 支付集成
03-00-notification-system      # 通知系统
04-00-reporting-dashboard      # 报表仪表板
05-00-api-gateway              # API 网关
```

**优点**：
- ✅ 简单清晰
- ✅ 一目了然
- ✅ 无需提前规划分组
- ✅ 适合独立功能

**何时使用**：
- 构建工具或库
- 功能相对独立
- 项目处于早期阶段
- 小团队（< 5 人）

### 策略 2：按主题分组的复杂项目

**适用场景**：具有明确功能领域的大型项目

**方法**：将相关 Spec 归入同一主序号

```
# 用户管理领域 (01-xx)
01-00-user-authentication-foundation    # 用户认证基础
01-01-add-oauth-support                 # 添加 OAuth 支持
01-02-add-two-factor-auth               # 添加双因素认证
01-03-add-sso-integration               # 添加 SSO 集成

# 支付领域 (02-xx)
02-00-payment-system-mvp                # 支付系统 MVP
02-01-add-subscription-billing          # 添加订阅计费
02-02-add-invoice-generation            # 添加发票生成
02-03-add-refund-workflow               # 添加退款流程

# 通知领域 (03-xx)
03-00-notification-email                # 邮件通知
03-01-notification-sms                  # 短信通知
03-02-notification-push                 # 推送通知
03-03-notification-in-app               # 应用内通知
```

**优点**：
- ✅ 清晰的主题分组
- ✅ 易于追踪功能演进
- ✅ 显示 Spec 之间的关系
- ✅ 适合大型项目扩展

**何时使用**：
- 构建复杂应用
- 功能有明确的领域（用户、支付、通知等）
- 每个领域预期有多次迭代
- 大团队且有领域负责人

### 策略 3：混合方法（灵活）

**适用场景**：从简单开始，按需添加结构

**方法**：初期只用主序号，需要时引入从序号

**阶段 1 - 早期开发**：
```
01-00-mvp-core-features        # MVP 核心功能
02-00-user-management          # 用户管理
03-00-data-storage             # 数据存储
04-00-api-gateway              # API 网关
```

**阶段 2 - 需要迭代时**：
```
01-00-mvp-core-features
02-00-user-management
03-00-data-storage-basic
03-01-data-storage-add-caching      ← 添加迭代
03-02-data-storage-add-replication  ← 添加迭代
04-00-api-gateway
05-00-monitoring-system
```

**优点**：
- ✅ 从简单开始，按需增长
- ✅ 无需过早规划
- ✅ 适应项目演进
- ✅ 兼具两种策略的优点

**何时使用**：
- 项目范围不确定
- 需要灵活性
- 敏捷开发方式
- 学习 Spec 工作流

## 语义化编号规则

### 规则 1：XX-00 用于首个或独立 Spec

使用 `XX-00` 表示：
- 某个领域的第一个 Spec
- 不需要迭代的独立功能
- 独立的功能模块

```
01-00-authentication-system    # 领域首个
02-00-payment-integration      # 独立功能
03-00-email-notifications      # 独立模块
```

### 规则 2：XX-01+ 用于迭代和增强

使用 `XX-01`、`XX-02` 等表示：
- 与之前 Spec 相关的 bug 修复
- 功能增强
- 同一主题的迭代
- 相关功能

```
01-00-authentication-system
01-01-fix-session-timeout-bug       # Bug 修复
01-02-add-remember-me-feature       # 功能增强
01-03-add-password-reset            # 相关功能
```

### 规则 3：保持相关 Spec 在一起

将以下 Spec 分组：
- 共享相同代码库区域
- 相互依赖
- 属于同一功能领域
- 由同一团队维护

```
# 好：相关通知功能分组
03-00-notification-email
03-01-notification-sms
03-02-notification-push

# 避免：不相关功能使用同一主序号
03-00-notification-email
03-01-payment-refunds        # ❌ 与通知无关
```

## 实际案例

### 案例 1：工具/库项目（kiro-spec-engine）

**项目类型**：具有独立功能的 CLI 工具

**策略**：简单编号（XX-00）

```
01-00-user-space-diagnosis              # 用户空间诊断
02-00-oauth-api-upgrade                 # OAuth API 升级
03-00-multi-user-collaboration          # 多用户协作
04-00-watch-mode-automation             # Watch 模式自动化
05-00-agent-hooks-and-automation        # Agent Hooks 和自动化
06-00-test-stability-and-reliability    # 测试稳定性和可靠性
07-00-user-onboarding-and-documentation # 用户引导和文档
08-00-document-lifecycle-management     # 文档生命周期管理
09-00-document-governance-automation    # 文档治理自动化
```

**原因**：每个功能都是独立且完整的

### 案例 2：电商平台

**项目类型**：复杂 Web 应用

**策略**：主题分组

```
# 用户领域
01-00-user-registration-and-login       # 用户注册和登录
01-01-user-profile-management           # 用户资料管理
01-02-user-preferences-and-settings     # 用户偏好和设置

# 商品领域
02-00-product-catalog-foundation        # 商品目录基础
02-01-product-search-and-filters        # 商品搜索和筛选
02-02-product-recommendations           # 商品推荐

# 订单领域
03-00-shopping-cart-system              # 购物车系统
03-01-checkout-process                  # 结账流程
03-02-order-tracking                    # 订单追踪
03-03-order-history                     # 订单历史

# 支付领域
04-00-payment-gateway-integration       # 支付网关集成
04-01-multiple-payment-methods          # 多种支付方式
04-02-payment-security-enhancements     # 支付安全增强
```

**原因**：明确的领域划分，每个领域有多个相关功能

### 案例 3：SaaS 应用

**项目类型**：多租户 SaaS

**策略**：混合方法

```
# 核心功能（独立）
01-00-tenant-management                 # 租户管理
02-00-user-authentication               # 用户认证
03-00-billing-system                    # 计费系统

# 分析领域（分组）
04-00-analytics-foundation              # 分析基础
04-01-analytics-custom-dashboards       # 自定义仪表板
04-02-analytics-export-reports          # 导出报表

# 集成领域（分组）
05-00-api-gateway                       # API 网关
05-01-webhook-system                    # Webhook 系统
05-02-third-party-integrations          # 第三方集成

# 更多独立功能
06-00-email-templates                   # 邮件模板
07-00-notification-center               # 通知中心
```

**原因**：独立功能和分组领域的混合

## 决策树

使用此流程图决定编号策略：

```
这是你的第一个 Spec 吗？
├─ 是 → 使用 01-00-{描述}
└─ 否 → 继续...

这与现有 Spec 相关吗？
├─ 是 → 使用相同主序号，递增从序号
│        示例：01-00 已存在 → 使用 01-01
└─ 否 → 继续...

你预期这个领域会有多次迭代吗？
├─ 是 → 为该领域规划主序号
│        示例：03-00, 03-01, 03-02 用于通知
└─ 否 → 使用下一个可用主序号配 -00
         示例：05-00-new-feature
```

## 最佳实践

### ✅ 应该做

1. **从简单开始**：在需要复杂性之前使用 XX-00
2. **保持一致**：每个项目坚持一种策略
3. **记录你的方法**：在项目 README 中添加说明
4. **使用描述性名称**：让描述清晰明了
5. **预留主序号**：如果规划领域，预留范围

### ❌ 不应该做

1. **不要过度规划**：不要提前创建 50 个主序号
2. **不要混合不相关功能**：保持主序号的主题性
3. **不要跳过数字**：使用连续编号
4. **不要中途改变策略**：坚持你的方法
5. **不要压力过大**：编号是为了组织，不是追求完美

## 策略迁移

### 从简单到主题化

如果你从简单编号开始，需要添加结构：

**之前**：
```
01-00-user-auth
02-00-user-profile
03-00-payment-basic
04-00-payment-subscriptions
```

**之后**（可选重组）：
```
01-00-user-auth
01-01-user-profile          # 与认证分组
02-00-payment-basic
02-01-payment-subscriptions # 与支付分组
```

**注意**：重命名现有 Spec 是可选的。你可以保留旧编号，从现在开始使用新策略。

## 工具支持

Kiro Spec Engine 提供命令帮助编号：

```bash
# 列出所有 Spec 及其编号
kse status

# 按主序号分组查看 Spec
kse workflows

# 获取下一个可用编号建议
kse workflows --suggest-next
```

## 总结

**根据项目复杂度选择策略**：

- **简单项目**：所有使用 `XX-00`
- **复杂项目**：按领域分组使用 `XX-YY`
- **不确定**：从简单开始，稍后添加结构

**记住**：目标是组织和清晰，而不是完美。选择适合你的团队和项目的方式。

---

**相关文档**：
- [Spec 工作流指南](./spec-workflow.md)
- [快速开始指南](./quick-start.md)
- [常见问题](./faq.md)

**版本**：1.0  
**最后更新**：2026-01-24
