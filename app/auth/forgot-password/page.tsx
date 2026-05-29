"use client"

import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset code state
  const [showReset, setShowReset] = useState(false)
  const [resetToken, setResetToken] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError("Слишком много запросов. Подождите минуту.")
        } else {
          setError("Ошибка сервера. Попробуйте позже.")
        }
        return
      }

      setSent(true)
      if (data.deepLink) setDeepLink(data.deepLink)
      if (data.method === "TELEGRAM") setShowReset(true)
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetError(null)
    setResetLoading(true)

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, code, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === "INVALID_CODE") setResetError("Неверный код")
        else if (data.error === "TOKEN_EXPIRED") setResetError("Код истёк. Запросите сброс заново.")
        else setResetError(data.error ?? "Ошибка сервера")
        return
      }

      setResetDone(true)
    } catch {
      setResetError("Ошибка сети")
    } finally {
      setResetLoading(false)
    }
  }

  if (resetDone) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Пароль изменён!</h1>
          <p className="text-gray-500 mb-6">Все активные сессии завершены.</p>
          <Link href="/auth/signin" className="btn-primary">Войти с новым паролем</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-indigo-600 font-semibold text-xl">CV Platform</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">Сброс пароля</h1>
        </div>

        {!sent ? (
          <div className="card p-6">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="label">Логин или Email</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Введите логин или email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Отправляем..." : "Получить код"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card p-6">
            <div className="bg-green-50 border border-green-100 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
              Если аккаунт существует, инструкции были отправлены.
            </div>

            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full justify-center mb-4"
              >
                ✈️ Получить код в Telegram
              </a>
            )}

            {resetError && (
              <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                {resetError}
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-4">
              {!deepLink && (
                <div>
                  <label className="label">Токен сброса (из письма)</label>
                  <input
                    type="text"
                    className="input-field font-mono text-sm"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value.trim())}
                  />
                </div>
              )}

              <div>
                <label className="label">Код из сообщения</label>
                <input
                  type="text"
                  className="input-field text-center text-xl font-bold tracking-widest"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>

              <div>
                <label className="label">Новый пароль</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Минимум 8 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary w-full" disabled={resetLoading}>
                {resetLoading ? "Меняем пароль..." : "Сбросить пароль"}
              </button>
            </form>
          </div>
        )}

        <p className="mt-4 text-center">
          <Link href="/auth/signin" className="text-sm text-gray-400 hover:text-gray-600">
            ← Вернуться к входу
          </Link>
        </p>
      </div>
    </div>
  )
}
