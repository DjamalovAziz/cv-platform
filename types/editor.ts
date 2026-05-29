export interface EditorCustomField {
  key: string
  value: string
  type: "TEXT" | "URL" | "DATE" | "IMAGE"
}

export interface EditorItem {
  id: string
  order: number
  fieldsJson: Record<string, string>
  customFields: EditorCustomField[]
}

export interface EditorSection {
  id: string
  title: string
  order: number
  items: EditorItem[]
}
