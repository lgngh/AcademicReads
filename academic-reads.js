// AcademicReads - Main Application File
// This is a Next.js application using App Router, Prisma ORM, and NextAuth.js

// package.json dependencies to install:
// {
//   "dependencies": {
//     "@prisma/client": "^5.10.0",
//     "next": "^14.1.0",
//     "next-auth": "^4.24.5",
//     "react": "^18.2.0",
//     "react-dom": "^18.2.0",
//     "bcryptjs": "^2.4.3",
//     "zod": "^3.22.4"
//   },
//   "devDependencies": {
//     "prisma": "^5.10.0",
//     "typescript": "^5.3.3",
//     "@types/react": "^18.2.55",
//     "@types/node": "^20.11.17",
//     "@types/bcryptjs": "^2.4.6"
//   }
// }

// src/app/layout.tsx
import { Inter } from 'next/font/google'
import { getServerSession } from 'next-auth'
import SessionProvider from '@/components/SessionProvider'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()
  
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider session={session}>
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  )
}

// src/app/page.tsx
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import PaperCard from '@/components/PaperCard'

export default async function Home() {
  const papers = await prisma.paper.findMany({
    include: {
      reviews: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  })

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Recent Papers</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </div>
    </div>
  )
}

// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        if (!user || !user?.hashedPassword) {
          throw new Error('Invalid credentials')
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        )

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials')
        }

        return user
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }

// src/app/api/papers/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const paperSchema = z.object({
  title: z.string().min(1),
  abstract: z.string().min(1),
  authors: z.string().min(1),
  doi: z.string().optional(),
  publishedYear: z.number().min(1800).max(new Date().getFullYear()),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const json = await req.json()
    const body = paperSchema.parse(json)

    const paper = await prisma.paper.create({
      data: {
        ...body,
        userId: session.user.id,
      },
    })

    return NextResponse.json(paper)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request data', { status: 422 })
    }
    return new NextResponse('Internal error', { status: 500 })
  }
}

// src/app/api/papers/[paperId]/reviews/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reviewSchema = z.object({
  content: z.string().min(1),
  rating: z.number().min(1).max(5),
})

export async function POST(
  req: Request,
  { params }: { params: { paperId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const json = await req.json()
    const body = reviewSchema.parse(json)

    const review = await prisma.review.create({
      data: {
        ...body,
        paperId: params.paperId,
        userId: session.user.id,
      },
    })

    return NextResponse.json(review)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request data', { status: 422 })
    }
    return new NextResponse('Internal error', { status: 500 })
  }
}

// src/components/PaperCard.tsx
import Link from 'next/link'
import { Paper } from '@prisma/client'

interface PaperCardProps {
  paper: Paper & {
    reviews: Review[]
  }
}

export default function PaperCard({ paper }: PaperCardProps) {
  const averageRating = paper.reviews.reduce((acc, review) => acc + review.rating, 0) / paper.reviews.length

  return (
    <div className="border rounded-lg p-6 shadow-sm hover:shadow-md transition">
      <Link href={`/papers/${paper.id}`}>
        <h2 className="text-xl font-semibold mb-2">{paper.title}</h2>
      </Link>
      <p className="text-gray-600 mb-4">{paper.authors}</p>
      <p className="text-sm text-gray-500 mb-2">Published: {paper.publishedYear}</p>
      {paper.doi && (
        <a
          href={`https://doi.org/${paper.doi}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          DOI: {paper.doi}
        </a>
      )}
      <div className="mt-4 flex items-center">
        <span className="text-yellow-500">★</span>
        <span className="ml-1">{averageRating.toFixed(1)}</span>
        <span className="ml-2 text-gray-500">({paper.reviews.length} reviews)</span>
      </div>
    </div>
  )
}

// src/components/ReviewForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ReviewFormProps {
  paperId: string
}

export default function ReviewForm({ paperId }: ReviewFormProps) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [rating, setRating] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/papers/${paperId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          rating,
        }),
      })

      if (!res.ok) throw new Error('Failed to submit review')

      setContent('')
      setRating(5)
      router.refresh()
    } catch (error) {
      console.error('Error submitting review:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Rating
        </label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-full p-2 border rounded"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} stars
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Review
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full p-2 border rounded"
          rows={4}
          required
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  )
}

// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  emailVerified  DateTime?
  image          String?
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  papers         Paper[]
  reviews        Review[]
  accounts       Account[]
  sessions       Session[]
}

model Paper {
  id            String   @id @default(cuid())
  title         String
  abstract      String
  authors       String
  doi           String?
  publishedYear Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  reviews       Review[]
}

model Review {
  id        String   @id @default(cuid())
  content   String
  rating    Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  userId    String
  paperId   String
  user      User     @relation(fields: [userId], references: [id])
  paper     Paper    @relation(fields: [paperId], references: [id])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
