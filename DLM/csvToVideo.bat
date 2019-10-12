

SETLOCAL EnableDelayedExpansion
set filePath=%1
set csvPath=%2

Set filePath=%filePath:"=%
Set csvPath=%csvPath:"=%

cd DLM\keras-yolo2-master

FOR %%i IN ("%filePath%") DO (
    SET filedrive=%%~di
    SET filedir=%%~pi
    SET filename=%%~ni
    SET fileextension=%%~xi
)
SET baseName=!filename!!fileextension!
SET baseDir=!filedrive!!filedir!

call %userprofile%\Miniconda3\Scripts\activate.bat %userprofile%\Miniconda3
call activate base455

call python csvToVideo.py -c "%csvPath%" -v "%filePath%"

cd ..

move "%baseDir%%filename%_detected.mp4" "Output\%filename%.mp4"