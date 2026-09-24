import { greet } from "./logic.js";

const input = document.getElementById("name");
const out = document.getElementById("out");
const render = () => { out.textContent = greet(input.value); };
input.addEventListener("input", render);
render();
