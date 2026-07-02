import { BookOpenText, CalendarDays, ChevronRight, CircleUserRound, Database, Disc3, FolderKanban, Handshake, Library, Menu, Music2, Settings2, X } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { lazy, Suspense, useState } from 'react';
import { Button } from 'react-aria-components';
import { MasterManager } from './MasterManager';
import { adminSearchParams, type AdminSection } from './navigation';
import { ResourceScreen } from './ResourceScreen';
import { mainResourceOrder, resourceConfigs, type DetailTarget, type MainResource } from './resources';

const icons = {
	people: CircleUserRound,
	projects: FolderKanban,
	works: Library,
	compositions: Music2,
	events: CalendarDays,
	articles: BookOpenText,
	contributions: Handshake,
} satisfies Record<MainResource, typeof CircleUserRound>;

const RecordingOrganizerScreen = lazy(async () => {
	const module = await import('./RecordingOrganizerScreen');
	return { default: module.RecordingOrganizerScreen };
});

export function App() {
	const [navigation, setNavigation] = useQueryStates(adminSearchParams, {
		history: 'push',
	});
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const [mastersOpen, setMastersOpen] = useState(false);
	const { resource, detailResource, detailId } = navigation;
	const detailTarget: DetailTarget | undefined = detailResource && detailId ? { resource: detailResource, id: detailId } : undefined;

	const navigate = (next: AdminSection) => {
		void setNavigation({
			resource: next,
			detailResource: null,
			detailId: null,
		});
		setMobileNavOpen(false);
	};

	const openDetail = (target: DetailTarget) => {
		void setNavigation({
			detailResource: target.resource,
			detailId: target.id,
		});
	};

	const closeDetail = () => {
		void setNavigation({ detailResource: null, detailId: null }, { history: 'replace' });
	};

	return (
		<div className="app-shell">
			<aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
				<div className="brand">
					<div className="brand-mark">
						<Database size={20} />
					</div>
					<div>
						<strong>Monden Database</strong>
						<span>admin</span>
					</div>
					<Button aria-label="メニューを閉じる" className="mobile-close icon-button" onPress={() => setMobileNavOpen(false)}>
						<X size={20} />
					</Button>
				</div>

				<nav aria-label="管理画面">
					<p className="nav-heading">Database</p>
					{mainResourceOrder.map((item) => {
						const Icon = icons[item];
						return (
							<Button key={item} className={`nav-item ${resource === item ? 'is-active' : ''}`} onPress={() => navigate(item)}>
								<Icon size={18} />
								<span>{resourceConfigs[item].title}</span>
								<ChevronRight className="nav-chevron" size={15} />
							</Button>
						);
					})}
					<p className="nav-heading organizer-nav-heading">Review</p>
					<Button className={`nav-item ${resource === 'recording-organizer' ? 'is-active' : ''}`} onPress={() => navigate('recording-organizer')}>
						<Disc3 size={18} />
						<span>録音整理</span>
						<ChevronRight className="nav-chevron" size={15} />
					</Button>
				</nav>

				<div className="sidebar-footer">
					<Button className="nav-item" onPress={() => setMastersOpen(true)}>
						<Settings2 size={18} />
						<span>マスタデータ</span>
						<ChevronRight className="nav-chevron" size={15} />
					</Button>
					<p>Local environment</p>
				</div>
			</aside>

			{mobileNavOpen ? <button type="button" aria-label="メニューを閉じる" className="sidebar-scrim" onClick={() => setMobileNavOpen(false)} /> : null}

			<main className="main-content">
				<header className="mobile-header">
					<Button aria-label="メニューを開く" className="icon-button" onPress={() => setMobileNavOpen(true)}>
						<Menu size={20} />
					</Button>
					<span>Monden Archive</span>
				</header>
				{resource === 'recording-organizer' ? (
					<Suspense fallback={<div className="empty-state">録音整理画面を読み込み中</div>}>
						<RecordingOrganizerScreen />
					</Suspense>
				) : (
					<ResourceScreen key={resource} resource={resource} detailTarget={detailTarget} onOpenDetail={openDetail} onCloseDetail={closeDetail} />
				)}
			</main>

			{mastersOpen ? <MasterManager onClose={() => setMastersOpen(false)} /> : null}
		</div>
	);
}
