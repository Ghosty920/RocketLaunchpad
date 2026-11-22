import { ReactElement, useContext, useEffect, useRef, useState } from 'react';
import { Account, FullAccount } from '../types';
import { ConfigContext } from '../ConfigProvider';
import { ChartLine, CirclePlus, Copy, RefreshCw, Share2, ShieldCheck, ShieldX, Trash2, X } from 'lucide-react';
import ContextMenu, { ContextMenuOption } from './ContextMenu';
import Modal from './Modal';
import LoadingDots from './LoadingDots';
import { invoke } from '@tauri-apps/api/core';
import base64 from 'base-64';
import utf8 from 'utf8';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import LoginModal from '../LoginProcess';
import StatsPage from '../pages/StatsPage';
import { formatRemaining, truncate } from '../lib/utils';

function Loading() {
	return (
		<div className='font-bourgeois text-2xl font-medium w-full px-4 pt-6'>
			<div className='w-full h-20 bg-white/40 rounded-xl flex items-center justify-center'>
				<LoadingDots number={3} />
			</div>
		</div>
	);
}

function ModalAccountShare({ accountId, open, onClose }: { accountId: string; open: boolean; onClose: () => void }) {
	const copyBtnRef = useRef<HTMLButtonElement | null>(null);
	const [copyAnimTimeout, setCopyAnimTimeout] = useState<NodeJS.Timeout>();
	const [shareMode, setShareMode] = useState<'permanent' | 'access' | 'refresh'>('permanent');
	const [data, setData] = useState<string | null>(null);
	const [account, setAccount] = useState<FullAccount | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshError, setRefreshError] = useState<string | null>(null);
	const loadTokenRef = useRef(0);

	useEffect(() => {
		if (!open) return;
		const loadToken = ++loadTokenRef.current;
		setData(null);
		setAccount(null);
		setRefreshError(null);
		invoke<FullAccount>('get_account', { accountId })
			.then(result => {
				if (loadToken !== loadTokenRef.current) return;
				setAccount(result);
			})
			.catch((err: Error) => {
				console.error(err);
				if (loadToken !== loadTokenRef.current) return;
				setData(err.toString());
			});
	}, [open, accountId]);

	useEffect(() => {
		if (!account) return;
		const sharedAccount = {
			Username: account.Username,
			AccountId: account.AccountId,
			AuthDeviceId: shareMode === 'permanent' ? account.AuthDeviceId : '',
			AuthSecret: shareMode === 'permanent' ? account.AuthSecret : '',
			AccessToken: shareMode === 'permanent' ? null : account.AccessToken,
			AccessExpiresAt: shareMode === 'permanent' ? null : account.AccessExpiresAt,
			RefreshToken: shareMode === 'refresh' ? account.RefreshToken : null,
			RefreshExpiresAt: shareMode === 'refresh' ? account.RefreshExpiresAt : null,
		};
		setData(base64.encode(utf8.encode(JSON.stringify(sharedAccount))));
	}, [account, shareMode]);

	const expiration =
		shareMode === 'access' ? account?.AccessExpiresAt : shareMode === 'refresh' ? account?.RefreshExpiresAt : null;
	const expirationText = expiration
		? new Date(expiration).toLocaleString()
		: shareMode === 'permanent'
			? 'No expiration'
			: 'Expiration unavailable';
	const shareExpired = expiration != null && expiration <= Date.now();

	const copyToClipboard = async () => {
		if (!data) return;
		await writeText(data);
		if (copyBtnRef.current) {
			copyBtnRef.current.textContent = 'Copied!';
			clearTimeout(copyAnimTimeout!);
			setCopyAnimTimeout(
				setTimeout(() => {
					if (copyBtnRef.current) copyBtnRef.current.textContent = 'Copy';
				}, 2000)
			);
		}
	};

	const refreshAccount = async () => {
		if (refreshing) return;
		setRefreshing(true);
		setRefreshError(null);
		try {
			const refreshed = await invoke<FullAccount>('refresh_account', { accountId });
			loadTokenRef.current += 1;
			setAccount(refreshed);
		} catch (error) {
			setRefreshError(typeof error === 'string' ? error : error instanceof Error ? error.message : String(error));
		} finally {
			setRefreshing(false);
		}
	};

	return (
		<Modal
			open={open}
			title='Share account'
			onClose={onClose}
			actions={
				data && (
					<>
						<button
							className='mr-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-lg hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60'
							onClick={refreshAccount}
							disabled={refreshing}
						>
							<RefreshCw size={18} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
							Refresh
						</button>
						<div className='flex gap-3'>
							<button
								ref={copyBtnRef}
								className='inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-lg hover:bg-indigo-500 disabled:opacity-60'
								onClick={copyToClipboard}
								disabled={!data}
							>
								<Copy size={18} strokeWidth={2} /> Copy
							</button>
							<button
								className='inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-lg hover:bg-white/20'
								onClick={onClose}
							>
								<X size={18} strokeWidth={2} /> Done
							</button>
						</div>
					</>
				)
			}
		>
			{data ? (
				<>
					Here is a code you can use to share your account. Please note that anyone who has this can launch
					the game with your account, so only share it with people you trust!
					<div className='mt-4 grid grid-cols-3 gap-1 rounded-lg bg-black/20 p-1 text-base'>
						{(
							[
								['permanent', 'Permanent'],
								['access', 'Temporary'],
								['refresh', 'Longer'],
							] as const
						).map(([mode, label]) => (
							<button
								key={mode}
								className={`rounded-md px-2 py-2 disabled:cursor-not-allowed disabled:opacity-40 ${shareMode === mode ? 'bg-indigo-600' : 'hover:bg-white/10'}`}
								onClick={() => setShareMode(mode)}
								disabled={
									mode === 'access'
										? !account?.AccessToken
										: mode === 'refresh'
											? !account?.RefreshToken
											: false
								}
							>
								{label}
							</button>
						))}
					</div>
					<div className='mt-2 text-base text-white/70'>
						{shareMode === 'permanent'
							? 'Includes the device credentials and does not expire.'
							: `Valid until: ${expirationText}`}
					</div>
					{shareExpired ? (
						<div className='mt-2 rounded-md bg-red-900/50 p-3 text-base text-red-200'>
							This share code has expired. Launch the game with this account first to update its tokens.
						</div>
					) : (
						<div className='contents'>
							{/* Above div: fix for the blur not applying directly when switching between modes because of React */}
							<div className='mt-4 overflow-hidden rounded-md bg-gray-200/40 p-4 font-mono text-sm select-none break-all blur-sm transition-[filter] duration-500 hover:blur-none'>
								{truncate(data, 51 * 7)}
							</div>
						</div>
					)}
					{refreshError && (
						<div className='mt-2 rounded-md bg-red-900/50 p-3 text-base text-red-200'>
							Refresh failed: {refreshError}
						</div>
					)}
				</>
			) : (
				<LoadingDots number={7} />
			)}
		</Modal>
	);
}

const DRAG_THRESHOLD = 6;

export default function AccountElem({
	account,
	onDelete,
	onLaunch,
	launchingAccount,
	page,
	switchPage,
	isDragging,
	isDragOver,
	onDragHandlePointerDown,
	registerRef,
	now,
}: {
	account: Account | null;
	onDelete?: (account: Account) => void | Promise<void>;
	onLaunch?: (account: Account, useEac: boolean) => void | Promise<void>;
	launchingAccount?: Account | null;
	page?: React.ReactNode;
	switchPage?: (page: React.ReactNode) => void;
	isDragging?: boolean;
	isDragOver?: boolean;
	onDragHandlePointerDown?: () => void;
	registerRef?: (node: HTMLDivElement | null) => void;
	now?: number;
}) {
	if (!account) {
		return <Loading />;
	}

	const { config } = useContext(ConfigContext)!;
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [isShareOpen, setIsShareOpen] = useState(false);

	const isLaunching = Boolean(launchingAccount?.AccountId);
	const isLaunchingThis = launchingAccount?.AccountId === account.AccountId;
	const isTemporary = account.ExpiresAt != null;
	const remainingSeconds = isTemporary && now ? Math.max(0, Math.ceil((account.ExpiresAt! - now) / 1000)) : null;

	const pointerStart = useRef<{ x: number; y: number } | null>(null);
	const dragTriggered = useRef(false);

	const onDeleteConfirm = async () => {
		setIsDeleteOpen(false);
		if (onDelete) {
			await onDelete(account);
		}
	};

	const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0 && e.button !== 1) return;
		e.preventDefault();

		if (dragTriggered.current) {
			dragTriggered.current = false;
			return;
		}

		if (isLaunching) return;

		const showStats = e.button === 0 && config.ShowStatsPage;
		const pageShownIsThis =
			page &&
			(page as ReactElement).type === StatsPage &&
			(page as any).props.account.AccountId === account.AccountId;
		if (!showStats || pageShownIsThis) {
			if (onLaunch) onLaunch(account, config.UseEac);
		} else {
			if (switchPage) switchPage(<StatsPage account={account} />);
		}
	};

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return; // uniquement clic gauche pour drag
		pointerStart.current = { x: e.clientX, y: e.clientY };
		dragTriggered.current = false;

		const onPointerMove = (moveEvent: PointerEvent) => {
			if (!pointerStart.current || dragTriggered.current) return;
			const dx = moveEvent.clientX - pointerStart.current.x;
			const dy = moveEvent.clientY - pointerStart.current.y;
			if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
				dragTriggered.current = true;
				onDragHandlePointerDown?.();
			}
		};

		const onPointerUp = () => {
			pointerStart.current = null;
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
		};

		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	};

	return (
		<div
			className={`font-bourgeois text-2xl font-medium w-full px-4 py-3 select-none transition-opacity ${isDragging ? 'opacity-60' : ''} ${isDragOver ? 'outline-2 outline-dashed outline-lime-400/50 rounded-xl' : ''}`}
			ref={node => registerRef?.(node)}
			onPointerDown={onPointerDown}
		>
			<ContextMenu
				actions={[
					<ContextMenuOption
						key='1'
						disabled={isLaunching}
						onClick={() => onLaunch && onLaunch(account, !config.UseEac)}
					>
						{config.UseEac ? (
							<>
								<ShieldX size={22} strokeWidth={2} className='self-end' /> Launch without EAC
							</>
						) : (
							<>
								<ShieldCheck size={22} strokeWidth={2} /> Launch with EAC
							</>
						)}
					</ContextMenuOption>,
					!config.ShowStatsPage && (
						<ContextMenuOption
							key='4'
							className='bg-lime-800! hover:bg-lime-600!'
							onClick={() => switchPage && switchPage(<StatsPage account={account} />)}
						>
							<ChartLine size={22} strokeWidth={2} /> View Stats
						</ContextMenuOption>
					),
					<ContextMenuOption
						key='2'
						className='bg-sky-800! hover:bg-sky-600!'
						onClick={() => setIsShareOpen(true)}
						disabled={isTemporary}
					>
						<Share2 size={22} strokeWidth={2} /> Share Account
					</ContextMenuOption>,
					<ContextMenuOption
						key='3'
						className='bg-red-800! hover:bg-red-600!'
						onClick={() => setIsDeleteOpen(true)}
					>
						<Trash2 size={22} strokeWidth={2} /> Delete Account
					</ContextMenuOption>,
				]}
			>
				<div
					onClick={onClick}
					className={`w-full h-20 bg-gray-200/40 rounded-xl flex flex-col items-center justify-center cursor-pointer duration-400 transition-all ${
						isTemporary ? 'border border-red-300/70' : ''
					} ${
						isLaunchingThis
							? 'scale-105 shadow-[0_0_14px_rgba(128,239,128,1)]!'
							: 'hover:scale-103 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
					}`}
				>
					<h3 className='overflow-hidden text-ellipsis whitespace-nowrap px-2'>{account.Username}</h3>
					{remainingSeconds !== null && (
						<span className='text-sm text-red-200'>Expires in {formatRemaining(remainingSeconds)}</span>
					)}
				</div>
			</ContextMenu>
			<Modal
				open={isDeleteOpen}
				title='Delete account?'
				onClose={() => setIsDeleteOpen(false)}
				actions={
					<>
						<button
							className='inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-lg hover:bg-white/20'
							onClick={() => setIsDeleteOpen(false)}
						>
							<X size={18} strokeWidth={2} /> Cancel
						</button>
						<button
							className='inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-lg hover:bg-red-500'
							onClick={onDeleteConfirm}
						>
							<Trash2 size={18} strokeWidth={2} /> Delete
						</button>
					</>
				}
			>
				Are you sure you want to delete account <span className='font-bold'>{account.Username}</span>?
			</Modal>
			<ModalAccountShare accountId={account.AccountId} open={isShareOpen} onClose={() => setIsShareOpen(false)} />
		</div>
	);
}

export function AddAccount({ onAdd }: { onAdd: (account: Account) => void }) {
	const [modalOpen, setModalOpen] = useState(false);

	const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		setModalOpen(true);
	};

	// overkill af effect, that was prob not worth it, but it looks nice so whatever
	return (
		<div className='font-bourgeois text-2xl font-medium w-full px-4 py-6'>
			<div
				onClick={onClick}
				className='w-full h-20 bg-white/40 rounded-xl flex items-center justify-center cursor-pointer duration-400 transition-all border-2 border-cyan-300/60 shadow-[0_0_12px_rgba(0,100,255,0.8)] hover:scale-103 hover:shadow-[0_0_12px_2px_rgba(25,255,255,1)] hover:animate-rainbow group'
			>
				<h3 className='overflow-hidden text-ellipsis whitespace-nowrap px-2 select-none group-hover:drop-shadow-[0_0_4px_rgba(25,255,255,1)] inline-flex items-start gap-2 leading-none'>
					<CirclePlus size={22} strokeWidth={2} className='self-end' /> Add Account
				</h3>
			</div>
			<LoginModal open={modalOpen} setOpened={setModalOpen} onAdd={onAdd} />
		</div>
	);
}
