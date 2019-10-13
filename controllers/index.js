const $ = require('jquery') 
const { remote } = require('electron')
const mime = require('mime-types')
const FileListBox = require('../components/FileListBox')
const FileSelector = require('../components/FileSelector')
const fs = require('fs')
const os = require('os')
const parseCSV = require("../components/CSVParser");
const path = require('path')

var ffprobe = require('ffprobe'), ffprobeStatic = require('ffprobe-static');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const { Menu, MenuItem, dialog, BrowserWindow, shell, app  } = remote

// Create Menu
let win = remote.getCurrentWindow();
const menu = new Menu()
menu.append(new MenuItem({ label: 'File', submenu: [{label: "Load Data", click: ()=>$("#btnLoadData").click()}, {label: "Import CSV", click: ()=>$("#btnImportCsv").click()}] }))
menu.append(new MenuItem({ label: 'Help', submenu: [
   {label: "User Guide", click: ()=>{
      shell.openItem(path.resolve(app.getAppPath(), './User_Guide/user_guide.pdf'));
   }}, 
   {label: "About"}, 
   {label: "Open Dev Tools", accelerator: 'CmdOrCtrl+Shift+I', click: () => {
      win.webContents.openDevTools({ mode: 'detach' });
   }}] 
}));
Menu.setApplicationMenu(menu);

// Objects
const ogButton = 'Process Data <i class="fas fa-angle-double-right"></i>';
let fileListBox = new FileListBox($(".fileList"));

// Utilities
function getVideoFiles() {
   return fileListBox.files.filter(x=>!x.parent);
}

function isPlaying(vid) {
   return !!(vid.currentTime > 0 && !vid.paused && !vid.ended && vid.readyState > 2);
}

// Handlers
$("#btnLoadData").click(async (e) => {
   let files = dialog.showOpenDialogSync({
      title: "Load Data",
      filters: [{name: "MP4 Files", extensions: ["mp4"]}],
      properties: ["multiSelections"]
   });
   if (files && files.length)
      fileListBox.setFiles(files);
});

$("#btnImportCsv").click(async (e) => {

   let files = dialog.showOpenDialogSync({
      title: "Import CSV",
      filters: [{name: "CSV Files", extensions: ["csv"]}],
      properties: ["openFile"]
   });
   if (!files || !files.length) return;

   if (fileListBox.files.some(x => files.some(y => x.path === y))) {
      dialog.showMessageBox({type: "warning", message: "You cannot select the same csv file twice", title: "Duplicate CSV"})
      return;
   }
   if (files.some(x => !x.toLowerCase().endsWith(".csv"))){
      dialog.showMessageBox({type: "warning", message: "All files must be in csv format", title: "Wrong format"})
      return;
   }
   if (files.length === 1) {
      // single csv select
      if (fileListBox.selectedIndex === null) {
         dialog.showMessageBox({type: "warning", message: "When importing a single CSV, you must select a matching video file", title: "No file selected"})
         return;
      }
      let inputFilePath = fileListBox.selectedFilePath;
      let outputFilePath = await csvToVideo(inputFilePath, files[0]);
      if (!fs.existsSync(outputFilePath)) {
         dialog.showMessageBox({type: "error", message: "Something went wrong creating the output video", title: "Error"});
         return;
      }
      fileListBox.addFile(files[0], inputFilePath);
      fileListBox.setStats(inputFilePath, await buildStats(inputFilePath, files[0], outputFilePath));
   } else {
      // multi csv select
      for (let f of files) {
         let genPath = f.substr(0, f.length - 4);
         let parent = fileListBox.files.find(x=>x.path.startsWith(genPath));
         if (!parent) {
            dialog.showMessageBox({type: "warning", message: "When importing multiple CSV's, each csv file should have a matching video file with the same name and path", title: "Unmatched CSVs"})
            return;
         }
      }
      for (let f of files) {
         let genPath = f.substr(0, f.length - 4);
         let parent = fileListBox.files.find(x=>x.path.startsWith(genPath));

         let inputFilePath = parent.path;
         let outputFilePath = await csvToVideo(inputFilePath, f);
         if (!fs.existsSync(outputFilePath)) {
            dialog.showMessageBox({type: "error", message: "Something went wrong creating the output video", title: "Error"});
            return;
         }
         fileListBox.addFile(f, inputFilePath);
         fileListBox.setStats(inputFilePath, await buildStats(inputFilePath, f, outputFilePath));
      }
   }
   refreshVideo();
});

/**
 * @param {string} vidPath 
 * @param {string} csvPath 
 */
async function csvToVideo(vidPath, csvPath) {
   setProgress(-1);
   $(".statusBar span").html("Status: "+"Initialising video generation");
   let deleteOnDone = false;
   if (path.extname(vidPath) !== ".mp4") {
      let baseInputName = path.basename(vidPath);
      let newFilePath = os.tmpdir() + "/" + baseInputName.substr(0, baseInputName.length - 3) + "mp4";
      fs.copyFileSync(vidPath, newFilePath);
      vidPath = newFilePath;
   }
   let python = require('child_process').spawn('"'+path.resolve('./DLM/csvToVideo.bat')+'"', ['"'+vidPath+'"', '"'+path.resolve(csvPath)+'"'], { shell: true });
   let updFunc = function(data){
      let line = data.toString('utf8');
      console.log(line);
      let matches = /(\d+)%/.exec(line);
      if (matches)
         setProgress(Number(matches[1]), "video generation");
   };
   python.stdout.on('data', updFunc);
   python.stderr.on('data', updFunc);
   let prom = new Promise(async (resolve)=>{
      python.once("exit", async ()=>{
         setProgress(99);
         if (deleteOnDone) fs.unlinkSync(vidPath);
         let outputFilePath = "./DLM/Output/"+vidPath.replace(/^.*[\\\/]/, '');
         if (fs.existsSync(outputFilePath)) {
            let basedir = path.dirname(outputFilePath);
            let base = path.basename(outputFilePath);
            await new Promise(async (resolve)=>{
               let probeResult = await ffprobe(outputFilePath, { path: ffprobeStatic.path });
               let totalFrames = Number(probeResult.streams.find(x=>x.codec_type==="video").nb_frames);
               ffmpeg(outputFilePath).videoCodec('libx264').on('progress', function(progress) {
                  setProgress(Math.round(progress.frames/totalFrames * 100), "video conversion");
                }).on('end', function(stdout, stderr) {
                  fs.unlinkSync(outputFilePath);
                  fs.renameSync(basedir+"/"+base.substr(0, base.length - 4)+"_h264.mp4", outputFilePath)
                  resolve();
               }).save(basedir+"/"+base.substr(0, base.length - 4)+"_h264.mp4");
            });
         }
         setProgress(100);
         resolve(outputFilePath);
      });
   });
   return prom;
}

$("#btnProcess").click(async ()=>{
   setProgress(-1, "detection");
   let vidFiles = getVideoFiles();
   if (fileListBox.selectedIndex === null) {
      dialog.showMessageBox({type: "warning", message: "You must select a video to process first", title: "No file selected"});
      return;
   }
   if (fileListBox.selectedFile.stats) {
      dialog.showMessageBox({type: "warning", message: "This video has already been processed", title: "Already processed"});
      return;
   }
   let inputFilePath = fileListBox.selectedFilePath;
   let baseInputName = path.basename(inputFilePath);
   let deleteOnDone = false;
   if (path.extname(inputFilePath) !== ".mp4") {
      let newFilePath = os.tmpdir() + "/" + baseInputName.substr(0, baseInputName.length - 3) + "mp4";
      fs.copyFileSync(inputFilePath, newFilePath);
      inputFilePath = newFilePath;
   }
   let outputFilePath = "./DLM/Output/"+inputFilePath.replace(/^.*[\\\/]/, '');
   let python = require('child_process').spawn('"'+path.resolve('./DLM/process.bat')+'"', ['"'+inputFilePath+'"', '"'+$("#setDLM").val()+'"'], { shell: true });
   python.stdout.on('data',function(data){
      let line = data.toString('utf8');
      console.log(line);
      let matches = /(\d+)%/.exec(line);
      if (matches && Number(matches[1])!==100)
         setProgress(Number(matches[1]), "detection");
   });
   python.stderr.on('data',function(data){
      let line = data.toString('utf8');
      console.log(line);
      let matches = /(\d+)%/.exec(line);
      if (matches && Number(matches[1])!==100)
         setProgress(Number(matches[1]), "detection");
   });
   python.once("exit", async ()=>{
      if (deleteOnDone) fs.unlinkSync(inputFilePath);
      if (!fs.existsSync(outputFilePath.substr(0, outputFilePath.length - 4) + ".csv")) {
         dialog.showMessageBox({type: "error", message: "Something went wrong in the detection algorithm", title: "Detection Error"});
         setProgress(100);
         return;
      }
      await csvToVideo(inputFilePath, path.resolve(outputFilePath.substr(0, outputFilePath.length - 4) + ".csv"));
      if (!fs.existsSync(outputFilePath)) {
         dialog.showMessageBox({type: "error", message: "Something went wrong creating the output video", title: "Error"});
         setProgress(100);
         return;
      }
      fileListBox.setStats(
         inputFilePath, 
         await buildStats(
            inputFilePath, 
            outputFilePath.substr(0, outputFilePath.length - 4) + ".csv", 
            outputFilePath
         )
      );
      setProgress(100);
      refreshVideo();
   });
});

$("#btnPrevVideo").click((e) => {
   if (fileListBox.selectedIndex !== null && fileListBox.selectedIndex > 0) {
      fileListBox.selectFile(fileListBox.files[fileListBox.selectedIndex - 1].path);
   }
});

$("#btnNextVideo").click((e) => {
   let vidFiles = getVideoFiles();
   if (fileListBox.selectedIndex !== null && fileListBox.selectedIndex !== fileListBox.files.length-1) {
      let next = fileListBox.files[fileListBox.selectedIndex + 1];
      if (next.parent && fileListBox.files.length > fileListBox.selectedIndex + 2) {
         fileListBox.selectFile(fileListBox.files[fileListBox.selectedIndex + 2].path);
      } else {
         fileListBox.selectFile(fileListBox.files[fileListBox.selectedIndex + 1].path);
      }
      
   }
});

$("#chkShowBoxes").change(()=>{
   refreshVideo();
});

fileListBox.onChange(()=>{
   refreshVideo();
   refreshButtons();
});

fileListBox.onModify(()=>{
   refreshButtons();
});

function setProgress(num, step) {
   step = step ? step + " " : "";
   if (num == null || isNaN(num) || num === 100) {
      $("#btnProcess").html(ogButton);
      $("#btnProcess").css("background", "rgba(52,199,52,1)");
      $(".statusBar span").html("Status: Ready");
      return;
   }
   if (num === -1) {
      $("#btnProcess").html("Initialising...");
      $(".statusBar span").html("Status: "+"Initialising "+step);
   } else {
      $("#btnProcess").html("Processing "+num+"%");
      $(".statusBar span").html("Status: "+"Processing "+step+num+"%");
   }

   $("#btnProcess").css("background", 
      "linear-gradient(90deg, rgba(52,199,52,1) "+num+"%, rgba(200,200,200,1) "+num+"%)");
}

function refreshButtons() {
   let next = false, prev = false;
   if (fileListBox.selectedIndex === null || getVideoFiles().length <= 1) {
      prev = false; next = false; 
   } else {
      if ((fileListBox.files[fileListBox.selectedIndex - 1] && !fileListBox.files[fileListBox.selectedIndex - 1].parent) ||
      (fileListBox.files[fileListBox.selectedIndex - 2] && !fileListBox.files[fileListBox.selectedIndex - 2].parent)) {
         prev = true;
      }
      if ((fileListBox.files[fileListBox.selectedIndex + 1] && !fileListBox.files[fileListBox.selectedIndex + 1].parent) ||
      (fileListBox.files[fileListBox.selectedIndex + 2] && !fileListBox.files[fileListBox.selectedIndex + 2].parent)) {
         next = true;
      }
   }

   $("#btnPrevVideo").attr("disabled", !prev);
   $("#btnNextVideo").attr("disabled", !next);
}

// table build task
let sharkCnt = $("#sharkCnt"), surfCnt = $("#surferCnt"), dolphCnt = $("#dolphinCnt"), statsTBody = $(".statsTable tbody");
let noDataDisplayed = false;
setInterval(() => {
   let f = fileListBox.selectedFile;
   let vid = $(".vid:not(.inactive)");
   if (f && f.stats) {
      // has statistics
      $(".statsTableCont .noData").hide();
      noDataDisplayed = false;

      statsTBody.empty();
      if (f.stats.frames.length) {
         let prevDiff = -1;
         for (let i = 0; i < f.stats.frames.length; i++) {
            var frame = f.stats.frames[i];
            let tDiff = Math.abs(vid[0].currentTime - (frame.frame / f.stats.fps))
            if (i !== 0 && prevDiff < tDiff) {
               frame = f.stats.frames[i-1];
               break;
            }
            prevDiff = tDiff;
         }
         let i = 0;
         for (let obj of frame.objects || []) {
            statsTBody.append($(`
               <tr>
                  <td>${++i}</td>
                  <td>${obj.label}</td>
                  <td>${Math.round(obj.confidence*100)}%</td>
               </tr>
            `));
         }
      }
   } else if (!noDataDisplayed && (!f || !f.stats)) {
      // no statistics
      sharkCnt.text(0);
      surfCnt.text(0);
      dolphCnt.text(0);
      $(".statsTable tbody").empty();
      $(".statsTableCont .noData").show();
      noDataDisplayed = true;
   }
}, 40); // 25Hz

async function buildStats(vidPath, csvPath, outVidPath) {
   let probeResult = await ffprobe(vidPath, { path: ffprobeStatic.path });
   let fps = probeResult.streams.find(x=>x.codec_type==="video").r_frame_rate;
   fps = /(\d+)\/(\d+)/.exec(fps);
   fps = Number(fps[1]) / Number(fps[2]);
   /** @type {FileListBox.VidStats} */ 
   let stats = {originalPath: vidPath, csvPath: csvPath, fps: fps, processedPath: outVidPath};
   stats.frames = await parseCSV(csvPath);
   return stats;
}

function refreshVideo() {
   let mainsrc = $("#mainVid source").attr("src");
   let outsrc = $("#outVid source").attr("src");
   if (!fileListBox.selectedFilePath) {
      $("#mainVid").removeClass("inactive");
      $("#outVid").addClass("inactive");
      $("#mainVid source").attr("src", null);
      $("#mainVid source").attr("type", null);
      $("#outVid source").attr("src", null);
      $("#outVid source").attr("type", null);

      // reload videos if necessary
      if (mainsrc !== $("#mainVid source").attr("src")) 
         $("#mainVid")[0].load();
      if (outsrc !== $("#outVid source").attr("src")) 
         $("#outVid")[0].load();
   } else {
      let showOutput = $("#chkShowBoxes").is(":checked");
      let outputPath = fileListBox.selectedFile.stats ? path.resolve(fileListBox.selectedFile.stats.processedPath) : null;
      let outputExists = fs.existsSync(outputPath);
      
      // set source files
      $("#mainVid source").attr("src", fileListBox.selectedFilePath);
      $("#mainVid source").attr("type", mime.lookup(fileListBox.selectedFilePath));
      if (outputExists) {
         $("#outVid source").attr("src", outputPath);
         $("#outVid source").attr("type", mime.lookup(outputPath));
      } else {
         $("#outVid source").attr("src", null);
         $("#outVid source").attr("type", null);
      }

      // reload videos if necessary
      if (mainsrc !== $("#mainVid source").attr("src")) 
         $("#mainVid")[0].load();
      if (outsrc !== $("#outVid source").attr("src")) 
         $("#outVid")[0].load();
            
      // decide which video to show
      if (showOutput && outputExists && $("#outVid").is(".inactive")) {
         // showing output video
         $("#outVid")[0].currentTime = $("#mainVid")[0].currentTime;
         if (isPlaying($("#mainVid")[0])) {
            $("#outVid").one("playing", () => {
               $("#mainVid").addClass("inactive");
               $("#outVid").removeClass("inactive");
            });
            $("#outVid")[0].play();
            $("#mainVid")[0].pause();
         } else {
            $("#mainVid").addClass("inactive");
            $("#outVid").removeClass("inactive");
         }
      } else if ((!showOutput || !outputExists) && $("#mainVid").is(".inactive")) {
         // showing input video
         $("#mainVid")[0].currentTime = $("#outVid")[0].currentTime;
         if (isPlaying($("#outVid")[0])) {
            $("#mainVid").one("playing", () => {
               $("#mainVid").removeClass("inactive");
               $("#outVid").addClass("inactive");
            });
            $("#mainVid")[0].play();
            $("#outVid")[0].pause();
         } else {
            $("#mainVid").removeClass("inactive");
            $("#outVid").addClass("inactive");
         }
      }
   }
}

$("#btnSaveVideo").click(()=>{
   if (!fileListBox.selectedFile) {
      dialog.showMessageBox({type: "warning", message: "You must select a video", title: "Nothing Selected"});
      return;
   }
   if (!fileListBox.selectedFile.stats) {
      dialog.showMessageBox({type: "warning", message: "Video must be processed", title: "Unprocessed video"});
      return;
   }
   let og_basename = path.basename(fileListBox.selectedFile.stats.originalPath);
   let savePath = dialog.showSaveDialogSync({
      title: "Save Video",
      defaultPath: path.dirname(fileListBox.selectedFile.stats.originalPath)+"/"+og_basename.substr(0, og_basename.length - 4)+"_processed.mp4"
   });
   if (savePath) {
      fs.copyFileSync(fileListBox.selectedFile.stats.processedPath, savePath);
   }
});

$("#btnExportCSV").click(()=>{
   if (!fileListBox.selectedFile) {
      dialog.showMessageBox({type: "warning", message: "You must select a video", title: "Nothing Selected"});
      return;
   }
   if (!fileListBox.selectedFile.stats) {
      dialog.showMessageBox({type: "warning", message: "Video must be processed", title: "Unprocessed video"});
      return;
   }
   let og_basename = path.basename(fileListBox.selectedFile.stats.originalPath);
   let savePath = dialog.showSaveDialogSync({
      title: "Export CSV",
      defaultPath: path.dirname(fileListBox.selectedFile.stats.originalPath)+"/"+og_basename.substr(0, og_basename.length - 4)+".csv"
   });
   if (savePath) {
      fs.copyFileSync(fileListBox.selectedFile.stats.csvPath, savePath);
   }
});