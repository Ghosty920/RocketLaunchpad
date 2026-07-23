import { invoke } from '@tauri-apps/api/core';
import { useRef } from 'react';
import { toast } from 'react-toastify';

export type UpdateInfo = {
	Current?: string;
	Version: string;
	PageUrl: string;
	InstallerUrl: string;
};

type CachedUpdateInfo = {
	data: UpdateInfo;
	expires: number;
};

async function getUpdateInfo(): Promise<UpdateInfo | null> {
	const { VITE_APP_VERSION, VITE_BUILD_MODE } = import.meta.env;
	if (VITE_BUILD_MODE !== 'production') {
		throw new Error("You're running a dev build.");
	}

	const cachedItem = localStorage.getItem('cached_update_info');
	if (cachedItem) {
		const cachedInfo = JSON.parse(cachedItem) as CachedUpdateInfo;
		if (cachedInfo.expires && Date.now() <= cachedInfo.expires) {
			if (cachedInfo.data.Version === VITE_APP_VERSION) {
				localStorage.removeItem('cached_update_info');
				return null;
			}
			return {
				Current: VITE_APP_VERSION,
				...cachedInfo.data,
			};
		}
		localStorage.removeItem('cached_update_info');
	}

	try {
		const info = await invoke<UpdateInfo | null>('check_update', { version: VITE_APP_VERSION });
		if (info === null) return null;
		localStorage.setItem(
			'cached_update_info',
			JSON.stringify({
				data: info,
				expires: Date.now() + 5 * 60 * 1000,
			})
		);
		return {
			Current: VITE_APP_VERSION,
			...info,
		};
	} catch (err) {
		// @ts-expect-error typescript is retard
		throw new Error(`Error checking for update`, { cause: err });
	}
}

export async function checkForUpdates(): Promise<UpdateInfo | null> {
	const info = await getUpdateInfo();
	if (!info) return null;
	console.log(info);

	const toastId = toast(<UpdateToast info={info} id={() => toastId} />, {
		position: 'bottom-right',
		autoClose: false,
		closeOnClick: false,
		pauseOnHover: true,
		draggable: false,
		progress: undefined,
		ariaLabel: 'Update available',
		closeButton: false,
		style: {
			background: 'transparent',
			boxShadow: 'none',
			padding: 0,
			width: 'auto',
		},
		theme: 'dark',
	});

	return info;
}

export function UpdateToast({ info, id }: { info: UpdateInfo; id: () => string | number }) {
	const installButtonRef = useRef<HTMLButtonElement>(null);

	function installUpdate() {
		installButtonRef.current?.setAttribute('disabled', 'true');
		invoke<void | string>('install_update', { url: info.InstallerUrl })
			.then(() => {
				console.log('Right.');
			})
			.catch((err: any) => {
				alert(err);
				console.error('Error installing update:', err);
			})
			.finally(() => {
				installButtonRef.current?.removeAttribute('disabled');
			});
	}

	return (
		<div className='flex flex-col gap-4 bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-90 select-none hover:ring hover:ring-neutral-800'>
			<div className='flex items-start justify-between gap-2'>
				<div className='flex items-center gap-1'>
					<h1 className='text-white text-xl font-bold'>Update Available:</h1>
					<h1 className='text-emerald-200 text-xl font-semibold'>
						{info.Current} → {info.Version}
					</h1>
				</div>
				<button
					onClick={() => toast.dismiss(id())}
					className='text-neutral-500 hover:text-neutral-300 transition-colors p-0.5 shrink-0 cursor-pointer'
					aria-label='Dismiss'
				>
					✕
				</button>
			</div>
			<div className='flex gap-2'>
				<a
					href={info.PageUrl}
					target='_blank'
					rel='noreferrer noopener'
					className='flex-1 text-sm cursor-pointer text-neutral-500 text-center py-2 rounded-lg border border-[#2e2e2e] hover:text-neutral-300 hover:border-neutral-600 transition-colors no-underline'
				>
					View online
				</a>
				<button
					onClick={installUpdate}
					ref={installButtonRef}
					className='flex-1 text-sm font-medium cursor-pointer text-neutral-900 text-center py-2 rounded-lg bg-neutral-200 hover:bg-white transition-colors no-underline'
				>
					Install
				</button>
			</div>
		</div>
	);
}
