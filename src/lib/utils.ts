const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;

	const segments = [...graphemeSegmenter.segment(text)];

	if (segments.length <= maxLength) return text;
	if (maxLength === 0) return '';

	return (
		segments
			.slice(0, maxLength - 1)
			.map(({ segment }) => segment)
			.join('') + '…'
	);
}

export function formatRemaining(seconds: number) {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ${minutes % 60}m`;
	return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
