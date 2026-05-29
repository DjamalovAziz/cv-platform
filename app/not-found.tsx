import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Страница не найдена</h1>
        <p className="text-gray-500 text-sm mb-6">
          Возможно, портфолио было удалено или ещё не опубликовано
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            На главную
          </Link>
          <Link href="/auth/signup" className="btn-secondary">
            Создать CV
          </Link>
        </div>
      </div>
    </div>
  )
}
