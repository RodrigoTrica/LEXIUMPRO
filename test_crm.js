const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const code = fs.readFileSync('js/23-prospectos-crm.js', 'utf8');
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="prospectos-crm"></div></body></html>');

// Mock window and document
global.window = dom.window;
global.document = dom.window.document;

try {
    eval(code);
    console.log("typeof prospectosRender:", typeof window.prospectosRender);
    console.log("typeof prospectosConvertirACausa:", typeof window.prospectosConvertirACausa);

    // Check if style was injected
    const style = document.getElementById('prospectos-crm-styles');
    console.log("Style injected:", !!style);
} catch (err) {
    console.error("Error evaluating:", err);
}
