/* eslint-disable @typescript-eslint/ban-ts-comment -- plain iframe runtime injected as a raw string */
// @ts-nocheck
(function () {
	var GREEK = {
		alpha: 'α',
		beta: 'β',
		gamma: 'γ',
		delta: 'δ',
		epsilon: 'ε',
		zeta: 'ζ',
		eta: 'η',
		theta: 'θ',
		iota: 'ι',
		kappa: 'κ',
		lambda: 'λ',
		mu: 'μ',
		nu: 'ν',
		xi: 'ξ',
		pi: 'π',
		rho: 'ρ',
		sigma: 'σ',
		tau: 'τ',
		upsilon: 'υ',
		phi: 'φ',
		chi: 'χ',
		psi: 'ψ',
		omega: 'ω',
		Alpha: 'Α',
		Beta: 'Β',
		Gamma: 'Γ',
		Delta: 'Δ',
		Theta: 'Θ',
		Lambda: 'Λ',
		Pi: 'Π',
		Sigma: 'Σ',
		Phi: 'Φ',
		Psi: 'Ψ',
		Omega: 'Ω'
	};
	var SYMBOLS = {
		cdot: '·',
		times: '×',
		div: '÷',
		pm: '±',
		mp: '∓',
		leq: '≤',
		geq: '≥',
		neq: '≠',
		approx: '≈',
		sim: '∼',
		infty: '∞',
		deg: '°',
		circ: '∘',
		to: '→',
		rightarrow: '→',
		leftarrow: '←',
		leftrightarrow: '↔',
		implies: '⇒',
		partial: '∂',
		nabla: '∇',
		hbar: 'ℏ',
		ell: 'ℓ',
		angle: '∠',
		perp: '⊥',
		parallel: '∥',
		propto: '∝'
	};
	var FUNCS = {
		sin: 'sin',
		cos: 'cos',
		tan: 'tan',
		sec: 'sec',
		csc: 'csc',
		cot: 'cot',
		arcsin: 'arcsin',
		arccos: 'arccos',
		arctan: 'arctan',
		sinh: 'sinh',
		cosh: 'cosh',
		tanh: 'tanh',
		ln: 'ln',
		log: 'log',
		exp: 'exp',
		lim: 'lim',
		max: 'max',
		min: 'min',
		det: 'det',
		dim: 'dim'
	};

	function esc(text) {
		return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function takeBrace(src, i) {
		if (src.charAt(i) !== '{') return null;
		var depth = 0;
		for (var j = i; j < src.length; j++) {
			var ch = src.charAt(j);
			if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth === 0) return { inner: src.slice(i + 1, j), next: j + 1 };
			}
		}
		return null;
	}

	function renderAtom(ch) {
		if (/[0-9.,:;!?=+\-*/()[\]|]/.test(ch)) return '<span class="rm">' + esc(ch) + '</span>';
		if (/\s/.test(ch)) return ch === ' ' ? ' ' : '';
		return esc(ch);
	}

	function takeGroup(src, i) {
		if (i >= src.length) return { html: '', next: i };
		if (src.charAt(i) === '{') {
			var braced = takeBrace(src, i);
			if (!braced) return { html: esc(src.charAt(i)), next: i + 1 };
			return { html: renderExpr(braced.inner), next: braced.next };
		}
		if (src.charAt(i) === '\\') {
			var rest = parseCommand(src, i);
			return { html: rest.html, next: rest.next };
		}
		return { html: renderAtom(src.charAt(i)), next: i + 1 };
	}

	function parseCommand(src, i) {
		var m = /^\\([A-Za-z]+)/.exec(src.slice(i));
		if (!m) return { html: esc(src.charAt(i)), next: i + 1 };
		var name = m[1];
		var next = i + m[0].length;
		while (src.charAt(next) === ' ') next++;

		if (name === 'frac') {
			var num = takeGroup(src, next);
			var den = takeGroup(src, num.next);
			return {
				html:
					'<span class="pip-frac"><span class="pip-num">' +
					num.html +
					'</span><span class="pip-den">' +
					den.html +
					'</span></span>',
				next: den.next
			};
		}
		if (name === 'sqrt') {
			var rad = takeGroup(src, next);
			return { html: '<span class="pip-sqrt">' + rad.html + '</span>', next: rad.next };
		}
		if (name === 'text' || name === 'mathrm' || name === 'mathbf' || name === 'operatorname') {
			var t = takeGroup(src, next);
			return { html: '<span class="rm">' + t.html + '</span>', next: t.next };
		}
		if (name === 'left' || name === 'right') {
			if (next < src.length) {
				var delim = src.charAt(next);
				if (delim === '.') return { html: '', next: next + 1 };
				return { html: '<span class="rm">' + esc(delim) + '</span>', next: next + 1 };
			}
			return { html: '', next: next };
		}
		if (name === 'quad') return { html: '&nbsp;&nbsp;&nbsp;&nbsp;', next: next };
		if (name === 'qquad')
			return { html: '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;', next: next };
		if (GREEK[name]) return { html: GREEK[name], next: next };
		if (SYMBOLS[name]) return { html: '<span class="rm">' + SYMBOLS[name] + '</span>', next: next };
		if (FUNCS[name]) return { html: '<span class="rm">' + FUNCS[name] + '</span>', next: next };
		return { html: esc('\\' + name), next: next };
	}

	function renderExpr(src) {
		src = String(src || '')
			.replace(/\r\n|\r|\n/g, ' ')
			.trim();
		var out = '';
		var i = 0;
		while (i < src.length) {
			var ch = src.charAt(i);
			if (ch === '\\') {
				var cmd = parseCommand(src, i);
				out += cmd.html;
				i = cmd.next;
				continue;
			}
			if (ch === '_' || ch === '^') {
				var kind = ch === '_' ? 'sub' : 'sup';
				i++;
				while (src.charAt(i) === ' ') i++;
				var g = takeGroup(src, i);
				out += '<' + kind + '>' + g.html + '</' + kind + '>';
				i = g.next;
				continue;
			}
			if (ch === '{') {
				var b = takeBrace(src, i);
				if (!b) {
					out += esc(ch);
					i++;
					continue;
				}
				out += renderExpr(b.inner);
				i = b.next;
				continue;
			}
			out += renderAtom(ch);
			i++;
		}
		return out;
	}

	function wrap(html, display) {
		return '<span class="pip-math' + (display ? ' pip-math-display' : '') + '">' + html + '</span>';
	}

	function renderText(text) {
		var re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
		var result = '';
		var last = 0;
		var match;
		while ((match = re.exec(text))) {
			result += esc(text.slice(last, match.index));
			if (match[1] != null) result += wrap(renderExpr(match[1]), true);
			else result += wrap(renderExpr(match[2]), false);
			last = match.index + match[0].length;
		}
		result += esc(text.slice(last));
		return result;
	}

	function shouldSkip(el) {
		if (!el || el.nodeType !== 1) return true;
		var tag = el.tagName;
		return (
			tag === 'SCRIPT' ||
			tag === 'STYLE' ||
			tag === 'TEXTAREA' ||
			tag === 'INPUT' ||
			tag === 'SELECT' ||
			tag === 'CODE' ||
			tag === 'PRE' ||
			(el.classList && el.classList.contains('pip-math')) ||
			(el.closest && el.closest('.pip-math'))
		);
	}

	function walk(node) {
		if (!node) return;
		if (node.nodeType === 3) {
			var value = node.nodeValue;
			if (!value || value.indexOf('$') === -1) return;
			if (!/\$[^$]+\$|\$\$[\s\S]+?\$\$/.test(value)) return;
			var span = document.createElement('span');
			span.innerHTML = renderText(value);
			node.parentNode.replaceChild(span, node);
			return;
		}
		if (shouldSkip(node)) return;
		var children = Array.prototype.slice.call(node.childNodes);
		for (var i = 0; i < children.length; i++) walk(children[i]);
	}

	function renderAll() {
		walk(document.body);
	}

	window.pipRenderLatex = renderAll;
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', renderAll);
	} else {
		renderAll();
	}
	setTimeout(renderAll, 0);
	setTimeout(renderAll, 120);
})();
