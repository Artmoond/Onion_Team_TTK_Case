import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from 'lucide-react';
import {
  ApiError,
  loginUser,
  registerUser,
  roleLabel,
  type AuthRole,
  type Session,
} from '../lib/auth';

interface AuthScreenProps {
  mode: AuthRole;
  alternateUrl: string;
  onAuthenticated: (session: Session) => void;
}

const DEMO = {
  admin: { email: 'admin@ttk.local', password: 'Admin12345!' },
  user: { email: 'user@ttk.local', password: 'User12345!' },
};

export default function AuthScreen({ mode, alternateUrl, onAuthenticated }: AuthScreenProps) {
  const isAdmin = mode === 'admin';
  const [formMode, setFormMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title = isAdmin ? 'Студия организатора' : 'Карта пространства';
  const subtitle = isAdmin
    ? 'Управляйте планом, точками интереса и панорамами площадки.'
    : 'Войдите, чтобы построить маршрут и открыть 360° панорамы.';
  const demo = DEMO[mode];

  const switchFormMode = (next: 'login' | 'register') => {
    setFormMode(next);
    setError(null);
    setPassword('');
    setConfirmPassword('');
    setInviteCode('');
  };

  const goToAlternateRole = () => {
    window.location.href = alternateUrl;
  };

  const validate = (): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Введите корректный email';
    }
    if (!password) return 'Введите пароль';
    if (formMode === 'register') {
      if (fullName.trim().length < 2) return 'Укажите имя (минимум 2 символа)';
      if (password.length < 8) return 'Пароль должен быть не короче 8 символов';
      if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) {
        return 'Пароль должен содержать букву и цифру';
      }
      if (password !== confirmPassword) return 'Пароли не совпадают';
      if (isAdmin && inviteCode.trim().length === 0) {
        return 'Введите код организатора';
      }
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const session =
        formMode === 'login'
          ? await loginUser(email, password, mode)
          : await registerUser({
              email,
              password,
              fullName,
              role: mode,
              adminInviteCode: isAdmin ? inviteCode : undefined,
            });
      onAuthenticated(session);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Не удалось выполнить вход. Попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = () => {
    setEmail(demo.email);
    setPassword(demo.password);
    setFormMode('login');
    setError(null);
  };

  const mismatch = error?.includes('Войдите в Студию') || error?.includes('мобильную карту');

  return (
    <div className="relative min-h-screen w-full overflow-y-auto bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#E30613]/20 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8">
        <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden lg:block">
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-lg bg-[#E30613] px-3 py-1.5 text-lg font-black tracking-widest text-white">
                ТТК
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                Indoor Navigation
              </span>
            </div>
            <h1 className="mb-4 text-4xl font-black leading-tight text-white">
              {isAdmin ? 'Панель управления' : 'Навигация по площадке'}
              <span className="block text-[#E30613]">
                {isAdmin ? 'в один клик' : 'внутри здания'}
              </span>
            </h1>
            <p className="mb-8 max-w-md text-sm leading-6 text-slate-400">
              {isAdmin
                ? 'Редактируйте 2D-план, расставляйте POI, загружайте панорамы и публикуйте карту для посетителей.'
                : 'Интерактивный план, кратчайшие маршруты и 360° панорамы. Всё работает прямо в браузере телефона.'}
            </p>

            <div className="space-y-3">
              {(isAdmin
                ? [
                    'Защищённый вход с ролью организатора',
                    'Управление точками интереса и графом',
                    'Публикация карты и QR-кода',
                  ]
                : [
                    'Быстрый вход и регистрация за 20 секунд',
                    'Маршруты по коридорам и этажам',
                    'Виртуальные прогулки в 360°',
                  ]
              ).map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-[#E30613] px-2.5 py-1 text-sm font-black tracking-wider text-white">
                    ТТК
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white">{title}</h2>
                    <p className="text-[11px] text-slate-400">
                      {formMode === 'login' ? 'Вход в аккаунт' : 'Создание аккаунта'}
                    </p>
                  </div>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-cyan-400">
                  {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                </span>
              </div>

              <p className="mb-5 text-xs leading-5 text-slate-400">{subtitle}</p>

              <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/70 p-1.5 ring-1 ring-slate-800">
                <button
                  type="button"
                  onClick={isAdmin ? undefined : goToAlternateRole}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all ${
                    !isAdmin
                      ? 'bg-[#E30613] text-white shadow-lg'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <UserRound className="h-4 w-4" /> Посетитель
                </button>
                <button
                  type="button"
                  onClick={isAdmin ? undefined : goToAlternateRole}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all ${
                    isAdmin
                      ? 'bg-[#E30613] text-white shadow-lg'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="h-4 w-4" /> Организатор
                </button>
              </div>

              <div className="mb-5 grid grid-cols-2 gap-2 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => switchFormMode('login')}
                  className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                    formMode === 'login'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Вход
                </button>
                <button
                  type="button"
                  onClick={() => switchFormMode('register')}
                  className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                    formMode === 'register'
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Регистрация
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                {formMode === 'register' && (
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Имя и фамилия
                    </span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-cyan-500/70">
                      <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
                      <input
                        name="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Анна Иванова"
                        autoComplete="name"
                        className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                      />
                    </div>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Email
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-cyan-500/70">
                    <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                      className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Пароль
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-cyan-500/70">
                    <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete={formMode === 'login' ? 'current-password' : 'new-password'}
                      className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-slate-500 transition-colors hover:text-slate-300"
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {formMode === 'register' && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Повторите пароль
                      </span>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-cyan-500/70">
                        <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                        />
                      </div>
                    </label>

                    {isAdmin && (
                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Код организатора
                        </span>
                        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-cyan-500/70">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" />
                          <input
                            name="adminInviteCode"
                            value={inviteCode}
                            onChange={(event) => setInviteCode(event.target.value)}
                            placeholder="TTK-ADMIN-2026"
                            autoComplete="off"
                            className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-600"
                          />
                        </div>
                        <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                          Код выдаёт команда проекта. Без него создать админский аккаунт нельзя.
                        </p>
                      </label>
                    )}

                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                      <span className="rounded-full bg-slate-800 px-2 py-1">8+ символов</span>
                      <span className="rounded-full bg-slate-800 px-2 py-1">буква</span>
                      <span className="rounded-full bg-slate-800 px-2 py-1">цифра</span>
                    </div>
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs leading-5 text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p>{error}</p>
                      {mismatch && (
                        <button
                          type="button"
                          onClick={goToAlternateRole}
                          className="mt-2 inline-flex items-center gap-1 font-bold text-red-200 underline underline-offset-2"
                        >
                          Перейти в другой раздел <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E30613] py-3 text-sm font-bold text-white shadow-lg shadow-red-950/40 transition-all hover:bg-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Проверяем…
                    </>
                  ) : formMode === 'login' ? (
                    <>
                      Войти как {roleLabel(mode).toLowerCase()} <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <UserRoundPlus className="h-4 w-4" /> Создать аккаунт
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <button
                  type="button"
                  onClick={fillDemo}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Демо-доступ
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-300">
                      {demo.email} · {demo.password}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-cyan-300">
                    Подставить
                  </span>
                </button>
              </div>

              <p className="mt-4 text-center text-[10px] leading-4 text-slate-600">
                Продолжая, вы соглашаетесь с правилами обработки данных.
                <br />
                Защищено JWT + bcrypt. Пароли хранятся только в виде хеша.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
