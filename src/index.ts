import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte, lt } from 'drizzle-orm';
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authApp } from './auth/auth'
import { Ai } from '@cloudflare/ai'

import { WorkoutRoutine, CardioRoutine, UsersMeasurements } from './db/schema';

// Define the Cloudflare Worker environment bindings
type Bindings = {
  DB: D1Database;
  AI: Ai;
}

export interface Env {
  AI:Ai;
}

type Variables = {
  db: ReturnType<typeof drizzle>
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Middleware to initialize Drizzle with D1 not pstgres
app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB)
  c.set('db', db)
  await next()
})

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}))

app.use(logger())

app.get('/', (c) => {
  return c.text('Gymapp Online')
})

app.route('/auth', authApp)

app.post('/addWorkoutRoutine', async (c) => {
  const { user, activity, sets, reps, weight } = await c.req.json();
  
const AIgen = async () => {
    const airesponse = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast" as any, {
      prompt: `As a gym guru look at the workout I just did, and give me a good next exercise with some suggestions and motivational speech. Activity: ${activity}, Sets: ${sets}, Reps: ${reps}, Weight: ${weight} the response should be short less than a few lines as will be used in a toast pop up`,
    });
    return airesponse;
  }

  try {
    const newWorkout = await c.get('db').insert(WorkoutRoutine).values({
      user: user.username,
      activity: activity,
      sets: sets,
      reps: reps,
      weight: weight,
    }).returning();
    
    console.log(newWorkout);
    
    const airesponse = await AIgen(); 
    console.log(airesponse)
    
    return c.json({
      message: 'workout added',
      aimessage: airesponse, 
      data: newWorkout[0].id
    }, 200);
  }
  catch (error) {
    console.error('Failed to add workout', error);
    return c.json({ error: 'Failed to add workouts'}, 500);
  }
});

app.post('/AllWorkoutRoutines', async (c) => {
  const { user } = await c.req.json();
  try {
    const Workouts = await c.get('db').select().from(WorkoutRoutine)
      .where(eq(WorkoutRoutine.user, user.username))
      .execute();

    if(!Workouts || Workouts.length === 0 ) {
      return c.json({error: 'No Workouts Found'}, 404)
    }
    return c.json({
      message: 'Workouts Found',
      data: Workouts
    })
  }
  catch (error) {
    return c.json({ error: 'Failed to find workouts'}, 500)
  }
})

app.post('/WorkoutRoutinestoday', async (c) => {
  const { user } = await c.req.json();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(todayStr)
  try {
    const Workouts = await c.get('db').select().from(WorkoutRoutine)
      .where(
        and(
          eq(WorkoutRoutine.user, user.username),
          eq(WorkoutRoutine.loggedDate, todayStr)
        )
      )
      .execute();

    if(!Workouts || Workouts.length === 0) {
      return c.json({error: 'No Workouts Found'}, 404)
    }
    return c.json({
      message: 'Workouts Found',
      data: Workouts,
      date: todayStr
    })
  }
  catch (error) {
    console.error('Error finding workouts:', error);
    return c.json({ error: 'Failed to find workouts'}, 500)
  }
})

app.post('/addCardioRoutine', async (c) => {
  const { user, activity, time, distance } = await c.req.json();
  try {
    const newWorkout = await c.get('db').insert(CardioRoutine).values({
      user: user.username,
      activity: activity,
      time: time,
      distance: distance,
    }).returning();
    console.log(newWorkout)

    return c.json({
      message: 'workout added',
      data: newWorkout[0].id
    }, 200)
  }
  catch (error) {
    console.error('Failed to add workout', error);
    return c.json({ error: 'Failed to add workouts'}, 500)
  }
})

app.post('/CardioRoutine', async (c) => {
  const { user } = await c.req.json();
  console.log(user)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(todayStr)
  try {
    const Workouts = await c.get('db').select().from(CardioRoutine)
      .where(
        and(
          eq(CardioRoutine.user, user.username),
          eq(CardioRoutine.loggedDate, todayStr)
        )
      )
      .execute();

    if(!Workouts || Workouts.length === 0) {
      return c.json({error: 'No Workouts Found'}, 404)
    }
    return c.json({
      message: 'Workouts Found',
      data: Workouts,
      date: todayStr
    })
  }
  catch (error) {
    console.error('Error finding workouts:', error);
    return c.json({ error: 'Failed to find workouts'}, 500)
  }
})

app.post('/UsersMeasurements', async (c) => {
  const { user } = await c.req.json();
  console.log(user)
  try {
    const Workouts = await c.get('db').select().from(UsersMeasurements)
      .where(
        and(
          eq(UsersMeasurements.user, user.username),
        )
      )
      .execute();

    if(!Workouts || Workouts.length === 0) {
      return c.json({error: 'No Workouts Found'}, 404)
    }
    return c.json({
      message: 'MeasurementsFound',
      data: Workouts,
    })
  }
  catch (error) {
    console.error('Error finding workouts:', error);
    return c.json({ error: 'Failed to find workouts'}, 500)
  }
})

app.post('/addUsersMeasurements', async (c) => {
  const { user, height, weight, weightgoal, arms, thighs, waist, hips } = await c.req.json();
  try {
    const newWorkout = await c.get('db').insert(UsersMeasurements).values({
      user: user.username,
      height: height,
      weights: weight,
      weightsgoal: weightgoal,
      measurearms: arms,
      measurethighs: thighs,
      measurewaist: waist, 
      measurehips: hips,
    }).returning();
    console.log(newWorkout)

    return c.json({
      message: 'measurements added',
      data: newWorkout[0].id
    }, 200)
  }
  catch (error) {
    console.error('Failed to add measurements', error);
    return c.json({ error: 'Failed to add measurements'}, 500)
  }
})

export default {
  port: 3001,
  fetch: app.fetch,
}