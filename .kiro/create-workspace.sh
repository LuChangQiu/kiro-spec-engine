#!/bin/bash

WORKSPACE_NAME=$1
CONTEXTS_DIR=".kiro/contexts"
STEERING_DIR=".kiro/steering"

if [ -z "$WORKSPACE_NAME" ]; then
    echo "Usage: $0 <workspace-name>"
    exit 1
fi

WORKSPACE_DIR="$CONTEXTS_DIR/$WORKSPACE_NAME"

if [ -d "$WORKSPACE_DIR" ]; then
    echo "Error: Workspace '$WORKSPACE_NAME' already exists"
    exit 1
fi

# 创建工作区目录
mkdir -p "$WORKSPACE_DIR"

# 复制当前的 CURRENT_CONTEXT.md 作为模板
if [ -f "$STEERING_DIR/CURRENT_CONTEXT.md" ]; then
    cp "$STEERING_DIR/CURRENT_CONTEXT.md" "$WORKSPACE_DIR/CURRENT_CONTEXT.md"
    echo "✅ Created workspace: $WORKSPACE_NAME (copied from current context)"
else
    # 创建默认模板
    cat > "$WORKSPACE_DIR/CURRENT_CONTEXT.md" << EOF
# 当前场景规则

> 个人工作区 - 准备开始工作

## 🎯 当前状态

**活跃 Spec**: 无

**工作区**: $WORKSPACE_NAME

**下一步**: 等待开始新的任务

---

v1.0 | $(date +%Y-%m-%d)
EOF
    echo "✅ Created workspace: $WORKSPACE_NAME (with default template)"
fi

echo ""
echo "Switch to this workspace with:"
echo "  bash .kiro/switch-workspace.sh $WORKSPACE_NAME"
