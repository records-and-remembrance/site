import {
  BookOpenText,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Database,
  FolderKanban,
  Handshake,
  Library,
  Menu,
  Music2,
  Settings2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "react-aria-components";
import { MasterManager } from "./MasterManager";
import { ResourceScreen } from "./ResourceScreen";
import {
  mainResourceOrder,
  resourceConfigs,
  type MainResource,
} from "./resources";

const icons = {
  people: CircleUserRound,
  projects: FolderKanban,
  works: Library,
  compositions: Music2,
  events: CalendarDays,
  articles: BookOpenText,
  contributions: Handshake,
} satisfies Record<MainResource, typeof CircleUserRound>;

export function App() {
  const [resource, setResource] = useState<MainResource>(initialResource);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);

  const navigate = (next: MainResource) => {
    setResource(next);
    setMobileNavOpen(false);
    window.history.replaceState(null, "", `/admin/${next}`);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Database size={20} />
          </div>
          <div>
            <strong>Monden Archive</strong>
            <span>Database admin</span>
          </div>
          <Button
            aria-label="メニューを閉じる"
            className="mobile-close icon-button"
            onPress={() => setMobileNavOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>

        <nav aria-label="管理画面">
          <p className="nav-heading">Archive</p>
          {mainResourceOrder.map((item) => {
            const Icon = icons[item];
            return (
              <Button
                key={item}
                className={`nav-item ${resource === item ? "is-active" : ""}`}
                onPress={() => navigate(item)}
              >
                <Icon size={18} />
                <span>{resourceConfigs[item].title}</span>
                <ChevronRight className="nav-chevron" size={15} />
              </Button>
            );
          })}
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

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="sidebar-scrim"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <main className="main-content">
        <header className="mobile-header">
          <Button
            aria-label="メニューを開く"
            className="icon-button"
            onPress={() => setMobileNavOpen(true)}
          >
            <Menu size={20} />
          </Button>
          <span>Monden Archive</span>
        </header>
        <ResourceScreen key={resource} resource={resource} />
      </main>

      {mastersOpen ? <MasterManager onClose={() => setMastersOpen(false)} /> : null}
    </div>
  );
}

function initialResource(): MainResource {
  const pathResource = window.location.pathname.split("/").filter(Boolean).at(-1);
  return mainResourceOrder.includes(pathResource as MainResource)
    ? (pathResource as MainResource)
    : "people";
}
