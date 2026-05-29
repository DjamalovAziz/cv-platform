"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { ItemEditor } from "./ItemEditor"
import type { EditorSection, EditorItem } from "@/types/editor"

interface Props {
  section: EditorSection
  onUpdate: (updates: Partial<EditorSection>) => void
  onDelete: () => void
}

export function SectionBlock({ section, onUpdate, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = section.items.findIndex((i) => i.id === active.id)
    const newIdx = section.items.findIndex((i) => i.id === over.id)
    onUpdate({ items: arrayMove(section.items, oldIdx, newIdx) })
  }

  function addItem() {
    const newItem: EditorItem = {
      id: `temp_item_${Date.now()}`,
      order: section.items.length,
      fieldsJson: { title: "", description: "" },
      customFields: [],
    }
    onUpdate({ items: [...section.items, newItem] })
  }

  function updateItem(id: string, updates: Partial<EditorItem>) {
    onUpdate({
      items: section.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })
  }

  function deleteItem(id: string) {
    onUpdate({ items: section.items.filter((item) => item.id !== id) })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card overflow-hidden"
    >
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none select-none"
          title="Перетащить секцию"
        >
          ⠿
        </button>

        {editingTitle ? (
          <input
            autoFocus
            className="flex-1 text-sm font-semibold bg-white border border-indigo-300 rounded px-2 py-0.5 focus:outline-none"
            value={section.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
          />
        ) : (
          <button
            className="flex-1 text-left text-sm font-semibold text-gray-700 hover:text-indigo-600"
            onClick={() => setEditingTitle(true)}
          >
            {section.title || "Без названия"}
          </button>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1.5"
          >
            {collapsed ? "▾" : "▴"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Удалить секцию "${section.title}"?`)) onDelete()
            }}
            className="text-xs text-gray-300 hover:text-red-500 px-1.5 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={section.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {section.items.map((item) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  onUpdate={(updates) => updateItem(item.id, updates)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            onClick={addItem}
            className="w-full py-2 border border-dashed border-gray-200 rounded-lg
                       text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-500
                       transition-colors"
          >
            + Добавить элемент
          </button>
        </div>
      )}
    </div>
  )
}
