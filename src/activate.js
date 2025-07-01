import "./preprocess.js";

// we could use designMode on the document, but we
// also want spell check enabled, so we might as
// well keep everything local to the document body:

document.body.contentEditable = true;
document.body.spellcheck = true;
