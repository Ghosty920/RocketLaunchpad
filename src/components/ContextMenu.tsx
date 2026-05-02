import { createContext, useContext, useEffect, useRef, useState } from 'react';

const ContextMenuContext = createContext<{ closeMenu: () => void } | null>(null);

export function ContextMenuOption({
	children,
	className,
	disabled,
	onClick,
	closeOnClick = true,
}: {
	children: React.ReactNode;
	onClick: () => void;
	className?: string;
	disabled?: boolean;
	closeOnClick?: boolean;
}) {
	const menuContext = useContext(ContextMenuContext);

	const onOptionClick = () => {
		if (disabled) return;
		onClick();
		if (closeOnClick) menuContext?.closeMenu();
	};

	return (
		<div
			onClick={onOptionClick}
			className={`font-rubik text-xl font-normal relative px-4 py-4 w-full group inline-flex items-start gap-2 leading-none ${className || ''} ${disabled ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-zinc-600 cursor-pointer transition-all duration-300'}`}
			aria-disabled={disabled}
		>
			<div className='absolute inset-0 w-full group-hover:bg-linear-to-r group-hover:from-white/20 group-hover:to-white/0'></div>
			{children}
		</div>
	);
}

export default function ContextMenu({ children, actions }: { children: React.ReactNode; actions: React.ReactNode }) {
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!menu) return;
		const onPointerDown = (e: MouseEvent) => {
			if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
			setMenu(null);
		};

		window.addEventListener('mousedown', onPointerDown);
		return () => window.removeEventListener('mousedown', onPointerDown);
	}, [menu]);

	const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		setMenu({ x: e.clientX, y: e.clientY });
	};

	return (
		<ContextMenuContext.Provider value={{ closeMenu: () => setMenu(null) }}>
			<div onContextMenu={onContextMenu}>
				{children}
				{menu && (
					<div
						ref={menuRef}
						className='fixed z-50 max-w-100 select-none overflow-hidden flex flex-col bg-zinc-700 text-white rounded-md shadow-lg'
						style={{ position: 'absolute', top: menu.y, left: menu.x }}
					>
						{actions}
					</div>
				)}
			</div>
		</ContextMenuContext.Provider>
	);
}
