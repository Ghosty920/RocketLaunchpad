import { useState, useRef } from 'react';
import AccountElem from './Account';
import { Account } from '../types';

export default function AccountsList({
	accounts,
	onDelete,
	onLaunch,
	onReorder,
	launchingAccount,
	page,
	switchPage,
}: {
	accounts: Account[] | null;
	onDelete?: (account: Account) => void | Promise<void>;
	onLaunch?: (account: Account, useEac: boolean) => void | Promise<void>;
	onReorder: (newOrder: string[]) => void | Promise<void>;
	launchingAccount?: Account | null;
	page?: React.ReactNode;
	switchPage?: (page: React.ReactNode) => void;
}) {
	const [draggedId, setDraggedId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);

	const draggedIdRef = useRef<string | null>(null);
	const dragOverIdRef = useRef<string | null>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	if (accounts === null) {
		return <AccountElem account={null} />;
	}

	const setDragged = (id: string | null) => {
		draggedIdRef.current = id;
		setDraggedId(id);
	};

	const setDragOver = (id: string | null) => {
		dragOverIdRef.current = id;
		setDragOverId(id);
	};

	const commitReorder = (targetId: string) => {
		const currentDraggedId = draggedIdRef.current;
		if (!currentDraggedId || currentDraggedId === targetId) return;

		const ids = accounts.map(a => a.AccountId);
		const fromIndex = ids.indexOf(currentDraggedId);
		const toIndex = ids.indexOf(targetId);
		if (fromIndex === -1 || toIndex === -1) return;

		const newIds = [...ids];
		newIds.splice(fromIndex, 1);
		newIds.splice(toIndex, 0, currentDraggedId);

		onReorder(newIds);
	};

	const onPointerMove = (e: PointerEvent) => {
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (!el) return;

		for (const [id, node] of itemRefs.current) {
			if (node.contains(el)) {
				setDragOver(id);
				return;
			}
		}
	};

	const onPointerUp = () => {
		const currentDragOverId = dragOverIdRef.current;
		if (draggedIdRef.current && currentDragOverId) {
			commitReorder(currentDragOverId);
		}
		setDragged(null);
		setDragOver(null);
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
	};

	const startDrag = (accountId: string) => {
		setDragged(accountId);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onPointerUp);
	};

	return (
		<>
			{accounts.map(account => (
				<AccountElem
					key={account.AccountId}
					account={account}
					onDelete={onDelete}
					onLaunch={onLaunch}
					launchingAccount={launchingAccount}
					page={page}
					switchPage={switchPage}
					isDragging={draggedId === account.AccountId}
					isDragOver={dragOverId === account.AccountId && draggedId !== account.AccountId}
					onDragHandlePointerDown={() => startDrag(account.AccountId)}
					registerRef={(node: HTMLDivElement | null) => {
						if (node) itemRefs.current.set(account.AccountId, node);
						else itemRefs.current.delete(account.AccountId);
					}}
				/>
			))}
		</>
	);
}
