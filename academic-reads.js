// AcademicReads - Main Application File
// This is a Next.js application using App Router, Prisma ORM, and NextAuth.js

// package.json dependencies to install:
// {
//   "dependencies": {
//     "@prisma/client": "^5.10.0",
//     "@vercel/postgres": "^0.7.2",
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

// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
  providers: [
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
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }

// src/app/auth/signin/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SignIn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid credentials')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Sign In</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-500">{error}</p>
        )}
        <div>
          <label className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Sign In
        </button>
      </form>
    </div>
  )
}

// src/app/auth/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Register() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      if (res.ok) {
        router.push('/auth/signin')
      } else {
        const data = await res.json()
        setError(data.error || 'An error occurred')
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Register</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-red-500">{error}</p>
        )}
        <div>
          <label className="block text-sm font-medium mb-2">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Register
        </button>
      </form>
    </div>
  )
}

// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const body = registerSchema.parse(json)

    const existingUser = await prisma.user.findUnique({
      where: { email: body.email }
    })

    if (existingUser) {
      return new NextResponse(
        JSON.stringify({ error: 'Email already exists' }),
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(body.password, 12)

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        hashedPassword,
      },
    })

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid request data' }),
        { status: 422 }
      )
    }
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}

// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}

model User {
  id             String    @id @default(cuid())
  name           String?
  email          String?   @unique
  hashedPassword String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  papers         Paper[]
  reviews        Review[]
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
