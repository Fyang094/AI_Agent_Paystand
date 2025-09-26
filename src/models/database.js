import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/schedule.db');
    
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
    console.log('Database initialized successfully');
  }

  async createTables() {
    // User preferences and profile
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        wake_time TEXT,
        sleep_time TEXT,
        breakfast_time TEXT,
        lunch_time TEXT,
        dinner_time TEXT,
        cook_time_minutes INTEGER DEFAULT 30,
        shower_preference TEXT CHECK(shower_preference IN ('morning', 'night', 'both')) DEFAULT 'morning',
        personality_type TEXT CHECK(personality_type IN ('introvert', 'extrovert', 'ambivert')) DEFAULT 'ambivert',
        interests TEXT, -- JSON array of interests
        location TEXT,
        timezone TEXT DEFAULT 'UTC',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Calendar events and tasks
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        event_type TEXT CHECK(event_type IN ('class', 'assignment', 'exam', 'quiz', 'work', 'personal', 'meal', 'sleep', 'travel', 'event')) NOT NULL,
        priority INTEGER CHECK(priority BETWEEN 1 AND 5) DEFAULT 3,
        location TEXT,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern TEXT, -- JSON for recurring events
        is_completed BOOLEAN DEFAULT FALSE,
        completion_time DATETIME,
        source TEXT CHECK(source IN ('manual', 'google_calendar', 'apple_calendar', 'health', 'ai_generated')) DEFAULT 'manual',
        external_id TEXT, -- ID from external calendar
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Schedule adjustments and conflicts
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedule_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        event_id INTEGER,
        adjustment_type TEXT CHECK(adjustment_type IN ('delay', 'reschedule', 'cancel', 'complete_early', 'extend')) NOT NULL,
        original_time DATETIME,
        new_time DATETIME,
        reason TEXT,
        ai_suggested BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id)
      )
    `);

    // Daily reflections and feedback
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS daily_reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        date DATE NOT NULL,
        completed_tasks INTEGER DEFAULT 0,
        total_tasks INTEGER DEFAULT 0,
        productivity_score INTEGER CHECK(productivity_score BETWEEN 1 AND 10),
        energy_level INTEGER CHECK(energy_level BETWEEN 1 AND 10),
        stress_level INTEGER CHECK(stress_level BETWEEN 1 AND 10),
        notes TEXT,
        tomorrow_priorities TEXT, -- JSON array
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // AI interactions and learning
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        interaction_type TEXT CHECK(interaction_type IN ('question', 'suggestion', 'adjustment', 'reflection')) NOT NULL,
        question TEXT,
        response TEXT,
        context TEXT, -- JSON of current schedule state
        user_feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Special events and interests
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS special_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATETIME NOT NULL,
        location TEXT,
        event_type TEXT,
        source TEXT CHECK(source IN ('eventbrite', 'meetup', 'google_events', 'manual')) NOT NULL,
        external_url TEXT,
        is_interested BOOLEAN DEFAULT FALSE,
        is_attending BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getUserProfile(userId) {
    return await this.db.get('SELECT * FROM user_profile WHERE user_id = ?', [userId]);
  }

  async updateUserProfile(userId, profileData) {
    const fields = Object.keys(profileData);
    const values = Object.values(profileData);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    await this.db.run(
      `UPDATE user_profile SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      [...values, userId]
    );
  }

  async getEventsForDateRange(userId, startDate, endDate) {
    // Convert ISO dates to SQLite datetime format
    const startStr = startDate.toISOString().replace('T', ' ').replace('Z', '');
    const endStr = endDate.toISOString().replace('T', ' ').replace('Z', '');
    
    return await this.db.all(
      'SELECT * FROM events WHERE user_id = ? AND start_time >= ? AND start_time < ? ORDER BY start_time',
      [userId, startStr, endStr]
    );
  }

  async addEvent(eventData) {
    const fields = Object.keys(eventData);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(eventData);
    
    const result = await this.db.run(
      `INSERT INTO events (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return result.lastID;
  }

  async updateEvent(eventId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    
    await this.db.run(
      `UPDATE events SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, eventId]
    );
  }

  async addScheduleAdjustment(adjustmentData) {
    const fields = Object.keys(adjustmentData);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(adjustmentData);
    
    const result = await this.db.run(
      `INSERT INTO schedule_adjustments (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return result.lastID;
  }

  async addDailyReflection(reflectionData) {
    const fields = Object.keys(reflectionData);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(reflectionData);
    
    const result = await this.db.run(
      `INSERT INTO daily_reflections (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return result.lastID;
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

export default Database;
