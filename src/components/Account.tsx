import { ReactElement, useContext, useEffect, useRef, useState } from 'react';
import { Account, FullAccount } from '../types';
import { ConfigContext } from '../ConfigProvider';
import { ChartLine, CirclePlus, Copy, Share2, ShieldCheck, ShieldX, Trash2, X } from 'lucide-react';
import ContextMenu, { ContextMenuOption } from './ContextMenu';
import Modal from './Modal';
import LoadingDots from './LoadingDots';
import { invoke } from '@tauri-apps/api/core';
import base64 from 'base-64';
import utf8 from 'utf8';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import LoginModal from '../LoginProcess';
import StatsPage from '../pages/StatsPage';

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
	const [data, setData] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		invoke<FullAccount>('get_account', { accountId })
			.then(result => {
				const data = {
					Username: result.Username,
					AccountId: result.AccountId,
					AuthDeviceId: result.AuthDeviceId,
					AuthSecret: result.AuthSecret,
				};
				setData(base64.encode(utf8.encode(JSON.stringify(data))));
			})
			.catch((err: Error) => {
				console.error(err);
				setData(err.toString());
			});
	}, [open, accountId]);

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

	return (
		<Modal
			open={open}
			title='Share account'
			onClose={onClose}
			actions={
				data && (
					<>
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
					</>
				)
			}
		>
			{data ? (
				<>
					Here is a code you can use to share your account. Please note that anyone who has this can launch
					the game with your account, so only share it with people you trust!
					<div className='mt-4 p-4 bg-gray-200/40 rounded-md font-mono text-sm select-all break-all'>
						{data}
					</div>
				</>
			) : (
				<LoadingDots number={7} />
			)}
		</Modal>
	);
}

export default function AccountElem({
	account,
	onDelete,
	onLaunch,
	launchingAccount,
	page,
	switchPage,
}: {
	account: Account | null;
	onDelete?: (account: Account) => void | Promise<void>;
	onLaunch?: (account: Account, useEac: boolean) => void | Promise<void>;
	launchingAccount?: Account | null;
	page?: React.ReactNode;
	switchPage?: (page: React.ReactNode) => void;
}) {
	if (!account) {
		return <Loading />;
	}

	const { config } = useContext(ConfigContext)!;
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [isShareOpen, setIsShareOpen] = useState(false);

	const isLaunching = Boolean(launchingAccount?.AccountId);
	const isLaunchingThis = launchingAccount?.AccountId === account.AccountId;

	const onDeleteConfirm = async () => {
		setIsDeleteOpen(false);
		if (onDelete) {
			await onDelete(account);
		}
	};

	const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0 && e.button !== 1) return;
		e.preventDefault();
		if (isLaunching) return;

		const showStats = e.button === 0 && config.ShowStatsPage;
		const pageShownIsThis =
			page &&
			(page as ReactElement).type === StatsPage &&
			(page as any).props.account.AccountId === account.AccountId;
		if (!showStats || pageShownIsThis) {
			if (onLaunch) onLaunch(account, config.UseEac);
		} else {
			switchPage && switchPage(<StatsPage account={account} />);
		}
	};

	return (
		<div className='font-bourgeois text-2xl font-medium w-full px-4 py-3'>
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
					className={`w-full h-20 bg-gray-200/40 rounded-xl flex items-center justify-center cursor-pointer duration-400 transition-all ${
						isLaunchingThis
							? 'scale-105 shadow-[0_0_14px_rgba(128,239,128,1)]!'
							: 'hover:scale-103 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
					}`}
				>
					<h3 className='overflow-hidden text-ellipsis whitespace-nowrap px-2'>{account.Username}</h3>
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
