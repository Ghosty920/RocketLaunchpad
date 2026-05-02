/**
 * Edited from https://uiverse.io/adamgiebl/thin-lionfish-5
 */
export default function LoadingDots({ number = 5 }: { number?: number }) {
	return (
		<div className='flex items-center justify-center h-full w-full'>
			{Array.from({ length: number }).map((_, i) => (
				<div
					key={i}
					className={`w-5 h-5 ${i < number - 1 ? 'mr-2.5' : ''} rounded-full animate-dot-pulse bg-[#b3d4fc]`}
					style={{ animationDelay: `${i * 0.15}s` }}
				></div>
			))}
		</div>
	);
}
