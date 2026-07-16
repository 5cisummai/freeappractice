export type TextToken =
	| {
			kind: "text";
			value: string;
	  }
	| {
			kind: "whitespace";
			value: string;
	  };

function createSegmenter(granularity: Intl.SegmenterOptions["granularity"]) {
	if (typeof Intl === "undefined" || !("Segmenter" in Intl)) {
		return null;
	}

	// Let the runtime locale decide word and grapheme boundaries.
	return new Intl.Segmenter(undefined, { granularity });
}

export function normalizeSourceText(value: string | null | undefined) {
	return value?.replace(/\r\n?/g, "\n") ?? "";
}

export function readNormalizedTextContent(node: Node | null | undefined) {
	// Hidden source nodes can carry CRLF from DOM textContent.
	return normalizeSourceText(node?.textContent ?? "");
}

export function splitGraphemes(value: string) {
	let segmenter = createSegmenter("grapheme");

	if (!segmenter) {
		return Array.from(value);
	}

	return Array.from(segmenter.segment(value), ({ segment }) => segment);
}

export function segmentText(value: string): TextToken[] {
	if (!value) {
		return [];
	}

	let segmenter = createSegmenter("word");

	if (!segmenter) {
		return (value.match(/\S+|\s+/g) ?? []).map((segment) =>
			/^\s+$/.test(segment)
				? {
						kind: "whitespace",
						value: segment,
					}
				: {
						kind: "text",
						value: segment,
					}
		);
	}

	let tokens: TextToken[] = [];
	let currentText = "";

	for (let { segment } of segmenter.segment(value)) {
		if (/^\s+$/.test(segment)) {
			if (currentText) {
				tokens.push({
					kind: "text",
					value: currentText,
				});
				currentText = "";
			}

			// Keep whitespace separate so spacing and newlines stay intact.
			tokens.push({
				kind: "whitespace",
				value: segment,
			});
			continue;
		}

		currentText += segment;
	}

	if (currentText) {
		tokens.push({
			kind: "text",
			value: currentText,
		});
	}

	return tokens;
}
