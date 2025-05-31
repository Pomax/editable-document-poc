import { makeEditable } from "./make-editable.js";

const p = document.querySelector(`main p`);
p.innerHTML = p.innerHTML.replace(/\s+/g, ` `).trim();
makeEditable(p);
