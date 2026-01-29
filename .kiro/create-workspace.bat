@echo off
setlocal

set WORKSPACE_NAME=%1
set CONTEXTS_DIR=.kiro\contexts
set STEERING_DIR=.kiro\steering

if "%WORKSPACE_NAME%"=="" (
    echo Usage: %0 ^<workspace-name^>
    exit /b 1
)

set WORKSPACE_DIR=%CONTEXTS_DIR%\%WORKSPACE_NAME%

if exist "%WORKSPACE_DIR%" (
    echo Error: Workspace '%WORKSPACE_NAME%' already exists
    exit /b 1
)

REM 创建工作区目录
mkdir "%WORKSPACE_DIR%"

REM 复制当前的 CURRENT_CONTEXT.md 作为模板
if exist "%STEERING_DIR%\CURRENT_CONTEXT.md" (
    copy /y "%STEERING_DIR%\CURRENT_CONTEXT.md" "%WORKSPACE_DIR%\CURRENT_CONTEXT.md" >nul
    echo ✅ Created workspace: %WORKSPACE_NAME% ^(copied from current context^)
) else (
    REM 创建默认模板
    (
        echo # 当前场景规则
        echo.
        echo ^> 个人工作区 - 准备开始工作
        echo.
        echo ## 🎯 当前状态
        echo.
        echo **活跃 Spec**: 无
        echo.
        echo **工作区**: %WORKSPACE_NAME%
        echo.
        echo **下一步**: 等待开始新的任务
        echo.
        echo ---
        echo.
        echo v1.0 ^| %date%
    ) > "%WORKSPACE_DIR%\CURRENT_CONTEXT.md"
    echo ✅ Created workspace: %WORKSPACE_NAME% ^(with default template^)
)

echo.
echo Switch to this workspace with:
echo   .kiro\switch-workspace.bat %WORKSPACE_NAME%
