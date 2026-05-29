"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { EditorItem } from "@/types/editor"

interface Props {
  item: EditorItem
  onUpdate: (updates: Partial<EditorItem>) => void
  onDelete: () => void
}

const FIELD_PRESETS = [
  { key: "title", label: "Заголовок", type: "TEXT" as const },
  { key: "subtitle", label: "Подзаголовок", type: "TEXT" as const },
  { key: "description", label: "Описание", type: "TEXT" as const },
  { key: "dateStart", label: "Дата начала", type: "DATE" as const },
  { key: "dateEnd", label: "Дата конца", type: "DATE" as const },
  { key: "url", label: "Ссылка", type: "URL" as const },
  { key: "imageUrl", label: "Изображение", type: "IMAGE" as const },
]

export function ItemEditor({ item, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [addingField, setAddingField] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState("")

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function updateField(key: string, value: string) {
    onUpdate({ fieldsJson: { ...item.fieldsJson, [key]: value } })
  }

  function removeField(key: string) {
    const updated = { ...item.fieldsJson }
    delete updated[key]
    onUpdate({ fieldsJson: updated })
  }

  function addField(key: string, type: "TEXT" | "URL" | "DATE" | "IMAGE" = "TEXT") {
    if (!key || key in item.fieldsJson) return
    onUpdate({
      fieldsJson: { ...item.fieldsJson, [key]: "" },
      customFields: [
        ...item.customFields,
        { key, value: "", type },
      ],
    })
    setAddingField(false)
    setNewFieldKey("")
  }

  const displayTitle = item.fieldsJson.title || item.fieldsJson.subtitle || "Элемент"
  const fieldEntries = Object.entries(item.fieldsJson)

  const getFieldType = (key: string): "TEXT" | "URL" | "DATE" | "IMAGE" => {
    const preset = FIELD_PRESETS.find((p) => p.key === key)
    if (preset) return preset.type
    const cf = item.customFields.find((f) => f.key === key)
    return cf?.type ?? "TEXT"
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-100 rounded-lg bg-white overflow-hidden"
    >
      {/* Item header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
        <button
          {...attributes}
          {...listeners}
          className="text-gray-200 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none text-sm"
        >
          ⠿
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-sm text-gray-600 font-medium hover:text-gray-900 truncate"
        >
          {displayTitle}
        </button>

        <button
          onClick={() => {
            if (confirm("Удалить элемент?")) onDelete()
          }}
          className="text-gray-200 hover:text-red-400 transition-colors text-xs px-1"
        >
          ✕
        </button>
      </div>

      {/* Fields */}
      {expanded && (
        <div className="p-3 space-y-2.5">
          {fieldEntries.map(([key, value]) => {
            const fieldType = getFieldType(key)
            const preset = FIELD_PRESETS.find((p) => p.key === key)
            const label = preset?.label ?? key

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 font-medium">{label}</label>
                  <button
                    onClick={() => removeField(key)}
                    className="text-xs text-gray-200 hover:text-red-400 transition-colors"
                  >
                    −
                  </button>
                </div>

                {key === "description" ? (
                  <textarea
                    className="input-field text-sm resize-none"
                    rows={3}
                    placeholder="Описание..."
                    value={value}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                ) : fieldType === "URL" ? (
                  <input
                    type="url"
                    className="input-field text-sm font-mono"
                    placeholder="https://..."
                    value={value}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                ) : fieldType === "DATE" ? (
                  <input
                    type="month"
                    className="input-field text-sm"
                    value={value}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                ) : (
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder={label}
                    value={value}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                )}
              </div>
            )
          })}

          {/* Add field */}
          {addingField ? (
            <div className="pt-1 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Выберите поле</p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_PRESETS.filter((p) => !(p.key in item.fieldsJson)).map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => addField(preset.key, preset.type)}
                    className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600
                               hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input-field text-xs flex-1"
                  placeholder="Своё поле (ключ)"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                  onKeyDown={(e) => e.key === "Enter" && addField(newFieldKey)}
                />
                <button
                  onClick={() => addField(newFieldKey)}
                  className="btn-secondary text-xs py-1.5 px-2.5"
                >
                  Добавить
                </button>
                <button
                  onClick={() => setAddingField(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingField(true)}
              className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              + поле
            </button>
          )}
        </div>
      )}
    </div>
  )
}
