import { ImageResponse } from "next/og"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get("slug") ?? ""

  let title = "CV Platform"
  let username = slug

  try {
    const portfolio = await prisma.portfolio.findUnique({
      where: { slug },
      select: { title: true, user: { select: { username: true } } },
    })
    if (portfolio) {
      title = portfolio.title
      username = portfolio.user.username
    }
  } catch {
    // Fall through to defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #eef2ff 0%, #fff 60%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            color: "#6366f1",
            fontWeight: 600,
            marginBottom: 24,
            background: "#eef2ff",
            padding: "6px 16px",
            borderRadius: 99,
          }}
        >
          CV Platform
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ fontSize: 24, color: "#9ca3af", marginTop: 16 }}>
          @{username}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
