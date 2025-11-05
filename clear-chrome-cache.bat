@echo off
echo Clearing Chrome cache...
start chrome --new-window chrome://settings/clearBrowserData
echo.
echo Instructions:
echo 1. Select "All time" from the time range dropdown
echo 2. Check "Cached images and files"
echo 3. Check "Cookies and other site data"
echo 4. Click "Clear data"
echo 5. Close and reopen Chrome
echo 6. Try visiting your site again
pause
