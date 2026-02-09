# kiro-spec-engine v1.24.1 离线安装指南

由于 GitHub 账号问题，无法通过 npm 在线安装。请使用以下方法进行离线安装。

## 方法 1: 直接从源码安装（推荐）

### 步骤：

1. **将整个项目目录复制到目标机器**
   ```bash
   # 压缩当前目录（排除 node_modules）
   # Windows PowerShell:
   Compress-Archive -Path * -DestinationPath kse-v1.24.1.zip -Exclude node_modules,coverage,.git
   ```

2. **在目标机器上解压并安装依赖**
   ```bash
   # 解压文件
   Expand-Archive kse-v1.24.1.zip -DestinationPath kse-v1.24.1
   cd kse-v1.24.1
   
   # 安装依赖
   npm install
   ```

3. **全局安装**
   ```bash
   npm install -g .
   ```

4. **验证安装**
   ```bash
   kse --version
   # 应该显示: 1.24.1
   ```

## 方法 2: 创建 npm 包（如果 npm 可用）

### 步骤：

1. **在当前目录创建 npm 包**
   ```bash
   npm pack
   # 会生成: kiro-spec-engine-1.24.1.tgz
   ```

2. **将 .tgz 文件复制到目标机器**

3. **在目标机器上安装**
   ```bash
   npm install -g kiro-spec-engine-1.24.1.tgz
   ```

## 方法 3: 手动复制（最简单）

### 步骤：

1. **复制以下文件/目录到目标机器**
   - `bin/` - CLI 入口
   - `lib/` - 核心代码
   - `template/` - 模板文件
   - `locales/` - 国际化文件
   - `docs/` - 文档
   - `package.json` - 包配置
   - `README.md` - 说明文档
   - `LICENSE` - 许可证

2. **在目标目录安装依赖**
   ```bash
   npm install --production
   ```

3. **创建全局链接**
   ```bash
   npm link
   ```

## 依赖列表

如果目标机器无法访问 npm registry，需要手动下载以下依赖：

```json
{
  "chalk": "^4.1.2",
  "chokidar": "^3.5.3",
  "cli-table3": "^0.6.5",
  "commander": "^9.0.0",
  "fs-extra": "^10.0.0",
  "inquirer": "^8.2.0",
  "js-yaml": "^4.1.1",
  "minimatch": "^10.1.1",
  "path": "^0.12.7",
  "semver": "^7.5.4",
  "simple-git": "^3.30.0"
}
```

## 验证安装

安装完成后，运行以下命令验证：

```bash
# 检查版本
kse --version

# 查看帮助
kse --help

# 初始化项目
cd your-project
kse adopt
```

## 新功能（v1.24.1）

- ✅ 嵌套 Git 仓库支持
- ✅ 多仓库管理增强
- ✅ 跨平台路径处理改进

## 故障排除

### 问题 1: npm 命令不可用（Windows 常见问题）

**症状**: 提示 "无法将 npm 项识别为 cmdlet"

**原因**: PowerShell 会话未刷新环境变量

**解决方案**:
```powershell
# 方法 1: 临时添加 Node.js 到 PATH（推荐）
$env:Path = "C:\Program Files\nodejs;$env:Path"
npm --version

# 方法 2: 重启 PowerShell/终端

# 方法 3: 使用完整路径
& "C:\Program Files\nodejs\npm.cmd" --version
```

### 问题 2: 命令找不到
```bash
# 检查全局安装路径
npm config get prefix

# 确保该路径在 PATH 环境变量中
```

### 问题 3: 依赖安装失败
```bash
# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
```

### 问题 4: 权限错误
```bash
# Windows: 以管理员身份运行
# Linux/Mac: 使用 sudo
sudo npm install -g .
```

## 联系支持

如有问题，请查看：
- 文档: `docs/README.md`
- 快速开始: `docs/quick-start.md`
- 故障排除: `docs/troubleshooting.md`
