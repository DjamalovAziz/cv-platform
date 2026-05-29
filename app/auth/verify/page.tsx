"use client"

import { useEffect, useState, useRef } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface PendingSignup {
  pendingId: string
  method: "EMAIL" | "DEEPLINK"
  deepLink?: string
  username: string
}

export default function VerifyPage() {
  const router = useRouter()
  const [pending, setPending] = useState<PendingSignup | null>(null)
  const [code, setCode] = useState(["", "", "", ""])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 min
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const raw = sessionStorage.getItem("pending_signup")
    if (!raw) {
      router.push("/auth/signup")
      return
    }
    setPending(JSON.parse(raw))
  }, [router])

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft((n) => n - 1), 1000)
    return () => clearInterval(t)
  }, [timeLeft])

  // For Telegram: poll every 3s to check if code appeared (bot saved it to Redis)
  // We do this by attempting verify with empty code — server returns CODE_AVAILABLE
  // Actually simpler: just let user enter manually; show a "refresh" button instead
  // The bot sends the code via Telegram message, user types it in

  function handleDigit(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4)
    if (text.length === 4) {
      setCode(text.split(""))
      inputRefs.current[3]?.focus()
    }
    e.preventDefault()
  }

  async function handleVerify() {
    const fullCode = code.join("")
    if (fullCode.length !== 4) return
    if (!pending) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId: pending.pendingId, code: fullCode }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === "INVALID_CODE") setError("Неверный код")
        else if (data.error === "CODE_EXPIRED") setError("Код истёк. Запросите новый.")
        else if (data.error === "SESSION_EXPIRED") {
          setError("Сессия истекла. Начните регистрацию заново.")
          sessionStorage.removeItem("pending_signup")
        } else {
          setError(data.error ?? "Ошибка сервера")
        }
        setCode(["", "", "", ""])
        inputRefs.current[0]?.focus()
        return
      }

      setSuccess(true)
      sessionStorage.removeItem("pending_signup")

      // Auto sign in
      await signIn("credentials", {
        username: pending.username,
        password: "__BYPASS__", // Won't work — user needs to sign in
        redirect: false,
      })

      router.push(`/auth/signin?registered=1`)
    } catch {
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = String(timeLeft % 60).padStart(2, "0")

  if (!pending) return null

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Аккаунт создан!</h1>
          <p className="text-gray-500 mb-6">Переходим на страницу входа...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-indigo-600 font-semibold text-xl">CV Platform</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-2">Введите код</h1>

          {pending.method === "EMAIL" ? (
            <p className="text-sm text-gray-500">
              Мы отправили 4-значный код на вашу почту
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Откройте Telegram бота и получите код
            </p>
          )}
        </div>

        <div className="card p-6">
          {/* Telegram deep link */}
          {pending.method === "DEEPLINK" && pending.deepLink && (
            <a
              href={pending.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full mb-5 justify-center"
            >
              ✈️ Открыть Telegram для получения кода
            </a>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* 4-digit code input */}
          <div className="flex gap-3 justify-center mb-5" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl
                           focus:outline-none focus:border-indigo-500 transition-colors
                           border-gray-200 bg-white"
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={code.join("").length !== 4 || loading}
            className="btn-primary w-full"
          >
            {loading ? "Проверяем..." : "Подтвердить"}
          </button>

          {timeLeft > 0 ? (
            <p className="text-center text-sm text-gray-400 mt-4">
              Код действителен: {minutes}:{seconds}
            </p>
          ) : (
            <p className="text-center text-sm text-red-500 mt-4">Код истёк</p>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-400">
          <Link href="/auth/signup" className="hover:text-gray-600">
            ← Вернуться к регистрации
          </Link>
        </p>
      </div>
    </div>
  )
}
