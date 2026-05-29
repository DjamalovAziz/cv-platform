# Universal CV Platform — Production Spec v4 (Final)

## Контекст и цель
Отказоустойчивая платформа для создания динамических портфолио/резюме. Пользователи регистрируются через Email или Telegram, создают многосекционные CV, публикуют их по уникальному slug (например `/aziz`). Платформа обеспечивает полный security-цикл: верификация при регистрации, безопасное восстановление пароля, инвалидация сессий, rate limiting, кеширование.

---

## Стек (финальный)

| Слой | Технология | Зачем |
|------|-----------|-------|
| Frontend | Next.js 14 App Router (RSC + Client) | SSR/SSG, файловый роутинг, server actions |
| API | tRPC v10 + React Query v5 | Type-safe API, optimistic updates, кеш на клиенте |
| ORM | Prisma 5 + PostgreSQL (Supabase) | Типобезопасные запросы, миграции |
| Кеш / Rate Limit / Temp Tokens | Redis (Upstash) | TTL-хранилище, счётчики, rate limiting |
| Auth | NextAuth.js v4 (JWT strategy) | Сессии, credentials provider, callbacks |
| Telegram | grammy | Отправка кодов и deep-link верификация |
| Email | Nodemailer + SMTP | HTML-письма с кодами |
| Пароли | bcrypt (cost=10) | Безопасное хеширование |
| Медиа | Supabase Storage + presigned URLs | Загрузка изображений без проксирования |
| OG-изображения | @vercel/og | Динамические превью для соцсетей |
| Мониторинг | Sentry + Pino | Ошибки + структурированные security-логи |
| Deploy | Vercel + Supabase + Upstash | Serverless, managed DB, managed Redis |

---

## 1. Prisma Schema (полная, v4)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL") // нужен для локальных миграций
}

// ─── AUTH ───────────────────────────────────────────────────────────────────

model User {
  id           String     @id @default(cuid())
  username     String     @unique
  email        String?    @unique
  passwordHash String
  telegramId   String?    @unique
  isVerified   Boolean    @default(false)
  verifiedAt   DateTime?
  authMethod   AuthMethod @default(EMAIL)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt   // используется для инвалидации JWT после смены пароля

  portfolios Portfolio[]
}

enum AuthMethod {
  EMAIL
  TELEGRAM
}

// ─── CV ─────────────────────────────────────────────────────────────────────

model Portfolio {
  id          String    @id @default(cuid())
  title       String
  slug        String    @unique        // = username по умолчанию, можно изменить
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  isPublished Boolean   @default(false)
  publishedAt DateTime?
  viewCount   Int       @default(0)   // синхронизируется из Redis раз в час
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sections Section[]

  @@index([userId])
  @@index([slug])
}

model Section {
  id          String    @id @default(cuid())
  title       String
  order       Int
  portfolioId String
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  items       Item[]

  @@index([portfolioId, order])
}

model Item {
  id        String   @id @default(cuid())
  order     Int
  sectionId String
  section   Section  @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  fieldsJson Json    @default("{}")   // хранит все поля: title, description, url, date, imageUrl и т.д.
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  customFields CustomField[]  // только для полей, требующих поиска/индексации

  @@index([sectionId, order])
}

// Только для индексируемых полей (например, поиск по технологии)
model CustomField {
  id     String    @id @default(cuid())
  itemId String
  item   Item      @relation(fields: [itemId], references: [id], onDelete: Cascade)
  key    String
  value  String
  type   FieldType @default(TEXT)

  @@unique([itemId, key])
  @@index([key, value])
}

enum FieldType {
  TEXT
  URL
  DATE
  IMAGE
}
```

**Примечание:** NextAuth JWT strategy не требует таблиц Session/Account/VerificationToken. `User.updatedAt` используется как механизм инвалидации всех токенов при смене пароля.

---

## 2. Redis — полная структура ключей

| Ключ | Тип | Значение | TTL | Когда удаляется |
|------|-----|---------|-----|-----------------|
| `pending_reg:{userId}` | string (JSON) | `{ username, passwordHash, email?, telegramChatId?, authMethod }` | 15 мин | После успешной верификации |
| `code:{userId}` | string | `"4829"` (4 цифры) | 5 мин | Перед записью нового кода (`DEL` → `SET`) |
| `reset_token:{resetToken}` | string (JSON) | `{ userId, code }` | 10 мин | После успешного сброса |
| `cv:{slug}` | string (JSON) | Полный JSON портфолио | 5 мин | При `updateFull`, `publish`, `delete` |
| `cv_view:{slug}` | int | Счётчик просмотров | ∞ | Сбрасывается в БД каждый час через cron |
| `rate:ip:{ip}` | int | Счётчик | 60 сек | Auto-expire |
| `rate:uid:{userId}` | int | Счётчик | 60 сек | Auto-expire |

**Правила:**
- При генерации нового кода: `DEL code:{userId}` → `SET code:{userId} {code} EX 300`
- При регистрации через Telegram deep-link: бот добавляет `telegramChatId` в `pending_reg:{userId}` через `GET` → JSON.parse → добавить поле → `SET` с оставшимся TTL
- **Graceful degradation:** если Redis недоступен — auth endpoints возвращают `503`, но публичные CV страницы продолжают работать (прямой запрос в БД)

---

## 3. Регистрация (Signup) — двухэтапная

### Этап 1: `/api/auth/signup/init` (POST)

**Входные данные (Zod):**
```ts
z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/),
  password: z.string().min(8).regex(/(?=.*[a-zA-Z])(?=.*[0-9])/),
  authMethod: z.enum(["EMAIL", "TELEGRAM"]),
  contact: z.string(), // email или telegram username (без @)
})
```

**Логика:**
1. Zod валидация
2. `prisma.user.findFirst({ where: { OR: [{ username }, { email: contact }] } })` — проверка уникальности
3. `userId = randomUUID()`
4. `passwordHash = await bcrypt.hash(password, 10)`
5. Сохранить в Redis: `SET pending_reg:{userId} {JSON} EX 900`
6. **Fire-and-forget** (не ждать!):
   - EMAIL: сгенерировать код → `SET code:{userId} {code} EX 300` → отправить Nodemailer
   - TELEGRAM: вернуть deep-link `t.me/{BOT_USERNAME}?start=reg_{userId}` (код генерирует бот)
7. Вернуть немедленно: `{ pendingId: userId, expiresIn: 900, method: "EMAIL" | "DEEPLINK" }`

### Этап 2: `/api/auth/signup/verify` (POST)

**Входные данные:**
```ts
z.object({ pendingId: z.string().uuid(), code: z.string().length(4) })
```

**Логика:**
1. `GET code:{pendingId}` из Redis — если нет → `{ error: "CODE_EXPIRED" }`
2. Сравнить код — если не совпадает → `{ error: "INVALID_CODE" }`
3. `GET pending_reg:{pendingId}` — получить данные
4. `prisma.$transaction`:
   - `prisma.user.create({ data: { id: pendingId, ...data, isVerified: true, verifiedAt: new Date() } })`
   - `prisma.portfolio.create({ data: { title: username, slug: username, userId: pendingId } })` — создать дефолтный портфолио
5. Redis cleanup: `DEL code:{pendingId}`, `DEL pending_reg:{pendingId}`
6. Вернуть `{ success: true }` — клиент вызывает `signIn()` из NextAuth

---

## 4. Telegram Bot (grammy) — обработчики

```typescript
// bot.ts
import { Bot } from "grammy"

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

bot.command("start", async (ctx) => {
  const payload = ctx.match // всё после /start

  if (payload?.startsWith("reg_")) {
    const pendingId = payload.slice(4)
    const raw = await redis.get<string>(`pending_reg:${pendingId}`)
    if (!raw) return ctx.reply("Ссылка устарела. Зарегистрируйтесь заново.")

    const data = JSON.parse(raw)
    const code = String(Math.floor(1000 + Math.random() * 9000))
    const ttl = await redis.ttl(`pending_reg:${pendingId}`)

    // Сохранить код и обновить chatId в pending_reg
    await redis.del(`code:${pendingId}`)
    await redis.set(`code:${pendingId}`, code, { ex: 300 })
    await redis.set(`pending_reg:${pendingId}`, JSON.stringify({
      ...data,
      telegramChatId: ctx.chat.id
    }), { ex: Math.max(ttl, 1) })

    await ctx.reply(`Ваш код подтверждения: *${code}*\nДействителен 5 минут.`, { parse_mode: "Markdown" })

  } else if (payload?.startsWith("reset_")) {
    const resetToken = payload.slice(6)
    const raw = await redis.get<string>(`reset_token:${resetToken}`)
    if (!raw) return ctx.reply("Ссылка устарела. Запросите сброс пароля заново.")

    const { code } = JSON.parse(raw)
    await ctx.reply(`Ваш код сброса пароля: *${code}*\nДействителен 10 минут.`, { parse_mode: "Markdown" })

  } else {
    await ctx.reply("Привет! Я бот платформы CV. Используйте ссылку с сайта для верификации.")
  }
})

// Вебхук: POST /api/telegram
export { bot }
```

---

## 5. NextAuth (JWT strategy)

```typescript
// app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 дней
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  providers: [
    CredentialsProvider({
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { username: credentials!.username },
        })
        if (!user) throw new Error("INVALID_CREDENTIALS")
        const valid = await bcrypt.compare(credentials!.password, user.passwordHash)
        if (!valid) throw new Error("INVALID_CREDENTIALS")
        if (!user.isVerified) throw new Error("VERIFICATION_REQUIRED")
        return { id: user.id, username: user.username, email: user.email }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id
        token.username = (user as any).username
        // Записываем updatedAt при первом входе
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
        token.passwordUpdatedAt = dbUser!.updatedAt.getTime()
      }
      // Проверка инвалидации при каждом запросе токена
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { updatedAt: true },
        })
        if (dbUser && dbUser.updatedAt.getTime() > (token.passwordUpdatedAt as number)) {
          throw new Error("SESSION_INVALIDATED") // разлогинит пользователя
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string
        session.user.username = token.username as string
      }
      return session
    },
  },
}
```

---

## 6. Восстановление пароля

### `/api/auth/forgot` (POST)
```ts
// Защита от user enumeration:
// 1. Искусственная задержка 1500ms независимо от результата
// 2. Всегда возвращает одинаковый ответ
async function handleForgot(username: string) {
  await new Promise(r => setTimeout(r, 1500)) // timing attack protection

  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] }
  })

  if (user && (user.email || user.telegramId)) {
    const resetToken = randomUUID()
    const code = String(Math.floor(1000 + Math.random() * 9000))

    await redis.set(`reset_token:${resetToken}`, JSON.stringify({ userId: user.id, code }), { ex: 600 })

    // Fire-and-forget отправка
    if (user.authMethod === "EMAIL" && user.email) {
      sendResetEmail(user.email, code).catch(console.error)
    } else if (user.telegramId) {
      sendTelegramReset(user.telegramId, resetToken).catch(console.error)
      // Для Telegram возвращаем deep-link в ответе (т.к. не знаем chatId)
    }
  }

  return { message: "Если аккаунт существует, инструкции отправлены" }
}
```

### `/api/auth/reset` (POST)
```ts
z.object({
  resetToken: z.string().uuid(),
  code: z.string().length(4),
  newPassword: z.string().min(8).regex(/(?=.*[a-zA-Z])(?=.*[0-9])/),
})
// 1. GET reset_token:{resetToken} → проверить code
// 2. bcrypt.hash(newPassword, 10)
// 3. prisma.user.update({ where: { id }, data: { passwordHash, updatedAt: new Date() } })
//    updatedAt обновляется → все JWT становятся невалидными (см. jwt callback)
// 4. DEL reset_token:{resetToken}
```

---

## 7. tRPC Router (полный список процедур)

### portfolioRouter
| Процедура | Тип | Авторизация | Описание |
|-----------|-----|------------|---------|
| `bySlug` | query | public | Получить портфолио по slug. Сначала Redis `cv:{slug}`, иначе DB + кеш 5 мин |
| `getAll` | query | protected | Список портфолио текущего пользователя |
| `create` | mutation | protected | Создать новое портфолио (slug = username + порядковый номер) |
| `updateMeta` | mutation | protected | Обновить title, slug. Очистить кеш старого и нового slug |
| `updateFull` | mutation | protected | Полное обновление структуры (секции + items + fieldsJson). Zod валидация. Очистить `cv:{slug}` |
| `publish` | mutation | protected | Установить `isPublished = true`, `publishedAt = now()`. Очистить кеш |
| `unpublish` | mutation | protected | Снять публикацию. Очистить кеш |
| `delete` | mutation | protected | Удалить портфолио. Очистить кеш |
| `incrementView` | mutation | public | `INCR cv_view:{slug}` в Redis |
| `getPresignedUrl` | mutation | protected | Получить presigned URL от Supabase Storage для загрузки изображения |

### userRouter
| Процедура | Тип | Авторизация | Описание |
|-----------|-----|------------|---------|
| `me` | query | protected | Получить данные текущего пользователя |
| `updateProfile` | mutation | protected | Изменить email/telegramUsername |
| `changePassword` | mutation | protected | Старый пароль → новый. Обновляет `updatedAt` → инвалидирует сессии |

---

## 8. Rate Limiting (middleware)

Применяется в tRPC middleware и в API route handlers:

```typescript
// lib/ratelimit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "./redis"

export const rateLimiters = {
  signup: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "60 s") }),
  verify: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "60 s") }),
  forgot: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, "60 s") }),
  portfolio: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s") }),
  public: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "60 s") }),
}

// Использование:
const { success, reset } = await rateLimiters.signup.limit(`ip:${ip}`)
if (!success) {
  return Response.json({ error: "TOO_MANY_REQUESTS" }, {
    status: 429,
    headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) }
  })
}
```

---

## 9. CV Editor — архитектура клиентской части

### Структура данных в редакторе
```typescript
type EditorSection = {
  id: string
  tempId?: string  // для новых несохранённых секций
  title: string
  order: number
  items: EditorItem[]
}

type EditorItem = {
  id: string
  tempId?: string
  order: number
  fieldsJson: Record<string, string | null>
}
```

### Оптимистичные обновления (React Query)
```typescript
const updateFull = trpc.portfolio.updateFull.useMutation({
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: [["portfolio", "bySlug"], slug] })
    const previous = queryClient.getQueryData([["portfolio", "bySlug"], slug])
    queryClient.setQueryData([["portfolio", "bySlug"], slug], newData)
    return { previous }
  },
  onError: (_, __, context) => {
    queryClient.setQueryData([["portfolio", "bySlug"], slug], context?.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: [["portfolio", "bySlug"], slug] })
  },
})
```

### Автосохранение с debounce
```typescript
const debouncedSave = useDebouncedCallback((data) => {
  updateFull.mutate(data)
}, 1000)

// При любом изменении структуры:
useEffect(() => {
  debouncedSave(editorState)
}, [editorState])
```

---

## 10. Публичные страницы (`/[username]`)

```typescript
// app/[username]/page.tsx — Server Component
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const portfolio = await getPortfolioBySlug(params.username)
  return {
    title: portfolio?.title ?? "CV Not Found",
    openGraph: {
      images: [`/api/og?slug=${params.username}`],
    },
  }
}

export default async function PublicCVPage({ params }: Props) {
  const portfolio = await getPortfolioBySlug(params.username) // Redis → DB
  if (!portfolio || !portfolio.isPublished) notFound()
  // Increment view count (fire-and-forget)
  incrementViewCount(params.username)
  return <CVRenderer portfolio={portfolio} />
}
```

---

## 11. Cron Jobs

### Синхронизация просмотров (каждый час)
```typescript
// app/api/cron/sync-views/route.ts
// Защищён заголовком CRON_SECRET

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 })

  const keys = await redis.keys("cv_view:*")

  for (const key of keys) {
    const slug = key.replace("cv_view:", "")
    const views = await redis.getdel(key) as number | null
    if (views && views > 0) {
      await prisma.portfolio.update({
        where: { slug },
        data: { viewCount: { increment: views } }
      })
    }
  }

  return Response.json({ synced: keys.length })
}
```

**vercel.json:**
```json
{
  "crons": [{ "path": "/api/cron/sync-views", "schedule": "0 * * * *" }]
}
```

---

## 12. Переменные окружения (`.env`)

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/cv_platform"
SHADOW_DATABASE_URL="postgresql://user:pass@host:5432/cv_platform_shadow"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://your-domain.com"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Telegram
TELEGRAM_BOT_TOKEN="BOT_TOKEN=8099120171:AAH84AMoX1MFjy7_pMxqJ0E2X83n7RP1Y_0" // это настоящий действующий!
TELEGRAM_BOT_USERNAME="cv_azizbot" // это настоящий действующий!
TELEGRAM_WEBHOOK_SECRET="random-secret"

# Email (SMTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_SECURE="false"
EMAIL_USER="your@gmail.com"
EMAIL_PASSWORD="app-password"
EMAIL_FROM="CV Platform <noreply@yourdomain.com>"

# Supabase
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_KEY="..."
SUPABASE_BUCKET="cv-media"

# Sentry
SENTRY_DSN="https://..."

# Cron
CRON_SECRET="random-secret-for-cron"
```

---

## 13. Структура файлов

```
cv-platform/
├── app/
│   ├── layout.tsx              # Root layout с providers
│   ├── page.tsx                # Landing page
│   ├── [username]/
│   │   └── page.tsx            # Публичное CV
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout (protected)
│   │   ├── page.tsx            # Список портфолио
│   │   └── [portfolioId]/
│   │       └── page.tsx        # CV Editor
│   ├── auth/
│   │   ├── signin/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── verify/page.tsx     # Ввод кода + опрос статуса
│   │   └── forgot-password/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/route.ts
│       │   ├── signup/
│       │   │   ├── init/route.ts
│       │   │   └── verify/route.ts
│       │   ├── forgot/route.ts
│       │   ├── reset/route.ts
│       │   └── resend-code/route.ts
│       ├── telegram/route.ts   # Telegram webhook
│       ├── og/route.tsx        # OG Image generation
│       └── trpc/[trpc]/route.ts
├── components/
│   ├── ui/                     # Button, Input, Card, Badge, etc.
│   ├── auth/                   # SignInForm, SignUpForm, etc.
│   └── editor/                 # CVEditor, SectionBlock, ItemEditor
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── redis.ts                # Upstash Redis client
│   ├── ratelimit.ts            # Rate limiters
│   ├── auth.ts                 # authOptions
│   ├── email.ts                # Nodemailer sender
│   ├── telegram.ts             # Bot instance
│   ├── trpc.ts                 # tRPC init
│   └── logger.ts               # Pino instance
├── server/
│   ├── routers/
│   │   ├── portfolio.ts
│   │   └── user.ts
│   └── trpc.ts                 # Context + middleware
├── prisma/
│   └── schema.prisma
├── types/
│   └── next-auth.d.ts          # Extend Session type
├── .env
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 14. Non-Goals (v1)

- Live collaboration (несколько авторов на один CV)
- PDF export (в v2)
- OAuth (Google/GitHub/LinkedIn)
- TOTP 2FA после входа
- Full-text поиск по CV
- Кастомные домены

---

## 15. Security Checklist

- [x] bcrypt cost=10 (не MD5/SHA)
- [x] Все временные данные в Redis с TTL (не в БД)
- [x] Искусственная задержка на `/forgot` (timing protection)
- [x] Одинаковый ответ на `/forgot` независимо от наличия пользователя (enumeration protection)
- [x] Rate limiting на все auth endpoints
- [x] JWT инвалидация через `user.updatedAt`
- [x] CSRF защита через NextAuth встроенную
- [x] Webhook secret для Telegram бота
- [x] Cron endpoints защищены Bearer токеном
- [x] Presigned URLs для загрузки медиа (без прямого доступа к ключам Supabase)
- [x] Zod валидация на всех endpoint входах


# Установить зависимости
npm install

# Скопировать и заполнить .env
cp .env

# Создать таблицы в БД
npx prisma db push

# Запустить
npm run dev