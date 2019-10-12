import argparse
import cv2
from tqdm import tqdm
from preprocessing import parse_annotation
from utils import draw_boxes
from preprocessing import parse_annotation
import numpy as np

argparser = argparse.ArgumentParser(
    description='Train and validate YOLO_v2 model on any dataset')

argparser.add_argument(
    '-c',
    '--csv',
    help='path to csv file')

argparser.add_argument(
    '-v',
    '--video',
    help='path to video file')

def _main_(args):
    csvFile  = args.csv
    videoFile = args.video

    write_box_on_video(csvFile, videoFile)

def write_box_on_video(csvFilein, image_path):

    video_out = image_path[:-4] + '_detected' + image_path[-4:]
    video_reader = cv2.VideoCapture(image_path)

    nb_frames = int(video_reader.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_h = int(video_reader.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_w = int(video_reader.get(cv2.CAP_PROP_FRAME_WIDTH))
    fps = float(video_reader.get(cv2.CAP_PROP_FPS))

    print(fps)
    

    video_writer = cv2.VideoWriter(video_out,
                            cv2.VideoWriter_fourcc(*'MPEG'), 
                            fps, 
                            (frame_w, frame_h))

    csvFile = open(csvFilein, 'r')
    csvFileData = csvFile.read()
    csvFileLines = csvFileData.split("\n")

    for line in tqdm(csvFileLines[1:-1]):

        _, image = video_reader.read()

        stage1 = line.split(",") #First split by comma

        if(len(stage1) > 1):

            values = stage1[1] #Choose 2nd element (1st index)
            
            all_vals = values.split(" ")#Then split by space
            
            #Then gather every 6 values (label, xmin, ymin, xmax, ymax, confidence)
            xmins = []
            ymins = []
            xmaxs = []
            ymaxs = []
            confidences = []
            labels = []
            for i in range(0, int(len(all_vals)/6)):
                labels.append(all_vals[6*i])
                xmins.append(float(all_vals[6*i + 1]))
                ymins.append(float(all_vals[6*i + 2]))
                xmaxs.append(float(all_vals[6*i + 3]))
                ymaxs.append(float(all_vals[6*i + 4]))
                confidences.append(all_vals[6*i + 5])

            image = draw_boxes_on_video(image, labels, xmins, ymins, xmaxs, ymaxs, confidences)
            video_writer.write(np.uint8(image))

    video_reader.release()
    video_writer.release()
    
    return

def draw_boxes_on_video(image, label, x_min, y_min, x_max, y_max, confidence):
    image_h, image_w, _ = image.shape

    for i in range(len(label)):

        xmin = int(x_min[i]*image_w)
        ymin = int(y_min[i]*image_h)
        xmax = int(x_max[i]*image_w)
        ymax = int(y_max[i]*image_h)

        cv2.rectangle(image, (xmin,ymin), (xmax,ymax), (0,255,0), 3)
        cv2.putText(image, 
                    label[i] + ' ' + confidence[i], 
                    (xmin, ymin - 13), 
                    cv2.FONT_HERSHEY_SIMPLEX, 
                    1e-3 * image_h, 
                    (0,255,0), 2)

    return image

            



if __name__ == '__main__':
    args = argparser.parse_args()
    _main_(args)