@echo off
cd /d "D:\AI Project\Social Media Assistant\brain-growth-dashboard"
taskkill /F /IM node.exe 2>nul
rmdir /s /q .next 2>nul
npx next dev --port 8080
