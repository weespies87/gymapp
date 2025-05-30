// auth.ts
import { Hono } from 'hono'
import { jwt } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as jsonwebtoken from 'jsonwebtoken'
import { Users } from '../db/schema'

// Types for the environment and variables
type Bindings = {
  DB: any; // D1 database binding
  JWT_SECRET: string; // JWT secret from environment variables
}

type Variables = {
  db: ReturnType<typeof drizzle>
}

// Create auth app with proper typing
const authApp = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Password hashing functions using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hashedInput = await hashPassword(password)
  return hashedInput === hashedPassword
}

// Middleware to set database (gets DB from parent app's context)
authApp.use('*', async (c, next) => {
  // Check if we're in Cloudflare Workers environment
  if (c.env?.DB) {
    const db = drizzle(c.env.DB)
    c.set('db', db)
  } else {
    // For local development, you might want to use a different approach
    return c.json({ error: 'Database not available in local development. Use "npx wrangler dev" instead.' }, 500)
  }
  await next()
})

// Set up JWT middleware for protected routes
const createJwtMiddleware = () => {
  return async (c: any, next: any) => {
    return jwt({ secret: c.env.JWT_SECRET })(c, next)
  }
}

// Registration endpoint
authApp.post('/register', async (c) => {
  const { username, email, password } = await c.req.json()
  
  try {
    // Hash password using Web Crypto API
    const hashedPassword = await hashPassword(password)
    
    // Check if user already exists
    const existingUser = await c.get('db').select()
      .from(Users)
      .where(eq(Users.email, email))
      .limit(1)
    
    if (existingUser.length > 0) {
      return c.json({ error: 'User already exists' }, 400)
    }
    
    // Insert user into database
    const newUser = await c.get('db').insert(Users).values({
      username,
      email,
      password: hashedPassword
    }).returning({
      id: Users.id,
      username: Users.username,
      email: Users.email
    })
    
    return c.json({
      message: 'User registered successfully',
      user: newUser[0]
    }, 201)
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ error: 'Failed to register user' }, 500)
  }
})

// Login endpoint
authApp.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  
  try {
    // Check if JWT_SECRET is available
    if (!c.env?.JWT_SECRET) {
      return c.json({ error: 'JWT_SECRET not configured. Use "npx wrangler dev" for local development.' }, 500)
    }
    
    // Find user by email
    const users = await c.get('db').select()
      .from(Users)
      .where(eq(Users.email, email))
      .limit(1)
    
    const user = users[0]
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    // Check password using Web Crypto API
    const passwordMatch = await verifyPassword(password, user.password)
    if (!passwordMatch) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }
    
    // Generate JWT token
    const token = jsonwebtoken.sign(
      {
        userId: user.id,
        username: user.username,
      },
      c.env.JWT_SECRET,
      { expiresIn: '1h' }
    )
    
    // Return user data and token
    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Protected route example
authApp.get('/profile', async (c) => {
  // Manual JWT verification since we need access to c.env.JWT_SECRET
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401)
  }
  
  // Check if JWT_SECRET is available
  if (!c.env?.JWT_SECRET) {
    return c.json({ error: 'JWT_SECRET not configured. Use "npx wrangler dev" for local development.' }, 500)
  }
  
  const token = authHeader.substring(7)
  
  try {
    const payload = jsonwebtoken.verify(token, c.env.JWT_SECRET) as any
    const userId = payload.userId
    
    const users = await c.get('db').select({
      id: Users.id,
      username: Users.username,
      email: Users.email
    })
      .from(Users)
      .where(eq(Users.id, userId))
      .limit(1)
    
    const user = users[0]
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json(user)
  } catch (error) {
    console.error('Profile fetch error:', error)
    return c.json({ error: 'Invalid token or failed to fetch profile' }, 500)
  }
})

export { authApp }