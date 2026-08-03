interface RGB {
	r: number;
	g: number;
	b: number;
}
interface HSL {
	h: number;
	s: number;
	l: number;
}

type HexColor = `#${string}`;

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}

/**
 * Accepted formats: (#)RGB, (#)RRGGBB
 */
export function parseColor(color: string): RGB {
	const c = color.trim().toLowerCase();

	if (/^#?[0-9a-f]{3}$/.test(c)) {
		const i = c.startsWith('#') ? 1 : 0;
		const r = c[i];
		const g = c[i + 1];
		const b = c[i + 2];
		return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
	}

	if (/^#?[0-9a-f]{6}$/.test(c)) {
		const i = c.startsWith('#') ? 1 : 0;
		const r = c.slice(i, i + 2);
		const g = c.slice(i + 2, i + 4);
		const b = c.slice(i + 4, i + 6);
		return {
			r: parseInt(r, 16),
			g: parseInt(g, 16),
			b: parseInt(b, 16),
		};
	}

	throw new Error(`Invalid color format: ${color}`);
}

/**
 * RGB -> #RRGGBB
 */
export function rgbToHex({ r, g, b }: RGB): HexColor {
	const hex = (n: number) =>
		Math.round(clamp(n, 0, 255))
			.toString(16)
			.padStart(2, '0');
	return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
	const rn = r / 255,
		gn = g / 255,
		bn = b / 255;
	const max = Math.max(rn, gn, bn),
		min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	const d = max - min;

	if (d === 0) return { h: 0, s: 0, l: l * 100 };

	const s = d / (1 - Math.abs(2 * l - 1));
	let h;
	if (max === rn) h = ((gn - bn) / d + 6) % 6;
	else if (max === gn) h = (bn - rn) / d + 2;
	else h = (rn - gn) / d + 4;

	return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
	const sn = s / 100,
		ln = l / 100;
	const c = (1 - Math.abs(2 * ln - 1)) * sn;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = ln - c / 2;

	let r, g, b;
	if (h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		g = 0;
		b = c;
	} else {
		r = c;
		g = 0;
		b = x;
	}

	return {
		r: Math.round((r + m) * 255),
		g: Math.round((g + m) * 255),
		b: Math.round((b + m) * 255),
	};
}

/**
 * Interpolate between two colors in HSL space, returning a hex string
 */
export function lerpHsl(from: string, to: string, t: number): HexColor {
	const a = rgbToHsl(parseColor(from));
	const b = rgbToHsl(parseColor(to));

	let dh = b.h - a.h;
	if (dh > 180) dh -= 360;
	if (dh < -180) dh += 360;

	return rgbToHex(
		hslToRgb({
			h: (a.h + dh * t + 360) % 360,
			s: lerp(a.s, b.s, t),
			l: lerp(a.l, b.l, t),
		})
	);
}
