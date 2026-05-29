import { CVEditor } from "@/components/editor/CVEditor"

export default function EditorPage({ params }: { params: { portfolioId: string } }) {
  return <CVEditor portfolioId={params.portfolioId} />
}
