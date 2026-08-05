import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { z } from 'zod';
import type { InsightCourse, InsightMetric, InsightReportData } from '$lib/super/insights.server';

export const insightPdfDocumentSchema = z.object({
	title: z.string().min(1).max(120),
	subtitle: z.string().min(1).max(280),
	executiveSummary: z.string().min(1).max(1_200),
	strengths: z
		.array(z.object({ title: z.string().min(1).max(120), detail: z.string().min(1).max(360) }))
		.max(5),
	focusAreas: z
		.array(z.object({ title: z.string().min(1).max(120), detail: z.string().min(1).max(360) }))
		.max(5),
	recommendations: z.array(z.string().min(1).max(360)).max(7).min(1),
	courseNotes: z
		.array(z.object({ apClass: z.string().min(1).max(120), takeaway: z.string().min(1).max(360) }))
		.max(24)
});

export type InsightPdfDocument = z.infer<typeof insightPdfDocumentSchema>;

const PAGE_WIDTH = PageSizes.Letter[0];
const PAGE_HEIGHT = PageSizes.Letter[1];
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_MARGIN = 58;

const colors = {
	ink: rgb(0.11, 0.13, 0.18),
	muted: rgb(0.34, 0.37, 0.43),
	line: rgb(0.82, 0.83, 0.85),
	soft: rgb(0.95, 0.96, 0.97),
	blue: rgb(0.16, 0.33, 0.65),
	green: rgb(0.13, 0.45, 0.28),
	red: rgb(0.65, 0.22, 0.2),
	amber: rgb(0.63, 0.42, 0.08),
	white: rgb(1, 1, 1)
};

function cleanText(value: string): string {
	return value
		.replace(/[\u2010-\u2015]/g, '-')
		.replace(/\u00a0/g, ' ')
		.trim();
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const paragraph of cleanText(value).split(/\r?\n/)) {
		const words = paragraph.split(/\s+/).filter(Boolean);
		if (!words.length) {
			lines.push('');
			continue;
		}
		let line = '';
		for (const word of words) {
			const next = line ? `${line} ${word}` : word;
			if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next;
			else {
				lines.push(line);
				line = word;
			}
		}
		if (line) lines.push(line);
	}
	return lines;
}

function metricFor(
	metrics: Partial<Record<'mcq' | 'frq', InsightMetric>>,
	source: 'mcq' | 'frq'
): InsightMetric | null {
	return metrics[source] ?? null;
}

function scoreText(metric: InsightMetric | null): string {
	return metric ? `${Math.round(metric.weightedAveragePercentage)}%` : '-';
}

function scoreColor(metric: InsightMetric | null) {
	if (!metric) return colors.muted;
	if (metric.weightedAveragePercentage >= 75) return colors.green;
	if (metric.weightedAveragePercentage < 60) return colors.red;
	return colors.amber;
}

function trendText(metric: InsightMetric | null): string {
	if (!metric || metric.trend.deltaPercentagePoints === null) return 'Building evidence';
	const delta = Math.round(metric.trend.deltaPercentagePoints);
	return `${delta > 0 ? '+' : ''}${delta} pts ${metric.trend.direction}`;
}

class PdfWriter {
	readonly doc: PDFDocument;
	readonly regular: PDFFont;
	readonly bold: PDFFont;
	readonly italic: PDFFont;
	page: PDFPage;
	y: number;

	constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont, italic: PDFFont) {
		this.doc = doc;
		this.regular = regular;
		this.bold = bold;
		this.italic = italic;
		this.page = doc.addPage(PageSizes.Letter);
		this.y = PAGE_HEIGHT - MARGIN;
		this.paintPage();
	}

	private paintPage() {
		this.page.drawRectangle({
			x: 0,
			y: 0,
			width: PAGE_WIDTH,
			height: PAGE_HEIGHT,
			color: colors.white
		});
		this.page.drawLine({
			start: { x: MARGIN, y: PAGE_HEIGHT - 35 },
			end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 35 },
			thickness: 1,
			color: colors.line
		});
		this.page.drawText('FREE AP PRACTICE  /  PERSONAL INSIGHTS', {
			x: MARGIN,
			y: PAGE_HEIGHT - 25,
			size: 7,
			font: this.bold,
			color: colors.blue
		});
	}

	addPage() {
		this.page = this.doc.addPage(PageSizes.Letter);
		this.y = PAGE_HEIGHT - MARGIN;
		this.paintPage();
	}

	ensureSpace(height: number) {
		if (this.y - height < BOTTOM_MARGIN) this.addPage();
	}

	paragraph(
		value: string,
		options: {
			font?: PDFFont;
			size?: number;
			color?: ReturnType<typeof rgb>;
			lineHeight?: number;
			gap?: number;
			maxWidth?: number;
		} = {}
	) {
		const font = options.font ?? this.regular;
		const size = options.size ?? 10;
		const lineHeight = options.lineHeight ?? size * 1.45;
		const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
		const lines = wrapText(value, font, size, maxWidth);
		for (const line of lines) {
			this.ensureSpace(lineHeight);
			if (line) {
				this.page.drawText(line, {
					x: MARGIN,
					y: this.y,
					size,
					font,
					color: options.color ?? colors.ink
				});
			}
			this.y -= lineHeight;
		}
		this.y -= options.gap ?? 5;
	}

	section(eyebrow: string, title: string) {
		this.ensureSpace(54);
		this.y -= 8;
		this.page.drawLine({
			start: { x: MARGIN, y: this.y },
			end: { x: PAGE_WIDTH - MARGIN, y: this.y },
			thickness: 1,
			color: colors.line
		});
		this.y -= 18;
		this.page.drawText(cleanText(eyebrow).toUpperCase(), {
			x: MARGIN,
			y: this.y,
			size: 7,
			font: this.bold,
			color: colors.blue
		});
		this.y -= 18;
		this.page.drawText(cleanText(title), {
			x: MARGIN,
			y: this.y,
			size: 18,
			font: this.bold,
			color: colors.ink
		});
		this.y -= 25;
	}

	bullet(value: string, color = colors.ink) {
		const bulletX = MARGIN + 3;
		const textX = MARGIN + 15;
		const size = 9.5;
		const lines = wrapText(value, this.regular, size, CONTENT_WIDTH - 15);
		for (let index = 0; index < lines.length; index += 1) {
			this.ensureSpace(14);
			if (index === 0) {
				this.page.drawCircle({ x: bulletX, y: this.y + 3, size: 2.2, color });
			}
			this.page.drawText(lines[index], {
				x: textX,
				y: this.y,
				size,
				font: this.regular,
				color
			});
			this.y -= 14;
		}
		this.y -= 4;
	}

	metricRow(label: string, value: string, detail: string, color = colors.ink) {
		this.ensureSpace(32);
		this.page.drawText(cleanText(label).toUpperCase(), {
			x: MARGIN,
			y: this.y,
			size: 7,
			font: this.bold,
			color: colors.muted
		});
		this.page.drawText(cleanText(value), {
			x: MARGIN + 120,
			y: this.y,
			size: 10,
			font: this.bold,
			color
		});
		this.page.drawText(cleanText(detail), {
			x: MARGIN + 215,
			y: this.y,
			size: 8,
			font: this.regular,
			color: colors.muted
		});
		this.y -= 17;
	}
}

function drawCourseTable(writer: PdfWriter, course: InsightCourse, takeaway: string | undefined) {
	writer.ensureSpace(94);
	writer.page.drawRectangle({
		x: MARGIN,
		y: writer.y - 62,
		width: CONTENT_WIDTH,
		height: 62,
		color: colors.soft
	});
	writer.page.drawText(cleanText(course.apClass), {
		x: MARGIN + 12,
		y: writer.y - 20,
		size: 13,
		font: writer.bold,
		color: colors.ink
	});
	writer.page.drawText(`${course.totalScoredAttempts} total scored attempts`, {
		x: MARGIN + 12,
		y: writer.y - 37,
		size: 8,
		font: writer.regular,
		color: colors.muted
	});
	let metricX = PAGE_WIDTH - MARGIN - 160;
	for (const source of ['mcq', 'frq'] as const) {
		const metric = metricFor(course.metrics, source);
		writer.page.drawText(source.toUpperCase(), {
			x: metricX,
			y: writer.y - 18,
			size: 7,
			font: writer.bold,
			color: colors.muted
		});
		writer.page.drawText(scoreText(metric), {
			x: metricX,
			y: writer.y - 37,
			size: 13,
			font: writer.bold,
			color: scoreColor(metric)
		});
		metricX += 76;
	}
	writer.y -= 76;

	if (takeaway) {
		writer.paragraph(`AI read: ${takeaway}`, {
			font: writer.italic,
			size: 8.5,
			color: colors.muted,
			gap: 6
		});
	}

	const columns = {
		unit: MARGIN,
		evidence: MARGIN + 260,
		mcq: MARGIN + 330,
		frq: MARGIN + 385,
		trend: MARGIN + 440
	};
	writer.ensureSpace(24);
	writer.page.drawLine({
		start: { x: MARGIN, y: writer.y + 4 },
		end: { x: PAGE_WIDTH - MARGIN, y: writer.y + 4 },
		thickness: 1,
		color: colors.line
	});
	for (const [label, x] of Object.entries({
		Unit: columns.unit,
		Evidence: columns.evidence,
		MCQ: columns.mcq,
		FRQ: columns.frq,
		Trend: columns.trend
	})) {
		writer.page.drawText(label, {
			x,
			y: writer.y - 8,
			size: 7,
			font: writer.bold,
			color: colors.muted
		});
	}
	writer.y -= 22;

	for (const unit of course.units) {
		const mcq = metricFor(unit.metrics, 'mcq');
		const frq = metricFor(unit.metrics, 'frq');
		const unitLines = wrapText(unit.unit, writer.regular, 8, 245);
		const rowHeight = Math.max(24, unitLines.length * 11 + 8);
		writer.ensureSpace(rowHeight);
		unitLines.forEach((line, index) => {
			writer.page.drawText(line, {
				x: columns.unit,
				y: writer.y - index * 11,
				size: 8,
				font: index === 0 ? writer.bold : writer.regular,
				color: colors.ink
			});
		});
		writer.page.drawText(String(unit.totalScoredAttempts), {
			x: columns.evidence,
			y: writer.y,
			size: 8,
			font: writer.regular,
			color: colors.ink
		});
		writer.page.drawText(scoreText(mcq), {
			x: columns.mcq,
			y: writer.y,
			size: 8,
			font: writer.bold,
			color: scoreColor(mcq)
		});
		writer.page.drawText(scoreText(frq), {
			x: columns.frq,
			y: writer.y,
			size: 8,
			font: writer.bold,
			color: scoreColor(frq)
		});
		writer.page.drawText(trendText(mcq ?? frq), {
			x: columns.trend,
			y: writer.y,
			size: 7,
			font: writer.regular,
			color: colors.muted
		});
		writer.y -= rowHeight;
		writer.page.drawLine({
			start: { x: MARGIN, y: writer.y + 4 },
			end: { x: PAGE_WIDTH - MARGIN, y: writer.y + 4 },
			thickness: 0.5,
			color: colors.line
		});
	}
	writer.y -= 10;
}

export async function renderInsightPdf(
	report: InsightReportData,
	document: InsightPdfDocument
): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const regular = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
	const writer = new PdfWriter(pdf, regular, bold, italic);

	writer.page.drawText('PERSONAL ASSESSMENT BRIEF', {
		x: MARGIN,
		y: writer.y - 36,
		size: 8,
		font: bold,
		color: colors.blue
	});
	writer.y -= 62;
	writer.paragraph(document.title, { font: bold, size: 27, lineHeight: 31, gap: 8 });
	writer.paragraph(document.subtitle, {
		font: regular,
		size: 11,
		lineHeight: 16,
		color: colors.muted,
		gap: 16
	});
	writer.page.drawLine({
		start: { x: MARGIN, y: writer.y },
		end: { x: PAGE_WIDTH - MARGIN, y: writer.y },
		thickness: 1.2,
		color: colors.ink
	});
	writer.y -= 24;
	writer.metricRow(
		'Generated',
		new Date(report.generatedAt).toLocaleDateString(),
		`${report.eligibility.totalScoredAttempts} scored attempts`
	);
	writer.metricRow(
		'Method',
		'70% recent / 30% lifetime',
		`${report.calculation.recentWindowDays}-day recent window`
	);
	writer.metricRow(
		'Evidence',
		`${report.eligibility.mcqScoredAttempts} MCQ + ${report.eligibility.frqScoredAttempts} FRQ`,
		`${report.eligibility.eligibleClaimCount} eligible groups`
	);

	writer.section('Executive read', 'The short version');
	writer.paragraph(document.executiveSummary, { font: italic, size: 12, lineHeight: 18, gap: 12 });

	writer.section('Evidence ledger', 'What the data supports');
	writer.paragraph(
		`This report uses ${report.eligibility.totalScoredAttempts} scored attempts. Findings require at least ${report.eligibility.minimumAttemptsPerClaim} attempts in the same course, unit, and format. MCQ and FRQ evidence stay separate.`,
		{ size: 9, lineHeight: 14, color: colors.muted, gap: 10 }
	);
	writer.metricRow(
		'Strengths',
		String(report.strengths.length),
		'areas at or above 75%',
		colors.green
	);
	writer.metricRow('Focus areas', String(report.weaknesses.length), 'areas below 60%', colors.red);
	writer.metricRow('Courses', String(report.courses.length), 'with recorded evidence');

	writer.section('Interpretation', 'What to keep and what to change');
	if (document.strengths.length) {
		writer.paragraph('Keep building', { font: bold, size: 10, color: colors.green, gap: 2 });
		for (const item of document.strengths)
			writer.bullet(`${item.title}: ${item.detail}`, colors.green);
	}
	if (document.focusAreas.length) {
		writer.paragraph('Spend attention here', { font: bold, size: 10, color: colors.red, gap: 2 });
		for (const item of document.focusAreas)
			writer.bullet(`${item.title}: ${item.detail}`, colors.red);
	}

	writer.section('Course detail', 'The full performance ledger');
	const courseNotes = new Map(document.courseNotes.map((item) => [item.apClass, item.takeaway]));
	for (const course of report.courses)
		drawCourseTable(writer, course, courseNotes.get(course.apClass));

	writer.section('Recommended response', 'Your next moves');
	for (const recommendation of document.recommendations) writer.bullet(recommendation, colors.blue);

	writer.section('Method notes', 'How to read this report');
	writer.paragraph(
		`Scores are calculated as percentages. When there are at least ${report.calculation.recentMinimumAttempts} attempts in the recent window, the recent average receives ${Math.round(report.calculation.recentWeight * 100)}% weight and lifetime performance receives ${Math.round(report.calculation.lifetimeWeight * 100)}%. Trends compare the last ${report.calculation.trendWindowDays} days with the prior ${report.calculation.trendWindowDays} days and require at least ${report.calculation.trendMinimumAttempts} attempts in both windows.`,
		{ size: 9, lineHeight: 14, color: colors.muted, gap: 8 }
	);
	writer.paragraph('This report describes practice evidence. It does not predict an AP score.', {
		font: italic,
		size: 9,
		color: colors.muted,
		gap: 8
	});

	const pages = pdf.getPages();
	pages.forEach((page, index) => {
		page.drawLine({
			start: { x: MARGIN, y: 35 },
			end: { x: PAGE_WIDTH - MARGIN, y: 35 },
			thickness: 0.7,
			color: colors.line
		});
		page.drawText('FREE AP PRACTICE  /  INSIGHTS', {
			x: MARGIN,
			y: 22,
			size: 7,
			font: bold,
			color: colors.muted
		});
		page.drawText(`PAGE ${index + 1} OF ${pages.length}`, {
			x: PAGE_WIDTH - MARGIN - 70,
			y: 22,
			size: 7,
			font: bold,
			color: colors.muted
		});
	});

	return pdf.save();
}
