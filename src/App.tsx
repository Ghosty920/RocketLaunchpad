import { ReactElement, useContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './App.css';
import IntroPage from './pages/IntroPage';
import Config from './pages/Config';
import AccountElem, { AddAccount } from './components/Account';
import { Account } from './types';
import Modal from './components/Modal';
import { X } from 'lucide-react';
import { ConfigContext, existsGamePath } from './ConfigProvider';
import { checkForUpdates } from './components/Updater';
import LiveGame from './pages/LiveGame';

function HeaderImage({
	src,
	alt,
	className,
	url,
	onClick,
}: {
	src: string;
	alt: string;
	className?: string;
	url?: string;
	onClick?: () => void;
}) {
	return (
		<a
			className='w-full flex justify-center cursor-pointer'
			href={url}
			target='_blank'
			rel={url?.includes('ghosty.im') ? '' : 'noopener noreferrer'}
			onClick={onClick}
		>
			<img
				src={src}
				alt={alt}
				className={`max-w-18 hover:scale-105 hover:drop-shadow-[0_0_4px_white] transition-all duration-400 cursor-pointer m-3.25 ${className || ''}`}
			/>
		</a>
	);
}

export default function App() {
	const [previousShownPage, setPreviousShownPage] = useState<React.ReactNode>(null);
	const [shownPage, setShownPage] = useState<React.ReactNode>(<IntroPage />);
	const [accounts, setAccounts] = useState<Account[] | null>(null);
	const [launchingAccount, setLaunchingAccount] = useState<Account | null>(null);
	const [launchError, setLaunchError] = useState<string | null>(null);
	const { config, firstLoaded: configFirstLoaded } = useContext(ConfigContext)!;

	useEffect(() => {
		invoke<Account[]>('get_accounts').then((accounts: Account[]) => {
			setAccounts(accounts);
		});
	}, []);

	useEffect(() => {
		if (!configFirstLoaded) return;
		if (!config.UpdateChecker) return;
		checkForUpdates();
	}, [configFirstLoaded]);

	const switchPage = (page: React.ReactNode) => {
		setPreviousShownPage(shownPage);
		setShownPage(page);
	};

	const onAddAccount = async (account: Account) => {
		await invoke('add_account', { account });
		setAccounts(prev => {
			if (!prev) return [account];
			const exists = prev.findIndex(a => a.AccountId === account.AccountId);
			if (exists !== -1) {
				const updated = [...prev];
				updated[exists] = account;
				return updated;
			}
			return [...prev, account];
		});
	};

	const onDeleteAccount = async (account: Account) => {
		await invoke('remove_account', { accountId: account.AccountId });
		setAccounts(prev => (prev ? prev.filter(item => item.AccountId !== account.AccountId) : prev));
	};

	const onLaunchAccount = async (account: Account, useEac: boolean) => {
		if (launchingAccount) return;
		if (!(await existsGamePath(config.LaunchPath))) {
			setLaunchError('Game path is not set. Please set it in the settings page.');
			switchPage(<Config />);
			return;
		}
		setLaunchingAccount(account);
		try {
			await invoke('launch_game', { accountId: account.AccountId, useEac });
			setLaunchingAccount(null);
		} catch (error: any) {
			setLaunchError(error.toString());
		}
	};

	const closeLaunchErrorModal = () => {
		setLaunchError(null);
		setLaunchingAccount(null);
	};

	const openLiveGamePage = () => {
		const pageShownIsThis = shownPage && (shownPage as ReactElement).type === LiveGame;
		if (pageShownIsThis) {
			switchPage(previousShownPage);
		} else {
			switchPage(<LiveGame switchPage={switchPage} />);
		}
	};

	return (
		<main
			onContextMenu={e => e.preventDefault()}
			className='bg-[#090909] grid grid-cols-[2fr_7fr] grid-rows-1 gap-0 text-white h-full w-full font-rubik'
		>
			{/* Left panel */}
			<div className='bg-[#121212] h-full max-w-85 text-center @container flex flex-col'>
				{/* Header */}
				<div className='select-none'>
					<h1 className='font-medium @max-[8rem]:text-xs @max-[10rem]:text-xl @max-2xs:text-2xl text-4xl mt-2'>
						ROCKET
						<br />
						LAUNCHPAD
					</h1>
					<div className='grid grid-cols-3 justify-items-center gap-0 mt-2'>
						<HeaderImage
							src='icons/discord.svg'
							alt='Discord'
							url='https://ghosty.im/discord?from=rocketlaunchpad'
						/>
						<HeaderImage
							src='icons/github.svg'
							alt='GitHub'
							url='https://github.com/Ghosty920/RocketLaunchpad'
						/>
						<HeaderImage
							src='icons/settings.svg'
							alt='Settings'
							onClick={() => {
								if ((shownPage! as ReactElement).type === Config) {
									switchPage(previousShownPage);
								} else switchPage(<Config />);
							}}
							className='hover:rotate-30'
						/>
					</div>
					<div className='flex flex-col w-full py-3 px-4 items-center' onClick={openLiveGamePage}>
						<button className='text-2xl font-medium px-4 h-14 bg-[#34339e] hover:bg-[#4a49c0] rounded-xl flex items-center justify-center cursor-pointer duration-400 transition-all hover:scale-105 hover:drop-shadow-[0_0_4px_#4a49c0]'>
							Live Game
						</button>
					</div>
				</div>

				{/* Accounts */}
				<div className='flex-1 min-h-0 overflow-y-auto'>
					{accounts === null ? (
						<AccountElem account={null} />
					) : (
						<>
							{accounts.map(account => (
								<AccountElem
									key={account.AccountId}
									account={account}
									onDelete={onDeleteAccount}
									onLaunch={onLaunchAccount}
									launchingAccount={launchingAccount}
									page={shownPage}
									switchPage={switchPage}
								/>
							))}
							<AddAccount onAdd={onAddAccount} />
						</>
					)}
				</div>
			</div>

			{/* Content */}
			<div className='h-full p-6 overflow-x-hidden overflow-y-scroll darker-scroll @container'>{shownPage}</div>

			<Modal
				open={!!launchError}
				onClose={closeLaunchErrorModal}
				actions={
					<>
						<button
							className='inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-lg hover:bg-white/20'
							onClick={closeLaunchErrorModal}
						>
							<X size={18} strokeWidth={2} /> Close
						</button>
					</>
				}
			>
				<p>
					Oh no! Launching <b>{launchingAccount?.Username}</b> failed. 😢
				</p>
				<p className='text-red-300'>{launchError}</p>
				{launchError?.startsWith('Game path') || (
					<p className='text-xs'>you might want to check your connection, or reconnect the account.</p>
				)}
			</Modal>
		</main>
	);
}
