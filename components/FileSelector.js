const $ = require('jquery');

let pendingRejection = null;

function getInput() {
    let elem = $("#ZfileSelect");
    if (!elem.length)
        return $("<input id='ZfileSelect' type='file' style='display: none' />");
    return elem;
}

/**
 * Opens a file picker and returns a promise for an array of selected files
 * @param {string} [accept] Accepted file types in format understandable by HTML file input
 * @param {boolean} [multiple] Whether to allow multiple files
 * @returns {Promise<FileList>} Array containing the file path of all items that were selected
 */
function FileSelector(accept, multiple) {
    // reject all pending fileSelectors
    if (pendingRejection) pendingRejection("Another file selector was opened");
    pendingRejection = null;

    let inputElem = getInput();
    inputElem.off();
    inputElem[0].value="";
    inputElem.attr("accept", accept);
    inputElem.attr("multiple", multiple);
    $("body").append(inputElem);
    inputElem.click();
    let promise = new Promise((resolve, reject) => {
        pendingRejection = reject;
        inputElem.change((e) => {
            resolve(inputElem.prop('files'));
            pendingRejections = null;
        });
    });
    return promise;
}

module.exports = FileSelector;