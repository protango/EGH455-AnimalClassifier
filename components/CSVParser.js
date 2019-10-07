const FileListBox = require('../components/FileListBox')
const readline = require('readline');
const fs = require('fs');

/**
 * 
 * @param {string} csvPath 
 * @returns {FileListBox.FrameStat[]}
 */
async function parseCSV(csvPath) {
    const readInterface = readline.createInterface({
        input: fs.createReadStream(csvPath),
        output: process.stdout,
        console: false
    });
    /** @type {FileListBox.FrameStat[]} */
    let result = [];
    readInterface.on('line', function(line) {
        let halves = line.split(",");
        if (isNaN(Number(halves[0]))) return;
        let objects = [];
        let matches, rx = /([A-Za-z]+) ([\d\.]+) ([\d\.]+) ([\d\.]+) ([\d\.]+) ([\d\.]+)/g;
        while (matches = rx.exec(halves[1])) {
            objects.push({
                label: matches[1],
                xMin: Number(matches[2]),
                yMin: Number(matches[3]),
                xMax: Number(matches[4]),
                yMax: Number(matches[5]),
                confidence: Number(matches[6]),
            });
        }

        result.push({frame: Number(halves[0]), objects: objects});
    });
    await new Promise((resolve)=>readInterface.once('close', ()=>resolve()));

    return result;
}

module.exports = parseCSV;