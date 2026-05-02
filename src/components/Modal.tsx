import { useEffect } from 'react';

export default function Modal({
	open,
	title,
	children,
	actions,
	onClose,
}: {
	open: boolean;
	title?: React.ReactNode;
	children: React.ReactNode;
	actions?: React.ReactNode;
	onClose: () => void;
}) {
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};

		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
			onClick={onClose}
		>
			<div
				className='w-[min(92vw,30rem)] rounded-xl bg-zinc-800 text-white shadow-2xl'
				onClick={e => e.stopPropagation()}
			>
				{title && <div className='px-6 pt-5 text-3xl font-medium'>{title}</div>}
				<div className='px-6 py-4 text-xl text-white/90'>{children}</div>
				{actions && <div className='flex items-center justify-end gap-3 px-6 pb-5'>{actions}</div>}
			</div>
		</div>
	);
}
