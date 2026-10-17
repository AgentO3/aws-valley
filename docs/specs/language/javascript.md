---
id: javascript
layer: language
extends: []
---

# JavaScript

## Purpose

JavaScript's loose semantics — implicit type coercion, `var` hoisting, late-bound `this`, mutable built-in prototypes — produce whole categories of bugs that disappear when a team commits to the modern language subset. Block-scoped declarations, strict equality, ES modules, and `async` / `await` are now universally supported; reaching for older idioms still works but interacts badly with newer code and forces every reader to hold two mental models at once. This spec pins the modern subset so any file in the repo can be read with consistent semantics and so the lint / formatter toolchain is a reliable gate rather than an advisory check.

## References

- **external** `https://eloquentjavascript.net/` — Eloquent JavaScript (Marijn Haverbeke) — canonical text on modern JS idioms
- **external** `https://developer.mozilla.org/en-US/docs/Web/JavaScript` — MDN JavaScript reference
- **external** `https://tc39.es/ecma262/` — ECMA-262 (ECMAScript) language specification
- **external** `https://eslint.org/docs/latest/rules/` — ESLint core rules
- **external** `https://github.com/airbnb/javascript` — Airbnb JavaScript style guide

## Rules

1. Declare variables with `const` by default and `let` only when reassignment is required; do not use `var`.
2. Compare with strict equality (`===` / `!==`); do not use `==` or `!=`.
3. Format every `.js` / `.mjs` / `.cjs` file with Prettier using a single committed config; CI must fail on unformatted files.
4. Lint with ESLint using at minimum the `@eslint/js` recommended ruleset (flat config) or `eslint:recommended` (legacy); do not disable rules inline without a comment explaining why.
5. Use ES module syntax (`import` / `export`); do not use `require()` or `module.exports` in new code.
6. Do not use `eval`, `new Function(<string>)`, or pass a string to `setTimeout` / `setInterval`.
7. Do not use the `with` statement.
8. Use rest parameters (`...args`) in function signatures; do not reference the `arguments` object in new code.
9. Use template literals for string interpolation; do not concatenate strings with `+` to build formatted output.
10. Destructure object and array values when multiple members are read from the same source in the same scope.
11. Use the spread operator (`...`) for shallow copying and merging of arrays and objects; do not use `Object.assign({}, ...)` or `Array.prototype.slice.call(...)` for these cases.
12. Use `async` / `await` for sequential asynchronous flow; do not mix `await` with `.then()` / `.catch()` chains in the same function.
13. Do not leave floating promises; `await`, `return`, or explicitly `void` every promise-returning call whose result is not otherwise consumed.
14. Throw `Error` instances (or subclasses of `Error`); do not throw strings, numbers, or plain objects.
15. Do not modify or extend built-in prototypes (`Object.prototype`, `Array.prototype`, `String.prototype`, etc.).
16. Use `Object.hasOwn(obj, key)` to test own properties; do not call `obj.hasOwnProperty(key)` directly.
17. Name variables, functions, and methods in `camelCase`; name classes and constructor functions in `PascalCase`; name module-level compile-time-literal constants in `UPPER_SNAKE_CASE`.
18. Use arrow functions for callbacks and single-expression helpers; use named function declarations for recursive, exported, or stack-trace-visible functions.
19. Do not mutate function parameters; return new values or accept an explicit output target instead.
20. Check explicitly against `null` / `undefined` when the value domain includes falsy-but-valid values (`0`, `''`, `false`); do not rely on truthiness in those cases.
21. Iterate with `for...of` or higher-order array methods (`map`, `filter`, `reduce`, `forEach`); reserve C-style `for (let i = 0; ...)` for cases that need the index or early termination semantics.
