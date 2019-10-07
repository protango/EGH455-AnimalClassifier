# USAGE:
# python process.py "[PATH_TO_VIDEO]"
import sys, os
from shutil import copyfile
import ntpath
import time

videoPath = sys.argv[1]
scriptDir = os.path.dirname(os.path.abspath(__file__))

# simulate work
for i in range(100):
    print(i) # printing progress to console - electron will recieve this
    time.sleep(0.01)
    sys.stdout.flush()

# copy file to output directory
copyfile(videoPath, scriptDir + "/Output/" + ntpath.basename(videoPath))


