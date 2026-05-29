import Link from "next/link"
import { format } from "date-fns"
import { ru } from "date-fns/locale"

interface CustomField {
  key: string
  value: string
  type: string
}

interface Item {
  id: string
  order: number
  fieldsJson: Record<string, string>
  customFields: CustomField[]
}

interface Section {
  id: string
  title: string
  order: number
  items: Item[]
}

interface Portfolio {
  id: string
  title: string
  slug: string
  viewCount: number
  publishedAt: string | null
  user: { username: string }
  sections: Section[]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    // Handle YYYY-MM format from <input type="month">
    const date = new Date(dateStr + (dateStr.length === 7 ? "-01" : ""))
    return format(date, "MMM yyyy", { locale: ru })
  } catch {
    return dateStr
  }
}

function ItemCard({ item }: { item: Item }) {
  const f = item.fieldsJson
  const allFields = { ...f }

  const title = allFields.title
  const subtitle = allFields.subtitle
  const description = allFields.description
  const url = allFields.url
  const imageUrl = allFields.imageUrl
  const dateStart = allFields.dateStart
  const dateEnd = allFields.dateEnd

  const extraFields = Object.entries(allFields).filter(
    ([k]) => !["title", "subtitle", "description", "url", "imageUrl", "dateStart", "dateEnd"].includes(k)
  )

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-4">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={title ?? ""}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-100"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && (
                <h3 className="font-semibold text-gray-900 text-sm">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600">
                      {title} ↗
                    </a>
                  ) : title}
                </h3>
              )}
              {subtitle && <p className="text-sm text-indigo-600">{subtitle}</p>}
            </div>
            {(dateStart || dateEnd) && (
              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                {dateStart && formatDate(dateStart)}
                {dateStart && dateEnd && " — "}
                {dateEnd ? formatDate(dateEnd) : dateStart ? "наст. время" : ""}
              </span>
            )}
          </div>

          {description && (
            <p className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          )}

          {extraFields.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {extraFields.map(([key, value]) => (
                <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {value || key}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function CVRenderer({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-50 to-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6 py-14">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{portfolio.title}</h1>
              <p className="text-gray-400 mt-1 text-sm">@{portfolio.user.username}</p>
            </div>
            <div className="text-right text-xs text-gray-300">
              <p>👁 {portfolio.viewCount}</p>
              {portfolio.publishedAt && (
                <p className="mt-0.5">
                  {format(new Date(portfolio.publishedAt), "d MMM yyyy", { locale: ru })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        {portfolio.sections.map((section) => (
          <section key={section.id}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              {section.title}
            </h2>
            <div>
              {section.items.length === 0 ? (
                <p className="text-sm text-gray-300 italic">Нет элементов</p>
              ) : (
                section.items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))
              )}
            </div>
          </section>
        ))}

        {portfolio.sections.length === 0 && (
          <div className="text-center py-16 text-gray-300">
            <p className="text-4xl mb-3">📄</p>
            <p>Портфолио пока пустое</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-2xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="text-xs text-gray-300 hover:text-indigo-500 transition-colors">
            CV Platform
          </Link>
          <Link href="/auth/signup" className="text-xs text-gray-300 hover:text-indigo-500 transition-colors">
            Создать своё →
          </Link>
        </div>
      </footer>
    </div>
  )
}
