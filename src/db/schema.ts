import { is } from "drizzle-orm";
import { unique } from "drizzle-orm/gel-core";
import { int, sqliteTable, text ,real, integer,   } from "drizzle-orm/sqlite-core";
import { AlgorithmTypes } from "hono/utils/jwt/jwa";
import { sql } from "drizzle-orm";

export const WorkoutRoutine = sqliteTable("WorkoutRoutine", {
  id: integer().primaryKey(),
  user: text({ length: 255 }).notNull(),
  activity: text({ length: 255 }).notNull(),
  sets: integer().notNull(),
  reps: integer().notNull(),
  weight: integer().notNull(),
  loggedDate: text().default(sql`(CURRENT_DATE)`),
});

export const CardioRoutine = sqliteTable("CardioRoutine", {
  id: integer().primaryKey(),
  user: text({ length: 255 }).notNull(),
  activity: text({ length: 255 }).notNull(),
  distance: real().notNull(),
  time: text({ length: 255 }).notNull(),
  speed: real(),
  loggedDate: text().default(sql`(CURRENT_DATE)`),
});


export const Users = sqliteTable("GymAppUserLogin", {
  id: integer().primaryKey(),
  username: text({ length: 255 }).notNull(),
  password: text({ length: 255 }).notNull(),
  email: text({ length: 255 }).notNull(),
  created_at: text().default(sql`(CURRENT_DATE)`),
});


export const UsersMeasurements = sqliteTable("UserMeasurements", {
  id: integer().primaryKey(),
  user: text({ length: 255 }).notNull(),
  height: real().notNull(),
  weights: real().notNull(),
  weightsgoal: real().notNull(),
  measurearms:real().notNull(), 
  measurethighs:real().notNull(),
  measurewaist:real().notNull(),
  measurehips:real().notNull(),
  created_at: text().default(sql`(CURRENT_DATE)`),
});