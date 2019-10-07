const $ = require('jquery') 
const { remote } = require('electron')
const mime = require('mime-types')
const FileListBox = require('../components/FileListBox')
const FileSelector = require('../components/FileSelector')
const fs = require('fs')
const parseCSV = require("../components/CSVParser");

var ffprobe = require('ffprobe'), ffprobeStatic = require('ffprobe-static');
const { Menu, MenuItem, dialog } = remote

// Create Menu
//const menu = new Menu()
//menu.append(new MenuItem({ label: 'File', submenu: [{label: "Load Data"}, {label: "Import CSV"}] }))
//menu.append(new MenuItem({ label: 'Help', submenu: [{label: "User Guide"}, {label: "About"}] }))
//Menu.setApplicationMenu(menu);

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
   let files = await FileSelector("video/*", true);
   fileListBox.setFiles([...files].map(x => x.path));
});

$("#btnImportCsv").click(async (e) => {
   let files = (await FileSelector(".csv", true));

   if (fileListBox.files.some(x => [...files].some(y => x.path === y.path))) {
      dialog.showMessageBox({type: "warning", message: "You cannot select the same csv file twice", title: "Duplicate CSV"})
      return;
   }
   if ([...files].some(x => !x.path.toLowerCase().endsWith(".csv"))){
      dialog.showMessageBox({type: "warning", message: "All files must be in csv format", title: "Wrong format"})
      return;
   }
   $(".statusBar span").html("Status: Processing CSV files...");
   if (files.length === 1) {
      // single csv select
      if (fileListBox.selectedIndex === null) {
         dialog.showMessageBox({type: "warning", message: "When importing a single CSV, you must select a matching video file", title: "No file selected"})
         return;
      }
      fileListBox.addFile(files[0].path, fileListBox.selectedFilePath);
      fileListBox.setStats(fileListBox.selectedFilePath, await buildStats(fileListBox.selectedFilePath, files[0].path));
   } else {
      // multi csv select
      doneFiles = [];
      for (let f of files) {
         let genPath = f.path.substr(0, f.path.length - 4);
         let parent = fileListBox.files.find(x=>x.path.startsWith(genPath));
         if (!parent) {
            dialog.showMessageBox({type: "warning", message: "When importing multiple CSV's, each csv file should have a matching video file with the same name and path", title: "Unmatched CSVs"})
            for (let df of doneFiles) fileListBox.removeFile(df);
            return;
         }
         fileListBox.addFile(f.path, parent.path);
         fileListBox.setStats(parent.path, await buildStats(parent.path, f.path));
         doneFiles.push(f.path);
      }
   }
   $(".statusBar span").html("Status: Ready");
   
});

$("#btnProcess").click(async ()=>{
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
   let outputFilePath = "./DLM/Output/"+inputFilePath.replace(/^.*[\\\/]/, '');
   let python = require('child_process').spawn('python', ['./DLM/process.py', fileListBox.selectedFilePath]);
   
   python.stdout.on('data',function(data){
      setProgress(Number(data.toString('utf8')));
   });
   python.once("exit", ()=>{
      setProgress(100);
      fileListBox.setStats(
         inputFilePath, 
         buildStats(
            inputFilePath, 
            outputFilePath.substr(0, outputFilePath.length - 4) + ".csv", 
            outputFilePath
         )
      );
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

function setProgress(num) {
   if (!num || num === NaN || num === 100) {
      $("#btnProcess").html(ogButton);
      $("#btnProcess").css("background", "rgba(52,199,52,1)");
      $(".statusBar span").html("Status: Ready");
      return;
   }
   $("#btnProcess").html("Processing "+num+"%");
   $(".statusBar span").html("Status: "+"Processing "+num+"%");
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
let sharkCnt = $("#sharkCnt"), surfCnt = $("#surferCnt"), dolphCnt = $("#dolphinCnt");
let noDataDisplayed = false;
setInterval(() => {
   let f = fileListBox.selectedFile;
   let vid = $(".vid:not(.inactive)");
   if (f && f.stats && isPlaying(vid[0])) {
      // has statistics
      $(".statsTableCont .noData").hide();
      noDataDisplayed = false;


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
   if (!outVidPath) {
      let outputFilePath = "./DLM/Output/"+vidPath.replace(/^.*[\\\/]/, '');
      await new Promise((resolve) => {
         let python = require('child_process').spawn('python', ['./DLM/makeVideo.py', vidPath, csvPath]);
         python.once('exit', function() {resolve();});
      });
      stats.processedPath = outputFilePath;
   }
   stats.frames = parseCSV(csvPath);
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
      let outputPath = "./DLM/Output/" + fileListBox.selectedFilePath.replace(/^.*[\\\/]/, '');
      let outputExists = fs.existsSync(outputPath);
      
      // set source files
      $("#mainVid source").attr("src", fileListBox.selectedFilePath);
      $("#mainVid source").attr("type", mime.lookup(fileListBox.selectedFilePath));
      if (outputExists) {
         $("#outVid source").attr("src", "." + outputPath);
         $("#outVid source").attr("type", mime.lookup("." + outputPath));
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