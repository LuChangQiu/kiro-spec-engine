@echo off
setlocal enabledelayedexpansion

set WORKSPACE_NAME=%1
set CONTEXTS_DIR=.kiro\contexts
set STEERING_DIR=.kiro\steering
set ACTIVE_FILE=%CONTEXTS_DIR%\.active
set CURRENT_CONTEXT=%STEERING_DIR%\CURRENT_CONTEXT.md

if "%WORKSPACE_NAME%"=="" (
    echo Usage: %0 ^<workspace-name^>
    echo.
    echo Available workspaces:
    dir /b "%CONTEXTS_DIR%" 2>nul | findstr /v "^\." | findstr /v "README.md"
    exit /b 1
)

set WORKSPACE_DIR=%CONTEXTS_DIR%\%WORKSPACE_NAME%
if not exist "%WORKSPACE_DIR%" (
    echo Error: Workspace '%WORKSPACE_NAME%' does not exist
    echo.
    echo Available workspaces:
    dir /b "%CONTEXTS_DIR%" 2>nul | findstr /v "^\." | findstr /v "README.md"
    echo.
    echo Create a new workspace with:
    echo   .kiro\create-workspace.bat %WORKSPACE_NAME%
    exit /b 1
)

REM 保存当前工作区
if exist "%ACTIVE_FILE%" (
    set /p OLD_WORKSPACE=<"%ACTIVE_FILE%"
    if exist "%CONTEXTS_DIR%\!OLD_WORKSPACE!" (
        echo 💾 Saving current context to workspace: !OLD_WORKSPACE!
        copy /y "%CURRENT_CONTEXT%" "%CONTEXTS_DIR%\!OLD_WORKSPACE!\CURRENT_CONTEXT.md" >nul
    )
)

REM 加载新工作区
echo 📥 Loading context from workspace: %WORKSPACE_NAME%
copy /y "%WORKSPACE_DIR%\CURRENT_CONTEXT.md" "%CURRENT_CONTEXT%" >nul

REM 更新活跃工作区
echo %WORKSPACE_NAME%> "%ACTIVE_FILE%"

echo ✅ Switched to workspace: %WORKSPACE_NAME%
