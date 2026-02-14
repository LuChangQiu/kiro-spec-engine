# kse 离线安装指南

> 适用于无法直接访问 npm registry 的环境。

---

**版本**: 1.46.2  
**最后更新**: 2026-02-14

---

## 前置条件

- Node.js >= 16
- npm 可用（建议 npm >= 8）

验证：

```bash
node --version
npm --version
```

---

## 方式 1：使用 `.tgz` 离线包安装（推荐）

1. 获取离线包文件（示例：`kiro-spec-engine-1.46.2.tgz`）。
2. 在目标机器执行：

```bash
npm install -g kiro-spec-engine-1.46.2.tgz
```

3. 验证：

```bash
kse --version
kse --help
```

---

## 方式 2：从源码离线安装

1. 将项目目录复制到目标机器（建议排除 `node_modules/.git/coverage`）。
2. 在目标机器安装依赖并全局安装：

```bash
npm install
npm install -g .
```

3. 验证：

```bash
kse --version
```

---

## Windows 常见问题

### 问题：`npm` 命令不可用

症状：PowerShell 提示无法识别 `npm`。

解决：

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm --version
```

---

## 安装后建议的 90 秒验证

```bash
cd your-project
kse adopt
kse spec bootstrap --name 01-00-demo-feature --non-interactive
kse value metrics snapshot --input ./kpi-input.json --json
```

如果最后一步成功，说明你的环境已经可以输出机器可读 KPI 结果（用于周度评审和门禁证据）。

---

## 相关文档

- [文档索引](README.md)
- [快速入门](quick-start.md)
- [命令参考](command-reference.md)
- [Value 可观测指南](value-observability-guide.md)
