// Pure logic for the prototype — no DOM access here, so node --test can cover it.

export function greet(name = "") {
  return `Hello, ${name.trim() || "world"}!`;
}
