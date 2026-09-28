import latexLiteRuntime from '$lib/canvas/latex-lite-runtime.js?raw';

/** Tiny `$...$` / `$$...$$` renderer injected into generative canvas iframes (no KaTeX/CDN). */

export const LATEX_LITE_STYLE = `<style data-pip-latex-lite>
.pip-math {
  font-family: "Times New Roman", Times, "Liberation Serif", serif;
  font-style: italic;
  white-space: nowrap;
  line-height: 1.2;
}
.pip-math-display {
  display: block;
  text-align: center;
  margin: 0.35em 0;
  white-space: normal;
  overflow-x: auto;
}
.pip-math .rm { font-style: normal; }
.pip-math sub, .pip-math sup {
  font-size: 0.75em;
  font-style: italic;
  line-height: 0;
}
.pip-frac {
  display: inline-block;
  vertical-align: middle;
  text-align: center;
  font-style: italic;
  margin: 0 0.15em;
}
.pip-frac > span {
  display: block;
  padding: 0 0.2em;
}
.pip-frac .pip-num {
  border-bottom: 1px solid currentColor;
  padding-bottom: 0.08em;
}
.pip-frac .pip-den { padding-top: 0.08em; }
.pip-sqrt {
  display: inline-block;
  position: relative;
  margin: 0 0.1em;
  padding: 0 0.15em 0 0.55em;
  border-top: 1px solid currentColor;
  font-style: italic;
}
.pip-sqrt::before {
  content: "√";
  position: absolute;
  left: 0;
  top: -0.15em;
  font-style: normal;
  font-size: 1.15em;
}
</style>`;

export const LATEX_LITE_SCRIPT = `<script data-pip-latex-lite>
${latexLiteRuntime}
</script>`;
