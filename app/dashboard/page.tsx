"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc"
import { formatDistanceToNow } from "date-fns"
import { ru } from "date-fns/locale"

export default function DashboardPage() {
  const router = useRouter()
  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const { data: portfolios, isLoading, refetch } = trpc.portfolio.getAll.useQuery()

  const createMutation = trpc.portfolio.create.useMutation({
    onSuccess: (portfolio) => {
      router.push(`/dashboard/${portfolio.id}`)
    },
    onError: (err) => {
      alert(err.message)
      setCreating(false)
    },
  })

  const deleteMutation = trpc.portfolio.delete.useMutation({
    onSuccess: () => refetch(),
  })

  const publishMutation = trpc.portfolio.publish.useMutation({
    onSuccess: () => refetch(),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    createMutation.mutate({ title: newTitle.trim() })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои портфолио</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {portfolios?.length ?? 0} портфолио
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary"
        >
          + Новое
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-5 animate-slide-up">
          <h2 className="font-semibold text-gray-800 mb-3">Новое портфолио</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              className="input-field flex-1"
              placeholder="Название портфолио"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "Создаём..." : "Создать"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Отмена
            </button>
          </form>
        </div>
      )}

      {/* Portfolio grid */}
      {portfolios?.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📄</div>
          <h2 className="font-semibold text-gray-800 mb-1">Нет портфолио</h2>
          <p className="text-sm text-gray-500 mb-5">
            Создайте первое портфолио и поделитесь им
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary mx-auto"
          >
            Создать портфолио
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {portfolios?.map((p) => (
            <div key={p.id} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate">{p.title}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">/{p.slug}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${
                    p.isPublished
                      ? "bg-green-50 text-green-700 border border-green-100"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {p.isPublished ? "Опубликовано" : "Черновик"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span>👁 {p.viewCount}</span>
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(p.updatedAt), {
                    addSuffix: true,
                    locale: ru,
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link href={`/dashboard/${p.id}`} className="btn-secondary text-xs py-1.5 px-3">
                  Редактор
                </Link>
                {!p.isPublished && (
                  <button
                    onClick={() => publishMutation.mutate({ portfolioId: p.id })}
                    className="btn-primary text-xs py-1.5 px-3"
                    disabled={publishMutation.isPending}
                  >
                    Опубликовать
                  </button>
                )}
                {p.isPublished && (
                  <Link
                    href={`/${p.slug}`}
                    target="_blank"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Открыть ↗
                  </Link>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Удалить "${p.title}"?`)) {
                      deleteMutation.mutate({ portfolioId: p.id })
                    }
                  }}
                  className="ml-auto text-xs text-gray-300 hover:text-red-500 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
