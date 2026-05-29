import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  if (session) redirect("/dashboard")

  return (
    <main className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-indigo-600 text-lg">CV Platform</span>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="btn-secondary text-xs py-1.5 px-3">
              Войти
            </Link>
            <Link href="/auth/signup" className="btn-primary text-xs py-1.5 px-3">
              Регистрация
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 rounded-full mb-6 border border-indigo-100">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            Бесплатно. Без рекламы.
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
            Ваше портфолио —
            <br />
            <span className="text-indigo-600">красиво и быстро</span>
          </h1>

          <p className="text-lg text-gray-500 mb-8 leading-relaxed">
            Создайте профессиональное CV с собственным URL. Регистрация через Email или Telegram.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth/signup" className="btn-primary w-full sm:w-auto">
              Создать портфолио →
            </Link>
            <Link href="/aziz" className="btn-secondary w-full sm:w-auto text-sm">
              Посмотреть пример
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-white py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { icon: "⚡", title: "Быстро", desc: "Создайте CV за 5 минут с drag-and-drop редактором" },
            { icon: "🔒", title: "Безопасно", desc: "JWT сессии, верификация через Email или Telegram" },
            { icon: "🌐", title: "Публично", desc: "Поделитесь ссылкой вида cv-platform.com/username" },
          ].map((f) => (
            <div key={f.title} className="text-center">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        © 2024 CV Platform
      </footer>
    </main>
  )
}
