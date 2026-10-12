import { LATEX_LITE_SCRIPT, LATEX_LITE_STYLE } from '$lib/canvas/latex-lite';

export const MAX_GENERATIVE_CANVAS_HTML_CHARS = 300_000;

const CSP_CONTENT =
	"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'";

const CANVAS_LAYOUT_STYLE = `<style data-pip-canvas-layout>
html {
  padding: 8px !important;
  box-sizing: border-box;
}
html, body {
  margin: 0 !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  overflow: visible !important;
}
</style>`;

const RESIZE_BRIDGE_SCRIPT = `<script data-pip-canvas-resize>
(function () {
  var last = 0;
  function measure() {
    var html = document.documentElement;
    var body = document.body;
    var height = 0;
    if (html) {
      height = Math.max(height, html.scrollHeight, html.offsetHeight);
    }
    if (body) {
      height = Math.max(height, body.scrollHeight, body.offsetHeight);
      var nodes = body.querySelectorAll('*');
      for (var i = 0; i < nodes.length; i++) {
        var rect = nodes[i].getBoundingClientRect();
        var bottom = rect.bottom + (window.scrollY || window.pageYOffset || 0);
        if (bottom > height) height = bottom;
      }
    }
    return Math.ceil(height);
  }
  function report() {
    try {
      var height = measure();
      if (!height || height === last) return;
      last = height;
      parent.postMessage({ source: 'pip-canvas', version: 1, type: 'resize', height: height }, '*');
    } catch (e) {}
  }
  report();
  window.addEventListener('load', report);
  window.addEventListener('resize', report);
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(report);
    if (document.documentElement) ro.observe(document.documentElement);
    if (document.body) ro.observe(document.body);
  }
  setInterval(report, 500);
})();
</script>`;

export type PrepareGenerativeCanvasHtmlResult =
	{ ok: true; html: string } | { ok: false; error: string };

function normalizeToFullDocument(html: string): string {
	const trimmed = html.trim();
	if (/^\s*<!doctype\s+html/i.test(trimmed)) return trimmed;
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
${trimmed}
</body>
</html>`;
}

function injectCspMeta(html: string): string {
	// Only skip when our host-owned meta is already present; never trust authored CSP text.
	if (html.includes('data-pip-canvas-csp')) return html;
	const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP_CONTENT}" data-pip-canvas-csp>`;
	if (/<head[^>]*>/i.test(html)) {
		return html.replace(/<head([^>]*)>/i, `<head$1>\n${meta}`);
	}
	if (/<html[^>]*>/i.test(html)) {
		return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>\n${meta}\n</head>`);
	}
	return `${meta}\n${html}`;
}

function injectBeforeBodyClose(html: string, snippet: string): string {
	const lower = html.toLowerCase();
	const bodyClose = lower.lastIndexOf('</body>');
	if (bodyClose !== -1) {
		return `${html.slice(0, bodyClose)}\n${snippet}\n${html.slice(bodyClose)}`;
	}
	return `${html}\n${snippet}`;
}

function injectInHead(html: string, snippet: string): string {
	if (/<head[^>]*>/i.test(html)) {
		return html.replace(/<head([^>]*)>/i, `<head$1>\n${snippet}`);
	}
	if (/<html[^>]*>/i.test(html)) {
		return html.replace(/<html([^>]*)>/i, `<html$1>\n<head>\n${snippet}\n</head>`);
	}
	return `${snippet}\n${html}`;
}

/** Ensure CSP, overflow-safe layout, and height reporting — safe to run on client for stored artifacts. */
export function ensureGenerativeCanvasHtml(html: string): string {
	let document = normalizeToFullDocument(html.trim());
	document = injectCspMeta(document);
	if (document.includes('data-pip-canvas-layout')) {
		document = document.replace(
			/<style\b[^>]*data-pip-canvas-layout[^>]*>[\s\S]*?<\/style>/i,
			CANVAS_LAYOUT_STYLE
		);
	} else {
		document = injectInHead(document, CANVAS_LAYOUT_STYLE);
	}
	if (!document.includes('data-pip-latex-lite')) {
		document = injectInHead(document, LATEX_LITE_STYLE);
		document = injectBeforeBodyClose(document, LATEX_LITE_SCRIPT);
	}
	if (!document.includes('data-pip-canvas-resize')) {
		document = injectBeforeBodyClose(document, RESIZE_BRIDGE_SCRIPT);
	}
	return document;
}

export function prepareGenerativeCanvasHtml(html: string): PrepareGenerativeCanvasHtmlResult {
	const trimmed = html.trim();
	if (!trimmed) {
		return { ok: false, error: 'Canvas HTML cannot be empty.' };
	}
	if (trimmed.length > MAX_GENERATIVE_CANVAS_HTML_CHARS) {
		return {
			ok: false,
			error: `Canvas HTML exceeds the ${MAX_GENERATIVE_CANVAS_HTML_CHARS} character limit.`
		};
	}

	return { ok: true, html: ensureGenerativeCanvasHtml(trimmed) };
}
