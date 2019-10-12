

SETLOCAL EnableDelayedExpansion
set filePath=%1
set DLM=%2

Set filePath=%filePath:"=%
Set DLM=%DLM:"=%

echo %filePath%
cd DLM\keras-yolo2-master

FOR %%i IN ("%filePath%") DO (
    SET filedrive=%%~di
    SET filepath=%%~pi
    SET filename=%%~ni
    SET fileextension=%%~xi
)
SET baseName=!filename!!fileextension!
SET baseDir=!filedrive!!filepath!

call %userprofile%\Miniconda3\Scripts\activate.bat %userprofile%\Miniconda3
call activate base455

if "%DLM%"=="YOLO" (
    call python predict.py -c yolo-config.json -w yolo-model.h5 -i "%baseDir%%filename%%fileextension%"
) else (
    call python mnet-predict.py -c mnet-config.json -w mnet-model.h5 -i "%baseDir%%filename%%fileextension%"
)


cd ..

move "%baseDir%%filename%_detected.mp4" "Output\%filename%.mp4"
move "%baseDir%%filename%.csv" "Output\%filename%.csv"