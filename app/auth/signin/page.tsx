"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Неверный логин или пароль",
  VERIFICATION_REQUIRED: "Сначала подтвердите аккаунт",
  OAuthAccountNotLinked: "Аккаунт привязан к другому провайдеру",
  default: "Произошла ошибка. Попробуйте ещё раз.",
}

function SignInForm() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard"
  const [form, setForm] = useState({ username: "", password: "" })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const urlError = params.get("error")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await signIn("credentials", {
      username: form.username,
      password: form.password,
      redirect: false,
    })

    setLoading(false)

    if (!res?.ok) {
      const msg = res?.error ?? "default"

      if (msg === "VERIFICATION_REQUIRED") {
        router.push(`/auth/verify?username=${encodeURIComponent(form.username)}`)
        return
      }

      setError(ERROR_MESSAGES[msg] ?? ERROR_MESSAGES.default)
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-indigo-600 font-semibold text-xl">CV Platform</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">Войти</h1>
          <p className="text-sm text-gray-500">Введите ваш логин и пароль</p>
        </div>

        <div className="card p-6">
          {(error || urlError) && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error ?? ERROR_MESSAGES[urlError!] ?? ERROR_MESSAGES.default}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Логин</label>
              <input
                type="text"
                className="input-field"
                placeholder="username"
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="label">Пароль</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center space-y-2">
          <p className="text-sm text-gray-500">
            Нет аккаунта?{" "}
            <Link href="/auth/signup" className="text-indigo-600 hover:underline font-medium">
              Регистрация
            </Link>
          </p>
          <Link href="/auth/forgot-password" className="text-sm text-gray-400 hover:text-gray-600">
            Забыли пароль?
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <SignInForm />
    </Suspense>
  )
}
