import { useEffect, useRef, useState } from 'react';
import Modal from './components/Modal';
import { Cable, Copy, Layers2, LogIn, PlusCircle, X } from 'lucide-react';
import base64 from 'base-64';
import utf8 from 'utf8';
import { invoke } from '@tauri-apps/api/core';
import { Account } from './types';
import LoadingDots from './components/LoadingDots';

function ChooseMethod({
	open,
	close,
	onChoose,
}: {
	open: boolean;
	close: () => void;
	onChoose: (method: 'device' | 'share') => void;
}) {
	return (
		<Modal open={open} onClose={close} title={'Add a new account'}>
			<div className='flex flex-col items-center gap-4'>
				<div className='text-lg'>Select the method you want to use to add your account.</div>
				<div className='flex gap-4'>
					<button
						className='flex flex-col items-center gap-2 px-4 py-2 rounded bg-green-700 hover:bg-green-500 transition-all duration-400 hover:shadow-[0_0_16px_var(--color-green-500)]'
						onClick={() => onChoose('device')}
					>
						<LogIn strokeWidth={3} size={32} /> Device Code (Main)
					</button>
					<button
						className='flex flex-col items-center gap-2 px-4 py-2 rounded bg-sky-700 hover:bg-sky-500 transition-all duration-400 hover:shadow-[0_0_16px_var(--color-sky-500)]'
						onClick={() => onChoose('share')}
					>
						<Copy strokeWidth={3} size={32} /> Using Share code
					</button>
				</div>
			</div>
		</Modal>
	);
}

function DeviceCodeMethod({
	open,
	close,
	onBack,
	onAdd,
}: {
	open: boolean;
	close: (force?: boolean) => void;
	onBack: () => void;
	onAdd: (account: Account) => void;
}) {
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const cancel = () => {
		setWorking(false);
		setError('Login cancelled');
	};

	const start = async (inWindow: boolean) => {
		try {
			setWorking(true);
			setError(null);
			const data = await invoke<Account>('login_account', { openInWindow: inWindow });
			onAdd(data);
			close(true);
		} catch (exc: any) {
			console.error(exc);
			setError(exc.toString());
		} finally {
			setWorking(false);
		}
	};

	return (
		<Modal
			open={open}
			onClose={close}
			title={'Add account using Device Code'}
			actions={
				working ? (
					<button
						className='inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-lg hover:bg-red-500'
						onClick={cancel}
					>
						<X size={18} strokeWidth={2} /> Cancel
					</button>
				) : (
					<>
						<button
							className='inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-lg hover:bg-white/20'
							onClick={onBack}
							disabled={working}
						>
							<X size={18} strokeWidth={2} /> Back
						</button>
						<button
							className='inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-lg hover:bg-green-500'
							onClick={() => start(false)}
							disabled={working}
						>
							<Cable size={18} strokeWidth={2} /> Start in Browser
						</button>
						<button
							className='inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-lg hover:bg-cyan-500'
							onClick={() => start(true)}
							disabled={working}
						>
							<Layers2 size={18} strokeWidth={2} /> Start in Frame
						</button>
					</>
				)
			}
		>
			<div className='flex flex-col items-center text-lg text-left'>
				<p>To add your account, you'll have to login to your Epic Games account.</p>
				<p>You can either do it in your main browser, or in a new window that the app will open.</p>
			</div>
			{working && (
				<div className='my-5'>
					<LoadingDots number={7} />
				</div>
			)}
			<p className='text-red-300 text-left w-full'>{error}</p>
		</Modal>
	);
}

function MethodShareCode({
	open,
	close,
	onBack,
	onAdd,
}: {
	open: boolean;
	close: (force?: boolean) => void;
	onBack: () => void;
	onAdd: (account: Account) => void;
}) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(false);

	const addAccount = async () => {
		try {
			setWorking(true);
			setError(null);
			const code = inputRef.current?.value.trim();
			if (!code || code.length < 50) throw new Error('Code inexistent or too short');
			const data = JSON.parse(utf8.decode(base64.decode(code)));
			if (!data.Username || !data.AccountId || !data.AuthDeviceId || !data.AuthSecret)
				throw new Error('Code is missing required fields');

			await invoke('add_account', { account: data });
			onAdd(data);
			close(true);
		} catch (e) {
			console.error(e);
			setError('Invalid share code');
		} finally {
			setWorking(false);
		}
	};

	return (
		<Modal
			open={open}
			onClose={close}
			title={'Add account using share code'}
			actions={
				<>
					<button
						className='inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-lg hover:bg-white/20'
						onClick={onBack}
						disabled={working}
					>
						<X size={18} strokeWidth={2} /> Back
					</button>
					<button
						className='inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-lg hover:bg-green-500'
						onClick={addAccount}
						disabled={working}
					>
						<PlusCircle size={18} strokeWidth={2} /> Add Account
					</button>
				</>
			}
		>
			<div className='flex flex-col items-center gap-4'>
				<div className='text-lg'>Enter the share code to add the account.</div>
				<input
					ref={inputRef}
					type='text'
					className='bg-[#121212] rounded px-3 py-2 w-full max-w-xs text-center'
					placeholder='Share code'
					disabled={working}
				/>
				{working && (
					<div className='my-5'>
						<LoadingDots number={7} />
					</div>
				)}
				<p className='text-red-300 text-left w-full'>{error}</p>
			</div>
		</Modal>
	);
}

export default function LoginModal({
	open,
	setOpened,
	onAdd,
}: {
	open: boolean;
	setOpened: (open: boolean) => void;
	onAdd: (account: Account) => void;
}) {
	const [page, setPage] = useState<'choose' | 'device' | 'share'>('choose');
	const [canClose, setCanClose] = useState(true);

	const back = () => {
		setPage('choose');
		setCanClose(true);
	};

	useEffect(() => {
		if (!open) back();
	}, [open]);

	const close = (force?: boolean) => {
		if (!canClose && force !== true) return;
		setOpened(false);
	};

	return (
		<>
			{page === 'choose' && (
				<ChooseMethod
					open={open}
					close={close}
					onChoose={method => {
						if (method === 'device') {
							setCanClose(false);
							setPage('device');
						} else if (method === 'share') {
							setCanClose(false);
							setPage('share');
						} else {
							back();
						}
					}}
				/>
			)}
			{page === 'device' && <DeviceCodeMethod open={open} close={close} onBack={back} onAdd={onAdd} />}
			{page === 'share' && <MethodShareCode open={open} close={close} onBack={back} onAdd={onAdd} />}
		</>
	);
}
