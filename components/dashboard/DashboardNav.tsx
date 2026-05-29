"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"

export function DashboardNav({ username }: { username: string }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-indigo-600">
          CV Platform
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">
            @{username}
          </span>
          <Link
            href={`/${username}`}
            target="_blank"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Мой CV ↗
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-gray-400 hover:text-red-600 transition-colors"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  )
}
