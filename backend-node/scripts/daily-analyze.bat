@echo off
cd /d "%~dp0.."
node scripts/daily-analyze.js >> ..\data\cron.log 2>&1
