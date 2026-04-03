<template>
  <RouterView />
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #app { height: 100%; overflow: hidden; }
body {
  font-family: 'Segoe UI', Tahoma, sans-serif;
  background: #1a5c2e;
  color: white;
}
button {
  padding: 11px 26px;
  border: none;
  border-radius: 7px;
  font-size: 1em;
  cursor: pointer;
  font-weight: bold;
  font-family: inherit;
  transition: opacity 0.1s, transform 0.1s;
}
button:hover:not(:disabled) { opacity: 0.9; transform: scale(1.03); }
button:active:not(:disabled) { transform: scale(0.97); }
button:disabled { opacity: 0.35; cursor: default; transform: none; }
</style>
