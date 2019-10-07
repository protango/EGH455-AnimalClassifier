const $ = require('jquery');

/** @type {()=>void} */
let onChangeHandler = ()=>{};
let onModifyHandler = ()=>{};

class FileListBox {
    /** @type {ZFile[]} */ files = [];
    /** @type {JQuery<HTMLElement>} */ element = null;
    /** @type {number} */ selectedIndex = null;
    /** @type {string} */
    get selectedFilePath() {
        if (this.selectedIndex===null) return null;
        return this.files[this.selectedIndex].path;
    }
    /** @type {ZFile} */
    get selectedFile() {
        if (this.selectedIndex===null) return null;
        return this.files[this.selectedIndex];
    }

    /**
     * Constructs a new FileListBox
     * @param {JQuery<HTMLElement>} element 
     */
    constructor(element) {
       this.element = element;
       element.empty();
       element.attr("class", "fileList");
    }

    /**
     * Adds a new file to this box
     * @param {string} filePath The file path
     * @param {string} [parentPath] The files parent path
     */
    addFile(filePath, parentPath) {
        let name = filePath.replace(/^.*[\\\/]/, '');
        let elem = $(
            '<div class="' + (parentPath?"sub":"") + '" title="' + name + '">' +
                '<i class="fas ' + (parentPath?"fa-file-csv":"fa-file-video") + '"></i>' +
                '<span>' + name + '</span>' +
                '<button class="del">x</button>' +
            '</div>');
        elem.click(() => this.selectFile(filePath));
        elem.children(".del").click(() => this.removeFile(filePath));

        let parent = null;
        let zfile = {
            path: filePath,
            elem: elem
        };
        if (parentPath) {
            parent = this.files.find(x => x.path === parentPath);
            if (!parent) throw "The parent does not exist";
            for (let a of this.files.filter(x=>x.parent===parent)) this.removeFile(a.path);
            zfile.parent = parent;
            elem.insertAfter(parent.elem);
            this.files.splice(this.files.indexOf(parent) + 1, 0, zfile);
        } else {
            this.element.append(elem);
            this.files.push(zfile);
        }
        onModifyHandler();
        if (this.files.length === 1)
            this.selectFile(filePath);
    }

    /**
     * Removes a file from this box
     * @param {string} filePath The file path
     */
    removeFile(filePath) {
        for(let f of this.files.filter(x => x.parent && x.parent.path === filePath)) 
            this.removeFile(f.path);

        let idx = this.files.findIndex(x => x.path === filePath);
        if (idx >= 0) {
            let f = this.files[idx];
            if (f.parent) this.rmStats(f.parent.path);
            f.elem.remove();
            this.files.splice(idx, 1);
        }
        onModifyHandler();
        if (this.selectedIndex !== null) {
            if (this.files.length === 0) 
                this.selectFile(null);
            else if (this.selectedIndex >= this.files.length)
                this.selectFile(this.files[this.files.length-1].path);
            else if (idx === this.selectedIndex)
                this.selectFile(this.files[0].path);
        }
        
    }

    /**
     * Sets the files in this box
     * @param {string[]} filePaths The file paths
     */
    setFiles(filePaths) {
        this.empty();
        for (let f of filePaths) this.addFile(f);
    }

    /**
     * Empties this box
     */
    empty() {
        this.files = [];
        this.element.empty();
        onModifyHandler();
        this.selectFile(null);
    }

    /**
     * Selects a file
     * @param {string} filePath The file path to select
     */
    selectFile(filePath) {
        if (filePath===null) {
            this.selectedIndex = null;
            this.element.children().removeClass("selected");
            onChangeHandler();
            return;
        }
        let f = this.files.find(x => x.path === filePath);
        if (!f) throw("This file name does not exist in this box");
        if (f.parent) {
            this.selectFile(f.parent.path);
            return;
        }

        this.element.children().removeClass("selected");
        f.elem.addClass("selected");
        this.selectedIndex = this.files.indexOf(f);
        onChangeHandler();
    }

    setStats(vidPath, stats) {
        let f = this.files.find(x => x.path === vidPath);
        f.stats = stats;
        f.elem.children("i").css("color", "green");
    }

    rmStats(vidPath, stats) {
        let f = this.files.find(x => x.path === vidPath);
        f.stats = null;
        f.elem.children("i").css("color", "black");
    }

    /**
     * Registers an event handler for when the selected item changes
     * @param {()=>void} fxn Handler
     */
    onChange(fxn) {
        onChangeHandler = fxn;
    }

    /**
     * Registers an event handler for when the items change
     * @param {()=>void} fxn Handler
     */
    onModify(fxn) {
        onModifyHandler = fxn;
    }
 }

 module.exports = FileListBox;

 /** 
  * @typedef {object} ZFile
  * @property {string} path
  * @property {JQuery<HTMLElement>} elem
  * @property {ZFile} [parent]
  * @property {VidStats} [stats]
  */

/** 
  * @typedef {object} VidStats
  * @property {string} originalPath
  * @property {string} processedPath
  * @property {string} csvPath
  * @property {number} fps
  * @property {FrameStat[]} frames
  */

/** 
  * @typedef {object} FrameStat
  * @property {number} frame
  * @property {{label:string, confidence:number, xMin:number, yMin:number, xMax:number, yMax:number}[]} objects
  */