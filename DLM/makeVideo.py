# USAGE:
# python makeVideo.py "[PATH_TO_VIDEO]" "[PATH_TO_CSV]"
import sys, os
from shutil import copyfile
import ntpath
import time

videoPath = sys.argv[1]
scriptDir = os.path.dirname(os.path.abspath(__file__))

# simulate work
for i in range(100):
    time.sleep(0.01)

# copy file to output directory
copyfile(videoPath, scriptDir + "/Output/" + ntpath.basename(videoPath))


