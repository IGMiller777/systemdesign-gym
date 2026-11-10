import '@xyflow/react/dist/style.css'
import clsx from 'clsx'
import { Trophy } from 'lucide-react'
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useParams } from 'react-router'
import { BottleneckView } from './components/BottleneckView'
import { DesignView } from './components/DesignView'
import { ChoiceView, EstimateView } from './components/InstantViews'
import { rankOf } from './lib/blocks'
import { Home } from './pages/Home'
import { Interview } from './pages/Interview'
import { CompanySandbox, OncallGame, OncallList, Sandbox } from './pages/Oncall'
import { Daily, Duels } from './pages/Practice'
import { Profile, Shop } from './pages/Profile'
import { CtfGame, DefenseGame, SecurityHub } from './pages/Security'
import { Toaster } from './game/Toaster'
import { questsFor } from './game/defs'
import { LearnPage } from './pages/Learn'
import { ModulePage, PathMap } from './pages/Path'
import { WikiList, WikiPage } from './pages/Wiki'
import { dayKey, totalXp, useProgress } from './store'
import { getTask } from './tasks'

function TaskPage() {
  const { id } = useParams()
  const task = id ? getTask(id) : undefined
  if (!task)
    return (
      <div className="p-8">
        Задача не найдена. <Link to="/" className="text-sky-400">К списку</Link>
      </div>
    )
  switch (task.kind) {
    case 'estimate':
      return <EstimateView key={task.id} task={task} />
    case 'choice':
      return <ChoiceView key={task.id} task={task} />
    case 'bottleneck':
      return <BottleneckView key={task.id} task={task} />
    case 'design':
      return (
        <div className="h-[calc(100vh-49px)]">
          <DesignView key={task.id} task={task} />
        </div>
      )
  }
}

const links = [
  { to: '/path', label: 'Путь' },
  { to: '/daily', label: 'Тренировка' },
  { to: '/', label: 'Задачи', end: true },
  { to: '/duels', label: 'Дуэли' },
  { to: '/oncall', label: 'Дежурство' },
  { to: '/interview', label: 'Интервью' },
  { to: '/security', label: 'Безопасность' },
  { to: '/wiki', label: 'Справочник' },
]

function Layout() {
  const results = useProgress((s) => s.results)
  const credits = useProgress((s) => s.credits)
  const theme = useProgress((s) => s.theme)
  const today = dayKey(new Date())
  const events = useProgress((s) => s.events[today])
  const questsDone = questsFor(today).filter((q) => (events?.[q.event] ?? 0) >= q.target).length
  const xp = totalXp(results)
  return (
    <div className={clsx('min-h-full', theme !== 'default' && theme)}>
      <nav className="sticky top-0 z-40 flex h-[49px] items-center gap-1 overflow-x-auto [scrollbar-width:none] border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur">
        <Link to="/" className="mr-4 shrink-0 whitespace-nowrap font-bold tracking-tight">
          SysDesign Gym
        </Link>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              clsx('shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm', isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-100')
            }
          >
            {l.label}
          </NavLink>
        ))}
        <Link to="/profile" className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-2 py-1 text-sm hover:bg-zinc-800">
          <span className="text-zinc-400">📜 {questsDone}/3</span>
          <span className="font-semibold text-amber-300">🪙 {credits}</span>
          <span className="flex items-center gap-1 text-zinc-200">
            <Trophy size={14} className="text-amber-300" /> {rankOf(xp).current.name}
          </span>
        </Link>
      </nav>
      <Outlet />
      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/task/:id" element={<TaskPage />} />
          <Route path="/wiki" element={<WikiList />} />
          <Route path="/wiki/:id" element={<WikiPage />} />
          <Route path="/oncall" element={<OncallList />} />
          <Route path="/oncall/:id" element={<OncallGame />} />
          <Route path="/sandbox" element={<Sandbox />} />
          <Route path="/sandbox/company" element={<CompanySandbox />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/path" element={<PathMap />} />
          <Route path="/path/:id" element={<ModulePage />} />
          <Route path="/learn/:id" element={<LearnPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/security" element={<SecurityHub />} />
          <Route path="/security/defense/:id" element={<DefenseGame />} />
          <Route path="/security/ctf/:n" element={<CtfGame />} />
          <Route path="/security/ctf" element={<CtfGame />} />
          <Route path="/duels" element={<Duels />} />
          <Route path="/interview" element={<Interview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
