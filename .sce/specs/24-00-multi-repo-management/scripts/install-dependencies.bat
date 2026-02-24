@echo off
REM Install dependencies for Spec 24-00 Multi-Repository Management
echo Installing simple-git and cli-table3...

REM Try different npm paths
if exist "E:\ProgramFiles\nodejs\npm.cmd" (
    call "E:\ProgramFiles\nodejs\npm.cmd" install simple-git cli-table3 --save
) else if exist "E:\Program Files\nodejs\npm.cmd" (
    call "E:\Program Files\nodejs\npm.cmd" install simple-git cli-table3 --save
) else (
    npm install simple-git cli-table3 --save
)

echo.
echo Dependencies installation complete!
pause
