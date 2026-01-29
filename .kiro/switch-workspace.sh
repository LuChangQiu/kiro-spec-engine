#!/bin/bash

WORKSPACE_NAME=$1
CONTEXTS_DIR=".kiro/contexts"
STEERING_DIR=".kiro/steering"
ACTIVE_FILE="$CONTEXTS_DIR/.active"
CURRENT_CONTEXT="$STEERING_DIR/CURRENT_CONTEXT.md"

# 检查参数
if [ -z "$WORKSPACE_NAME" ]; then
    echo "Usage: $0 <workspace-name>"
    echo ""
    echo "Available workspaces:"
    ls -1 "$CONTEXTS_DIR" 2>/dev/null | grep -v "^\." | grep -v "README.md"
    exit 1
fi

# 检查工作区是否存在
WORKSPACE_DIR="$CONTEXTS_DIR/$WORKSPACE_NAME"
if [ ! -d "$WORKSPACE_DIR" ]; then
    echo "Error: Workspace '$WORKSPACE_NAME' does not exist"
    echo ""
    echo "Available workspaces:"
    ls -1 "$CONTEXTS_DIR" 2>/dev/null | grep -v "^\." | grep -v "README.md"
    echo ""
    echo "Create a new workspace with:"
    echo "  bash .kiro/create-workspace.sh $WORKSPACE_NAME"
    exit 1
fi

# 保存当前工作区的 CURRENT_CONTEXT.md
if [ -f "$ACTIVE_FILE" ]; then
    OLD_WORKSPACE=$(cat "$ACTIVE_FILE")
    if [ -n "$OLD_WORKSPACE" ] && [ -d "$CONTEXTS_DIR/$OLD_WORKSPACE" ]; then
        echo "💾 Saving current context to workspace: $OLD_WORKSPACE"
        cp "$CURRENT_CONTEXT" "$CONTEXTS_DIR/$OLD_WORKSPACE/CURRENT_CONTEXT.md"
    fi
fi

# 加载新工作区的 CURRENT_CONTEXT.md
echo "📥 Loading context from workspace: $WORKSPACE_NAME"
cp "$WORKSPACE_DIR/CURRENT_CONTEXT.md" "$CURRENT_CONTEXT"

# 更新活跃工作区标记
echo "$WORKSPACE_NAME" > "$ACTIVE_FILE"

echo "✅ Switched to workspace: $WORKSPACE_NAME"
