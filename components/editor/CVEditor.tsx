"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { trpc } from "@/lib/trpc"
import { SectionBlock } from "./SectionBlock"
import type { EditorSection } from "@/types/editor"

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function CVEditor({ portfolioId }: { portfolioId: string }) {
  const router = useRouter()
  const [sections, setSections] = useState<EditorSection[]>([])
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [isPublished, setIsPublished] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
  const [initialized, setInitialized] = useState(false)
  const prevDataRef = useRef<string>("")

  const utils = trpc.useUtils()

  const { data: portfolio, isLoading, error } = trpc.portfolio.getById.useQuery(
    { id: portfolioId },
    { retry: 1 }
  )

  const updateFull = trpc.portfolio.updateFull.useMutation({
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => setSaveStatus("saved"),
    onError: () => setSaveStatus("unsaved"),
  })

  const publishMutation = trpc.portfolio.publish.useMutation({
    onSuccess: () => {
      setIsPublished(true)
      utils.portfolio.getAll.invalidate()
    },
  })

  const unpublishMutation = trpc.portfolio.unpublish.useMutation({
    onSuccess: () => {
      setIsPublished(false)
      utils.portfolio.getAll.invalidate()
    },
  })

  // Initialize editor from fetched data
  useEffect(() => {
    if (!portfolio || initialized) return
    setTitle(portfolio.title)
    setSlug(portfolio.slug)
    setIsPublished(portfolio.isPublished)
    setSections(
      portfolio.sections.map((s) => ({
        id: s.id,
        title: s.title,
        order: s.order,
        items: s.items.map((item) => ({
          id: item.id,
          order: item.order,
          fieldsJson: item.fieldsJson as Record<string, string>,
          customFields: item.customFields ?? [],
        })),
      }))
    )
    setInitialized(true)
    prevDataRef.current = JSON.stringify(portfolio.sections)
  }, [portfolio, initialized])

  // Autosave on changes (debounced 1.2s)
  const debouncedSections = useDebounce(sections, 1200)

  useEffect(() => {
    if (!initialized) return
    const current = JSON.stringify(debouncedSections)
    if (current === prevDataRef.current) return
    prevDataRef.current = current

    setSaveStatus("unsaved")
    updateFull.mutate({
      portfolioId,
      sections: debouncedSections.map((s, si) => ({
        id: s.id,
        title: s.title,
        order: si,
        items: s.items.map((item, ii) => ({
          id: item.id,
          order: ii,
          fieldsJson: item.fieldsJson,
          customFields: item.customFields ?? [],
        })),
      })),
    })
  }, [debouncedSections, initialized, portfolioId])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id)
      const newIdx = prev.findIndex((s) => s.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function addSection() {
    const newSection: EditorSection = {
      id: `temp_${Date.now()}`,
      title: "Новая секция",
      order: sections.length,
      items: [],
    }
    setSections((prev) => [...prev, newSection])
  }

  function updateSection(id: string, updates: Partial<EditorSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  function deleteSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id))
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg w-64" />
        <div className="h-48 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">Портфолио не найдено</p>
        <Link href="/dashboard" className="btn-secondary">
          ← Назад
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">
            ←
          </Link>
          <input
            type="text"
            className="text-xl font-bold text-gray-900 bg-transparent border-0 border-b-2 border-transparent
                       focus:outline-none focus:border-indigo-400 transition-colors min-w-0 w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== portfolio?.title) {
                updateFull.mutate({
                  portfolioId,
                  title,
                  sections: sections.map((s, si) => ({
                    id: s.id,
                    title: s.title,
                    order: si,
                    items: s.items.map((item, ii) => ({
                      id: item.id,
                      order: ii,
                      fieldsJson: item.fieldsJson,
                      customFields: item.customFields ?? [],
                    })),
                  })),
                })
              }
            }}
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save status */}
          <span className={`text-xs ${
            saveStatus === "saved" ? "text-green-500" :
            saveStatus === "saving" ? "text-yellow-500" : "text-gray-400"
          }`}>
            {saveStatus === "saved" ? "✓ Сохранено" :
             saveStatus === "saving" ? "Сохраняем..." : "● Не сохранено"}
          </span>

          {isPublished ? (
            <>
              <Link href={`/${slug}`} target="_blank" className="btn-secondary text-xs py-1.5 px-3">
                Открыть ↗
              </Link>
              <button
                onClick={() => unpublishMutation.mutate({ portfolioId })}
                className="btn-secondary text-xs py-1.5 px-3 text-orange-600"
                disabled={unpublishMutation.isPending}
              >
                Снять
              </button>
            </>
          ) : (
            <button
              onClick={() => publishMutation.mutate({ portfolioId })}
              className="btn-primary text-xs py-1.5 px-3"
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? "..." : "Опубликовать"}
            </button>
          )}
        </div>
      </div>

      {/* Slug display */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <span>🔗</span>
        <span className="font-mono">cv-platform.com/{slug}</span>
        {isPublished && (
          <span className="bg-green-50 text-green-600 text-xs px-2 py-0.5 rounded-full border border-green-100">
            Живой
          </span>
        )}
      </div>

      {/* Sections with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSectionDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                onUpdate={(updates) => updateSection(section.id, updates)}
                onDelete={() => deleteSection(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add section */}
      <button
        onClick={addSection}
        className="mt-4 w-full py-3 border-2 border-dashed border-gray-200 rounded-xl
                   text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500
                   transition-colors"
      >
        + Добавить секцию
      </button>
    </div>
  )
}
