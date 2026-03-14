@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo   DURAK SERVER VPS LAUNCHER (ULTIMATE)
echo ==========================================

:: 1. Проверка Node
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js не найден!
    pause
    exit /b
)

:: 2. Установка зависимостей
echo [INFO] Проверка зависимостей...
call npm install

:: 3. Очистка и сборка
echo [INFO] Сборка проекта...
if exist "server\dist" rd /s /q "server\dist"
if exist "shared\dist" rd /s /q "shared\dist"

:: Собираем Shared
cd shared
call npx tsc
cd ..

:: Собираем Server
cd server
call npx tsc
if %errorlevel% neq 0 (
    echo [ERROR] Сборка сервера упала!
    pause
    exit /b
)
cd ..

:: 4. Настройка БД
echo [INFO] Настройка БД Prisma...
cd server
call npx prisma generate
call npx prisma db push --accept-data-loss
cd ..

:: 5. Запуск
echo [SUCCESS] Всё собрано! Запускаю сервер...
echo ------------------------------------------
cd server
:: Запускаем через node, но отключаем встроенную поддержку TS, если она мешает
call node dist/index.js

pause
