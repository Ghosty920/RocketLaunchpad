export default function LoadingSpinner({
	size,
	qt = 11,
	speed = 1,
	color = 'rainbow',
}: {
	size: number;
	qt?: number;
	speed?: number;
	color?: `#${string}` | 'rainbow';
}) {
	return (
		<div
			className='inline-block overflow-hidden bg-none'
			style={{
				width: `${size}px`,
				height: `${size}px`,
			}}
		>
			<div className='w-full h-full relative backface-hidden origin-top-left'>
				{Array.from({ length: qt }, (_, i) => (
					<div
						key={i}
						className='absolute rounded-xl'
						style={{
							transform: `rotate(${i * (360 / qt)}deg)`,
							animation: `disappear ${speed}s linear infinite`,
							animationDelay: `${(i * -speed) / qt}s`,
							background: color === 'rainbow' ? `hsl(${(i * (360 / qt)) % 360}, 100%, 50%)` : color,
							left: `${(93 * size) / 200}px`,
							top: `${(47 * size) / 200}px`,
							width: `${(14 * size) / 200}px`,
							height: `${(26 * size) / 200}px`,
							borderRadius: `${(7 * size) / 200}px / ${(8.58 * size) / 200}px`,
							transformOrigin: `${(7 * size) / 200}px ${(53 * size) / 200}px`,
						}}
					></div>
				))}
			</div>
		</div>
	);
}
