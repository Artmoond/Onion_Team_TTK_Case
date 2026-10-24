import React, { useEffect, useState } from 'react';
import { Plus, MapPin, Eye, Share2, Download, Check, Trash2, Layers, Move, GitFork, Image as ImageIcon, LogOut, ShieldCheck } from 'lucide-react';
import AuthScreen from './components/AuthScreen';
import { clearSession, logoutSession, restoreSession, type Session } from './lib/auth';

interface POI {
  id: string;
  name: string;
  category: string;
  description: string;
  x: number;
  y: number;
}

interface StudioProps {
  session: Session;
  onLogout: () => Promise<void>;
}

function Studio({ session, onLogout }: StudioProps) {
  const [editorMode, setEditorMode] = useState<'select' | 'poi' | 'graph' | 'pano'>('poi');
  const [pois, setPois] = useState<POI[]>([
    { id: 'p1', name: 'Главный стенд ТТК', category: 'sponsor', description: 'Квантовые сети и сервисы', x: 600, y: 400 },
    { id: 'p2', name: 'Конференц-зал «Сириус»', category: 'hall', description: 'Сцена и доклады', x: 250, y: 300 },
    { id: 'p3', name: 'Кофе-брейк', category: 'food', description: 'Напитки и зона отдыха', x: 950, y: 300 }
  ]);
  const [selectedPoi, setSelectedPoi] = useState<POI | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Добавление точки кликом по SVG
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (editorMode !== 'poi') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1200);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 800);

    const newPoi: POI = {
      id: `p-${Date.now()}`,
      name: `Новая точка #${pois.length + 1}`,
      category: 'service',
      description: 'Описание созданного объекта',
      x,
      y
    };
    setPois([...pois, newPoi]);
    setSelectedPoi(newPoi);
  };

  const removePoi = (id: string) => {
    setPois(pois.filter(p => p.id !== id));
    if (selectedPoi?.id === id) setSelectedPoi(null);
  };

  const copyLink = () => {
    navigator.clipboard.writeText('http://localhost:3000/m/ttk-expo');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100">
      {/* Верхний Header Студии */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center space-x-3">
          <span className="bg-[#E30613] text-white font-black text-sm px-2.5 py-1 rounded tracking-wider">ТТК</span>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
              Студия Организатора <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">Экспоцентр ТТК 2026</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Автосохранение активно
          </span>
          <div className="hidden md:flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg pl-2.5 pr-2 py-1.5">
            <span className="w-6 h-6 rounded-full bg-[#E30613] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </span>
            <div className="leading-tight">
              <div className="text-[11px] font-bold text-white max-w-[150px] truncate">{session.user.fullName}</div>
              <div className="text-[9px] uppercase tracking-wider text-emerald-400">Организатор</div>
            </div>
            <button
              onClick={() => { void onLogout(); }}
              title="Выйти"
              className="ml-1 text-slate-400 hover:text-red-400 p-1.5 rounded-md hover:bg-slate-700/60 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <button 
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 bg-[#E30613] hover:bg-red-700 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg shadow-lg active:scale-95 transition-all"
          >
            <Share2 className="w-4 h-4" /> Опубликовать & QR-код
          </button>
        </div>
      </header>

      {/* Основной двухколоночный интерфейс редактора */}
      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель инструментов и точек */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col p-4 gap-4 z-10">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Режим редактора</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setEditorMode('poi')}
                className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-lg border transition-all ${editorMode === 'poi' ? 'bg-[#E30613] text-white border-transparent' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'}`}
              >
                <Plus className="w-4 h-4" /> Добавить POI
              </button>
              <button 
                onClick={() => setEditorMode('graph')}
                className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-lg border transition-all ${editorMode === 'graph' ? 'bg-[#E30613] text-white border-transparent' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'}`}
              >
                <GitFork className="w-4 h-4" /> Граф путей
              </button>
              <button 
                onClick={() => setEditorMode('pano')}
                className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-lg border transition-all ${editorMode === 'pano' ? 'bg-[#E30613] text-white border-transparent' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'}`}
              >
                <Eye className="w-4 h-4" /> Панорамы 360
              </button>
              <button 
                onClick={() => setEditorMode('select')}
                className={`flex items-center gap-2 text-xs font-semibold p-2.5 rounded-lg border transition-all ${editorMode === 'select' ? 'bg-[#E30613] text-white border-transparent' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'}`}
              >
                <Move className="w-4 h-4" /> Выбор
              </button>
            </div>
            {editorMode === 'poi' && (
              <p className="text-[11px] text-cyan-400 mt-2 bg-cyan-950/40 p-2 rounded border border-cyan-800/40">
                👉 Кликните в любое место плана здания, чтобы поставить новую точку интереса.
              </p>
            )}
          </div>

          {/* Список точек */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Точки интереса ({pois.length})</label>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {pois.map(poi => (
                <div 
                  key={poi.id}
                  onClick={() => setSelectedPoi(poi)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer flex justify-between items-center transition-all ${selectedPoi?.id === poi.id ? 'bg-slate-800 border-cyan-500' : 'bg-slate-850/60 border-slate-800 hover:bg-slate-800'}`}
                >
                  <div>
                    <div className="font-bold text-slate-100">{poi.name}</div>
                    <div className="text-[10px] text-slate-400">{poi.category} • X:{poi.x} Y:{poi.y}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removePoi(poi.id); }} className="text-slate-500 hover:text-red-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Редактирование выбранной точки */}
          {selectedPoi && (
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 text-xs flex flex-col gap-2">
              <span className="font-bold text-cyan-400">Свойства точки</span>
              <input 
                value={selectedPoi.name} 
                onChange={(e) => {
                  const updated = { ...selectedPoi, name: e.target.value };
                  setSelectedPoi(updated);
                  setPois(pois.map(p => p.id === updated.id ? updated : p));
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                placeholder="Название точки"
              />
              <select 
                value={selectedPoi.category}
                onChange={(e) => {
                  const updated = { ...selectedPoi, category: e.target.value };
                  setSelectedPoi(updated);
                  setPois(pois.map(p => p.id === updated.id ? updated : p));
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
              >
                <option value="sponsor">Стенд компании (ТТК)</option>
                <option value="hall">Конференц-зал</option>
                <option value="food">Кофе-брейк / Буфет</option>
                <option value="service">Служба / Ресепшн</option>
                <option value="wc">Санузел</option>
              </select>
            </div>
          )}
        </aside>

        {/* Центральный холст 2D Плана */}
        <main className="flex-1 bg-slate-950 p-4 flex items-center justify-center relative overflow-hidden">
          <div className="w-full h-full max-w-5xl bg-slate-900 rounded-xl border border-slate-800 relative shadow-2xl overflow-hidden flex items-center justify-center">
            <svg 
              viewBox="0 0 1200 800" 
              className="w-full h-full object-contain cursor-crosshair"
              onClick={handleSvgClick}
            >
              {/* Контур здания */}
              <rect x="50" y="50" width="1100" height="700" rx="16" fill="#0f172a" stroke="#334155" strokeWidth="3" />
              
              {/* Коридоры */}
              <rect x="500" y="250" width="200" height="490" fill="#1e293b" opacity="0.6" />
              <rect x="200" y="260" width="800" height="90" fill="#1e293b" opacity="0.6" />

              {/* Комнаты */}
              <rect x="100" y="100" width="350" height="350" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <text x="275" y="220" textAnchor="middle" fill="#94a3b8" fontSize="18" fontWeight="bold">Зал «Сириус»</text>

              <rect x="800" y="100" width="300" height="350" rx="10" fill="#1e293b" stroke="#475569" strokeWidth="2" />
              <text x="950" y="220" textAnchor="middle" fill="#94a3b8" fontSize="18" fontWeight="bold">Кофе-брейк</text>

              <circle cx="600" cy="400" r="110" fill="#e30613" fillOpacity="0.1" stroke="#e30613" strokeWidth="2" strokeDasharray="6,4" />
              <text x="600" y="470" textAnchor="middle" fill="#e30613" fontSize="16" fontWeight="bold">Стенд ТТК</text>

              {/* POI Маркеры с перетаскиванием */}
              {pois.map(poi => (
                <g 
                  key={poi.id} 
                  transform={`translate(${poi.x}, ${poi.y})`}
                  onClick={(e) => { e.stopPropagation(); setSelectedPoi(poi); }}
                  className="cursor-pointer"
                >
                  <circle cx="0" cy="0" r="16" fill={selectedPoi?.id === poi.id ? '#38bdf8' : (poi.category === 'sponsor' ? '#E30613' : '#0284c7')} stroke="white" strokeWidth="2" />
                  <text x="0" y="28" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{poi.name}</text>
                </g>
              ))}
            </svg>
          </div>
        </main>
      </div>

      {/* Модальное окно Публикации и скачивания QR-кода */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Публичная карта готова!</h2>
            <p className="text-xs text-slate-400 mb-6">
              Посетители могут открыть эту карту без установки мобильных приложений, просто наведя камеру телефона на QR-код.
            </p>

            {/* Имитация брендированного QR-кода ТТК */}
            <div className="bg-white p-4 rounded-xl inline-block mb-4 shadow-lg">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=http://localhost:3000/m/ttk-expo" 
                alt="QR Code" 
                className="w-48 h-48"
              />
              <div className="mt-2 text-slate-900 font-bold text-[11px] tracking-wider uppercase">
                ТТК • Карта Пространства
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-800 p-2.5 rounded-lg border border-slate-700 mb-4 text-xs">
              <input 
                readOnly 
                value="http://localhost:3000/m/ttk-expo" 
                className="bg-transparent flex-1 text-slate-300 outline-none"
              />
              <button 
                onClick={copyLink} 
                className="bg-[#E30613] hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded transition-all flex items-center gap-1"
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : 'Копировать'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a 
                href="https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=http://localhost:3000/m/ttk-expo" 
                download="ttk_qr_code.png"
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <Download className="w-4 h-4" /> Скачать QR (PNG)
              </a>
              <button 
                onClick={() => setShowQrModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs py-2.5 px-3 rounded-lg"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:3000';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored && restored.user.role !== 'admin') {
          clearSession();
          setSession(null);
          return;
        }
        setSession(restored);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await logoutSession();
    setSession(null);
  };

  if (booting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#E30613]" />
          Проверяем сессию…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthScreen
        mode="admin"
        alternateUrl={CLIENT_URL}
        onAuthenticated={setSession}
      />
    );
  }

  return <Studio session={session} onLogout={handleLogout} />;
}
