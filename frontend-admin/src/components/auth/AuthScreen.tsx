import { ArrowRight, Eye, EyeOff, KeyRound, Mail, UserRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { AuthError, loginOrganizer, registerOrganizer, type AuthUser } from '../../services/auth';
import { useEditorStore } from '../../store/editorStore';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
  serviceUnavailable?: string | null;
}

export function AuthScreen({ onAuthenticated, serviceUnavailable }: AuthScreenProps) {
  const showToast = useEditorStore((state) => state.showToast);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === 'register' && password !== confirmPassword) {
      showToast('error', 'Пароли не совпадают', 'Проверьте повтор пароля и попробуйте снова.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await registerOrganizer({ name: name.trim(), email: normalizedEmail, password });
        showToast('success', 'Аккаунт создан', 'Теперь войдите с указанными email и паролем.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const user = await loginOrganizer({ email: normalizedEmail, password });
        onAuthenticated(user);
      }
    } catch (error) {
      const message = error instanceof AuthError
        ? error.message
        : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
      showToast('error', mode === 'login' ? 'Не удалось войти' : 'Не удалось зарегистрироваться', message);
    } finally {
      setSubmitting(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <main className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl lg:grid-cols-[1fr_0.85fr]">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/50 p-10 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-brand px-2.5 py-1 text-sm font-black tracking-wider text-white">ТТК</span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Студия организатора</span>
            </div>
            <h1 className="mt-16 max-w-md text-4xl font-black leading-tight">
              Пространство для создания карт ваших событий
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
              Войдите, чтобы проектировать площадки, добавлять точки интереса и публиковать интерактивные карты.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['01', 'План и стены'],
              ['02', 'POI и панорамы'],
              ['03', 'Публикация и QR'],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl border border-slate-700/70 bg-slate-950/40 px-3 py-4">
                <div className="text-xs font-black text-brand">{number}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-300">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 lg:hidden">
            <span className="rounded bg-brand px-2.5 py-1 text-sm font-black tracking-wider text-white">ТТК</span>
            <h1 className="mt-5 text-2xl font-black">Студия организатора</h1>
          </div>
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-400">Добро пожаловать</p>
            <h2 className="mt-2 text-2xl font-black">{isRegister ? 'Создать аккаунт' : 'Войти в аккаунт'}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {isRegister ? 'Зарегистрируйтесь как организатор площадки.' : 'Войдите, чтобы продолжить работу над картами.'}
            </p>
          </div>

          {serviceUnavailable && (
            <div className="mb-5 rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-xs leading-5 text-amber-200" role="status">
              {serviceUnavailable}
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-700 bg-slate-950/70 p-1">
            <button type="button" onClick={() => setMode('login')} className={`rounded-md px-3 py-2 text-xs font-bold transition ${!isRegister ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              Авторизация
            </button>
            <button type="button" onClick={() => setMode('register')} className={`rounded-md px-3 py-2 text-xs font-bold transition ${isRegister ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {isRegister && (
              <label className="block">
                <span className="label">Имя организатора</span>
                <span className="relative block">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input className="field pl-10" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" required maxLength={100} />
                </span>
              </label>
            )}
            <label className="block">
              <span className="label">Email</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="field pl-10" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required maxLength={254} />
              </span>
            </label>
            <label className="block">
              <span className="label">Пароль</span>
              <span className="relative block">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="field pl-10 pr-10" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? 'Не менее 12 символов' : 'Введите пароль'} required minLength={isRegister ? 12 : undefined} maxLength={128} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-200" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
            {isRegister && (
              <label className="block">
                <span className="label">Повторите пароль</span>
                <input className="field" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Повторите пароль" required minLength={12} maxLength={128} />
              </label>
            )}
            {isRegister && <p className="text-[11px] leading-5 text-slate-500">Используйте не менее 12 символов. Не используйте пароль от других сервисов.</p>}
            <button className="btn-primary mt-2 w-full py-3" type="submit" disabled={submitting}>
              {submitting ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
          <p className="mt-6 text-center text-[10px] leading-5 text-slate-500">
            Доступ к редактору предоставляется после успешной авторизации.
          </p>
        </section>
      </main>
    </div>
  );
}
