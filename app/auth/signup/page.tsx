"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type AuthMethod = "EMAIL" | "TELEGRAM"

interface FormState {
  username: string
  password: string
  confirmPassword: string
  authMethod: AuthMethod
  contact: string
}

export default function SignUpPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    username: "",
    password: "",
    confirmPassword: "",
    authMethod: "EMAIL",
    contact: "",
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "general", string>>>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const e: typeof errors = {}

    if (!/^[a-z0-9_]{3,30}$/.test(form.username)) {
      e.username = "3–30 символов: строчные буквы, цифры, _"
    }
    if (form.password.length < 8 || !/(?=.*[a-zA-Z])(?=.*[0-9])/.test(form.password)) {
      e.password = "Минимум 8 символов, буква и цифра"
    }
    if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Пароли не совпадают"
    }
    if (form.authMethod === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact)) {
      e.contact = "Введите корректный email"
    }
    if (form.authMethod === "TELEGRAM" && !form.contact.trim()) {
      e.contact = "Введите Telegram username"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch("/api/auth/signup/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          authMethod: form.authMethod,
          contact: form.contact.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === "USERNAME_TAKEN") {
          setErrors({ username: "Этот логин уже занят" })
        } else if (data.error === "TOO_MANY_REQUESTS") {
          setErrors({ general: "Слишком много попыток. Подождите минуту." })
        } else {
          setErrors({ general: data.error ?? "Ошибка сервера" })
        }
        return
      }

      // Save pendingId in sessionStorage for verify page
      sessionStorage.setItem("pending_signup", JSON.stringify({
        pendingId: data.pendingId,
        method: data.method,
        deepLink: data.deepLink,
        username: form.username,
      }))

      router.push("/auth/verify")
    } catch {
      setErrors({ general: "Ошибка сети. Проверьте подключение." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-indigo-600 font-semibold text-xl">CV Platform</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">Регистрация</h1>
          <p className="text-sm text-gray-500">Создайте аккаунт бесплатно</p>
        </div>

        <div className="card p-6">
          {errors.general && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Логин</label>
              <input
                type="text"
                className="input-field"
                placeholder="your_username"
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              />
              {errors.username && <p className="error-text">{errors.username}</p>}
            </div>

            <div>
              <label className="label">Пароль</label>
              <input
                type="password"
                className="input-field"
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {errors.password && <p className="error-text">{errors.password}</p>}
            </div>

            <div>
              <label className="label">Подтвердите пароль</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
              {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
            </div>

            {/* Auth method toggle */}
            <div>
              <label className="label">Способ верификации</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(["EMAIL", "TELEGRAM"] as AuthMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setForm({ ...form, authMethod: method, contact: "" })}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      form.authMethod === method
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {method === "EMAIL" ? "📧 Email" : "✈️ Telegram"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">
                {form.authMethod === "EMAIL" ? "Email адрес" : "Telegram username"}
              </label>
              <input
                type={form.authMethod === "EMAIL" ? "email" : "text"}
                className="input-field"
                placeholder={form.authMethod === "EMAIL" ? "you@example.com" : "username (без @)"}
                autoComplete={form.authMethod === "EMAIL" ? "email" : "off"}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
              {errors.contact && <p className="error-text">{errors.contact}</p>}
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Уже есть аккаунт?{" "}
          <Link href="/auth/signin" className="text-indigo-600 hover:underline font-medium">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
