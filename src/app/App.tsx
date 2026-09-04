import { useState, type ReactNode } from "react";
import { useRoute, navigate, type RouteName } from "../lib/router";
import { todayKey } from "../lib/dates";
import type { IconName } from "../components/Icon";
import { DynIcon, IconPlus } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { DayScreen } from "../features/day/DayScreen";
import { ObjectivesScreen } from "../features/objectives/ObjectivesScreen";
import { HistoryScreen } from "../features/history/HistoryScreen";
import { ReportsScreen } from "../features/reports/ReportsScreen";
import { MemoryScreen } from "../features/memory/MemoryScreen";
import { AssistantScreen } from "../features/assistant/AssistantScreen";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { RegisterSheet } from "../features/records/RegisterSheet";

interface NavItem {
  route: RouteName;
  path: string;
  label: string;
  icon: IconName;
}

const TAB_ITEMS: NavItem[] = [
  { route: "today", path: "/hoje", label: "Hoje", icon: "sun" },
  { route: "objectives", path: "/objetivos", label: "Objetivos", icon: "target" },
  { route: "history", path: "/historico", label: "Histórico", icon: "history" },
  { route: "reports", path: "/relatorios", label: "Relatórios", icon: "chart" },
];

const MORE_ITEMS: { path: string; label: string; desc: string; icon: IconName; route: RouteName }[] = [
  { route: "memory", path: "/contexto", label: "Contexto pessoal", desc: "Memórias sobre você", icon: "bookmark" },
  { route: "assistant", path: "/assistente", label: "Assistente", desc: "Conversar com a IA", icon: "chat" },
  { route: "settings", path: "/config", label: "Configurações", desc: "Chave da IA, dados e aparência", icon: "settings" },
];

function activeRoute(routeName: RouteName, dayKey?: string): RouteName | null {
  if (routeName === "today") {
    return dayKey ? (dayKey === todayKey() ? "today" : "history") : "today";
  }
  return routeName;
}

export function App() {
  const route = useRoute();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const today = todayKey();

  const active = activeRoute(route.name, route.dayKey);
  const moreActive =
    route.name === "memory" || route.name === "assistant" || route.name === "settings";

  let view: ReactNode;
  if (route.dayKey) {
    view = <DayScreen dayKey={route.dayKey} isToday={route.dayKey === today} />;
  } else {
    switch (route.name) {
      case "objectives":
        view = <ObjectivesScreen />;
        break;
      case "history":
        view = <HistoryScreen />;
        break;
      case "reports":
        view = <ReportsScreen />;
        break;
      case "memory":
        view = <MemoryScreen />;
        break;
      case "assistant":
        view = <AssistantScreen />;
        break;
      case "settings":
        view = <SettingsScreen />;
        break;
      default:
        view = <DayScreen dayKey={today} isToday />;
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-region">
        Pular para o conteúdo
      </a>

      {/* Mobile bottom navigation (≤5 items + Mais) */}
      <nav className="nav nav-mobile" aria-label="Navegação principal">
        <div className="nav-inner">
          {TAB_ITEMS.map((item) => (
            <a
              key={item.route}
              className="nav-item"
              href={`#${item.path}`}
              aria-current={active === item.route ? "page" : undefined}
            >
              <DynIcon name={item.icon} size={21} />
              <span>{item.label}</span>
            </a>
          ))}
          <a
            className="nav-item"
            href="#mais"
            aria-current={moreActive ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              setMoreOpen(true);
            }}
          >
            <DynIcon name="more" size={21} />
            <span>Mais</span>
          </a>
        </div>
      </nav>

      {/* Global quick-register action (mobile) */}
      <button
        type="button"
        className="fab"
        aria-label="Registrar atividade de hoje"
        onClick={() => setRegisterOpen(true)}
      >
        <IconPlus size={24} />
      </button>

      {/* Desktop sidebar */}
      <nav className="nav nav-desktop" aria-label="Navegação principal">
        <div className="nav-inner">
          <span className="nav-brand t-strong">Freebuff</span>
          {[...TAB_ITEMS, ...MORE_ITEMS.map((m) => ({ route: m.route, path: m.path, label: m.label, icon: m.icon }))].map(
            (item) => (
              <a
                key={item.route}
                className="nav-item"
                href={`#${item.path}`}
                aria-current={active === item.route ? "page" : undefined}
              >
                <DynIcon name={item.icon} size={20} />
                <span>{item.label}</span>
              </a>
            ),
          )}
          <button type="button" className="btn btn-primary nav-register" onClick={() => setRegisterOpen(true)}>
            <IconPlus size={18} />
            Registrar hoje
          </button>
        </div>
      </nav>

      <main id="main-region" className="main-content app-main" tabIndex={-1}>
        <div className="container">{view}</div>
      </main>

      <RegisterSheet open={registerOpen} onClose={() => setRegisterOpen(false)} dayKey={today} />

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais">
        <div className="more-grid">
          {MORE_ITEMS.map((item) => (
            <button
              key={item.route}
              type="button"
              className="more-item"
              onClick={() => {
                setMoreOpen(false);
                navigate(item.path);
              }}
            >
              <DynIcon name={item.icon} size={22} />
              <span>
                <span className="t-strong" style={{ display: "block" }}>
                  {item.label}
                </span>
                <span className="t-sm t-muted">{item.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
