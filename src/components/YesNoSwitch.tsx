/**
 * Edited from https://uiverse.io/Javierrocadev/soft-tiger-98
 */
export default function YesNoSwitch({
	state,
	setState,
	size,
	disabled,
}: {
	state: boolean;
	setState: (value: boolean) => void;
	size: number;
	disabled?: boolean;
}) {
	return (
		<label className='relative inline-flex items-center cursor-pointer'>
			<input
				type='checkbox'
				value=''
				defaultChecked={state}
				disabled={disabled}
				className='sr-only peer'
				onChange={e => setState(e.currentTarget.checked)}
			/>
			<div
				className="peer ring-0 bg-rose-400 rounded-full outline-none duration-300 after:duration-500 shadow-md peer-checked:bg-emerald-500 peer-focus:outline-none after:content-['✖️'] after:rounded-full after:absolute after:outline-none after:h-[var(--knob-size)] after:w-[var(--knob-size)] after:bg-gray-50 after:top-[var(--knob-offset)] after:left-[var(--knob-offset)] after:flex after:justify-center after:items-center peer-hover:after:scale-75 peer-checked:after:content-['✔️'] after:-rotate-180 peer-checked:after:rotate-0"
				style={{
					width: size * 4,
					height: size * 4,
					fontSize: size * 1.3333333333333333,
					['--knob-size' as any]: `${size * 3.3333333333333335}px`,
					['--knob-offset' as any]: `${size * 0.3333333333333333}px`,
				}}
			/>
		</label>
	);
}
