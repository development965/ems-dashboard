@echo off
REM Double-click this file to set up (first run) and start Techmaax EMS.
REM Safe to run again any time -- it skips steps that are already done.
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo == Techmaax EMS ==
echo.

if not exist "server\.env" (
    echo No server\.env found -- creating one from server\.env.example
    copy /Y "server\.env.example" "server\.env" >nul
    echo.
    echo IMPORTANT: open server\.env and set a real DATABASE_URL and JWT secrets,
    echo then double-click this file again to continue.
    notepad "server\.env"
    goto :end
)

if not exist "node_modules\" (
    echo Installing dependencies ^(first run only, this can take a minute^)...
    call npm install
    if errorlevel 1 goto :fail
)

echo Generating Prisma client...
pushd server
call npx prisma generate
if errorlevel 1 (popd & goto :fail)
popd

if exist "server\prisma\migrations\" (
    echo Applying database migrations...
    pushd server
    call npx prisma migrate deploy
    if errorlevel 1 (popd & goto :fail)
    popd
) else (
    echo Creating and applying the initial database migration...
    pushd server
    call npx prisma migrate dev --name init
    if errorlevel 1 (popd & goto :fail)
    popd
)

echo Seeding the database ^(safe to re-run -- it upserts, no duplicates^)...
pushd server
call npx tsx prisma\seed.ts
if errorlevel 1 (popd & goto :fail)
popd

echo.
echo Starting the API ^(port 4000^) and web app ^(port 5173^)...
echo Press Ctrl+C in this window to stop both.
echo.
call npm run dev
goto :end

:fail
echo.
echo Something went wrong -- see the error above.

:end
echo.
pause
