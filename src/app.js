import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import services
import Database from './models/database.js';
import ScheduleOptimizer from './ai/scheduleOptimizer.js';
import CalendarService from './integrations/calendarService.js';
import HealthService from './integrations/healthService.js';
import NotificationService from './services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class ScheduleAgent {
  constructor() {
    this.app = express();
    this.db = new Database();
    this.scheduleOptimizer = new ScheduleOptimizer();
    this.calendarService = new CalendarService();
    this.healthService = new HealthService();
    this.notificationService = new NotificationService();
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // User profile routes
    this.app.get('/api/profile/:userId', this.getUserProfile.bind(this));
    this.app.put('/api/profile/:userId', this.updateUserProfile.bind(this));

    // Schedule routes
    this.app.get('/api/schedule/:userId/today', this.getTodaySchedule.bind(this));
    this.app.get('/api/schedule/:userId/week', this.getWeekSchedule.bind(this));
    this.app.get('/api/schedule/:userId/month', this.getMonthSchedule.bind(this));
    this.app.post('/api/schedule/:userId/optimize', this.optimizeSchedule.bind(this));
    this.app.post('/api/schedule/:userId/prioritize', this.prioritizeSchedule.bind(this));
    this.app.put('/api/schedule/:userId/adjust', this.adjustSchedule.bind(this));

    // Event routes
    this.app.get('/api/events/:userId', this.getEvents.bind(this));
    this.app.post('/api/events/:userId', this.createEvent.bind(this));
    this.app.put('/api/events/:eventId', this.updateEvent.bind(this));
    this.app.delete('/api/events/:eventId', this.deleteEvent.bind(this));
    this.app.post('/api/events/:eventId/complete', this.completeEvent.bind(this));
    this.app.post('/api/events/:eventId/snooze', this.snoozeEvent.bind(this));

    // Calendar integration routes
    this.app.post('/api/calendar/:userId/sync', this.syncCalendar.bind(this));
    this.app.get('/api/calendar/:userId/events', this.getCalendarEvents.bind(this));
    this.app.post('/api/calendar/:userId/import-ics', this.importIcsCalendar.bind(this));

    // Health data routes
    this.app.get('/api/health/:userId', this.getHealthData.bind(this));
    this.app.post('/api/health/:userId/sync', this.syncHealthData.bind(this));

    // AI interaction routes
    this.app.post('/api/ai/:userId/questions', this.generateDailyQuestions.bind(this));
    this.app.post('/api/ai/:userId/reflection', this.generateReflection.bind(this));
    this.app.post('/api/ai/:userId/feedback', this.processFeedback.bind(this));
    this.app.post('/api/ai/:userId/chat', this.chatWithAi.bind(this));

    // Notification routes
    this.app.get('/api/notifications/:userId', this.getNotifications.bind(this));
    this.app.post('/api/notifications/:userId/test', this.testNotification.bind(this));

    // Special events routes
    this.app.get('/api/events/search/:userId', this.searchSpecialEvents.bind(this));
    this.app.post('/api/events/interest/:userId', this.markEventInterest.bind(this));

    // Testing utilities
    this.app.post('/api/test/:userId/sample-schedule', this.createSampleSchedule.bind(this));
    this.app.post('/api/test/:userId/conflicts', this.createConflictingEvents.bind(this));

    // Serve the main application
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  // User Profile Endpoints
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const profile = await this.db.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: 'User profile not found' });
      }
      
      res.json(profile);
    } catch (error) {
      console.error('Error getting user profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const profileData = req.body;
      
      await this.db.updateUserProfile(userId, profileData);
      
      // Update wake-up and bedtime notifications
      if (profileData.wake_time) {
        this.notificationService.scheduleWakeUpNotification(profileData.wake_time);
      }
      if (profileData.sleep_time) {
        this.notificationService.scheduleEndOfDayReflection(profileData.sleep_time);
      }
      
      res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Schedule Endpoints
  async getTodaySchedule(req, res) {
    try {
      const { userId } = req.params;
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const events = await this.db.getEventsForDateRange(userId, startOfDay, endOfDay);
      
      // Get health data and adjust schedule
      const healthData = await this.healthService.syncHealthData(userId);
      const adjustedEvents = await this.healthService.adjustScheduleBasedOnHealth(userId, events, healthData?.activity);
      
      res.json({
        date: today.toISOString().split('T')[0],
        events: adjustedEvents,
        health_adjustments: healthData?.activity?.energy_level === 'low' ? 'Schedule adjusted for low energy' : null
      });
    } catch (error) {
      console.error('Error getting today schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getWeekSchedule(req, res) {
    try {
      const { userId } = req.params;
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0); // Set to start of day
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      endOfWeek.setHours(0, 0, 0, 0); // Set to start of day
      
      const events = await this.db.getEventsForDateRange(userId, startOfWeek, endOfWeek);
      
      res.json({
        start_date: startOfWeek.toISOString().split('T')[0],
        end_date: endOfWeek.toISOString().split('T')[0],
        events: events
      });
    } catch (error) {
      console.error('Error getting week schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMonthSchedule(req, res) {
    try {
      const { userId } = req.params;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      
      const events = await this.db.getEventsForDateRange(userId, startOfMonth, endOfMonth);
      
      res.json({
        month: startOfMonth.getMonth() + 1,
        year: startOfMonth.getFullYear(),
        events: events
      });
    } catch (error) {
      console.error('Error getting month schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async optimizeSchedule(req, res) {
    try {
      const { userId } = req.params;
      const { date } = req.body;
      
      const targetDate = date ? new Date(date) : new Date();
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
      
      const events = await this.db.getEventsForDateRange(userId, startOfDay, endOfDay);
      const userProfile = await this.db.getUserProfile(userId);
      const reflections = await this.db.getRecentReflections(userId, 7);
      const interactions = await this.db.getRecentInteractions(userId, 20);
      
      const optimization = await this.scheduleOptimizer.optimizeSchedule(userId, events, userProfile, { reflections, interactions });
      
      res.json(optimization);
    } catch (error) {
      console.error('Error optimizing schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async adjustSchedule(req, res) {
    try {
      const { userId } = req.params;
      const { adjustments } = req.body;
      
      for (const adjustment of adjustments) {
        await this.db.addScheduleAdjustment({
          user_id: userId,
          ...adjustment
        });
      }
      
      res.json({ success: true, message: 'Schedule adjustments recorded' });
    } catch (error) {
      console.error('Error adjusting schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async prioritizeSchedule(req, res) {
    try {
      const { userId } = req.params;
      const { startHour = 8, endHour = 22 } = req.body || {};

      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startHour, 0, 0, 0);
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHour, 0, 0, 0);

      // Load today's events
      const events = await this.db.getEventsForDateRange(userId, dayStart, new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
      if (!events || events.length === 0) {
        return res.json({ success: true, message: 'No events to reprioritize', updated: 0 });
      }

      // Separate fixed events (class, exam) from flexible ones
      const fixedTypes = new Set(['class', 'exam', 'quiz']);
      const fixed = events.filter(e => fixedTypes.has(e.event_type));
      const flexible = events.filter(e => !fixedTypes.has(e.event_type));

      // Sort flexible by priority asc, then original start time
      flexible.sort((a, b) => (a.priority - b.priority) || (new Date(a.start_time) - new Date(b.start_time)));

      // Build occupied blocks from fixed events
      const blocks = fixed.map(e => ({
        start: new Date(e.start_time).getTime(),
        end: new Date(e.end_time).getTime(),
      })).sort((a,b) => a.start - b.start);

      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayEnd.getTime();

      // Helper to find next free window of given duration
      function place(durationMs) {
        let cursor = dayStartMs;
        for (const b of blocks) {
          if (cursor + durationMs <= b.start) {
            const slotStart = cursor;
            const slotEnd = cursor + durationMs;
            // Reserve
            blocks.push({ start: slotStart, end: slotEnd });
            blocks.sort((x,y) => x.start - y.start);
            return { start: slotStart, end: slotEnd };
          }
          cursor = Math.max(cursor, b.end);
          if (cursor > dayEndMs) break;
        }
        // After last block
        if (cursor + durationMs <= dayEndMs) {
          const slotStart = cursor;
          const slotEnd = cursor + durationMs;
          blocks.push({ start: slotStart, end: slotEnd });
          blocks.sort((x,y) => x.start - y.start);
          return { start: slotStart, end: slotEnd };
        }
        return null;
      }

      let updatedCount = 0;
      for (const e of flexible) {
        const durationMs = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
        const slot = place(durationMs);
        if (slot) {
          const newStartIso = new Date(slot.start).toISOString().replace('Z','');
          const newEndIso = new Date(slot.end).toISOString().replace('Z','');
          await this.db.updateEvent(e.id, { start_time: newStartIso, end_time: newEndIso });
          // Reschedule notifications
          this.notificationService.cancelEventNotifications(e.id);
          await this.notificationService.scheduleEventNotifications([{ id: e.id, title: e.title, end_time: newEndIso, start_time: newStartIso }]);
          updatedCount++;
        }
      }

      res.json({ success: true, updated: updatedCount });
    } catch (error) {
      console.error('Error prioritizing schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Event Management Endpoints
  async getEvents(req, res) {
    try {
      const { userId } = req.params;
      const { start, end } = req.query;
      
      const startDate = start ? new Date(start) : new Date();
      const endDate = end ? new Date(end) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const events = await this.db.getEventsForDateRange(userId, startDate, endDate);
      res.json(events);
    } catch (error) {
      console.error('Error getting events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createEvent(req, res) {
    try {
      const { userId } = req.params;
      const eventData = { ...req.body, user_id: userId };
      
      const eventId = await this.db.addEvent(eventData);
      
      // Schedule notifications for the new event
      const newEvent = { id: eventId, ...eventData };
      await this.notificationService.scheduleEventNotifications([newEvent]);
      
      res.json({ success: true, event_id: eventId });
    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateEvent(req, res) {
    try {
      const { eventId } = req.params;
      const updateData = req.body;
      
      await this.db.updateEvent(eventId, updateData);
      
      // Reschedule notifications
      this.notificationService.cancelEventNotifications(eventId);
      const updatedEvent = { id: eventId, ...updateData };
      await this.notificationService.scheduleEventNotifications([updatedEvent]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteEvent(req, res) {
    try {
      const { eventId } = req.params;
      
      // Cancel notifications first
      this.notificationService.cancelEventNotifications(eventId);
      
      // Delete from database
      await this.db.run('DELETE FROM events WHERE id = ?', [eventId]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async completeEvent(req, res) {
    try {
      const { eventId } = req.params;
      
      await this.db.updateEvent(eventId, {
        is_completed: true,
        completion_time: new Date().toISOString()
      });
      
      // Cancel remaining notifications
      this.notificationService.cancelEventNotifications(eventId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async snoozeEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { minutes = 5 } = req.body;
      
      this.notificationService.snoozeEvent(eventId, minutes);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error snoozing event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // AI Interaction Endpoints
  async generateDailyQuestions(req, res) {
    try {
      const { userId } = req.params;
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const currentSchedule = await this.db.getEventsForDateRange(userId, startOfDay, endOfDay);
      const completedTasks = currentSchedule.filter(e => e.is_completed);
      
      const questions = await this.scheduleOptimizer.generateDailyQuestions(userId, currentSchedule, completedTasks);
      
      res.json({ questions });
    } catch (error) {
      console.error('Error generating questions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async generateReflection(req, res) {
    try {
      const { userId } = req.params;
      const { dailyData } = req.body;
      
      const insights = await this.scheduleOptimizer.generateReflectionInsights(userId, dailyData);
      
      // Store reflection in database
      await this.db.addDailyReflection({
        user_id: userId,
        date: new Date().toISOString().split('T')[0],
        completed_tasks: dailyData.completed_tasks || 0,
        total_tasks: dailyData.total_tasks || 0,
        productivity_score: insights.productivity_score,
        notes: JSON.stringify(insights),
        tomorrow_priorities: JSON.stringify(insights.tomorrow_recommendations)
      });
      
      res.json(insights);
    } catch (error) {
      console.error('Error generating reflection:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async processFeedback(req, res) {
    try {
      const { userId } = req.params;
      const { feedback, context } = req.body;
      
      await this.db.run(
        'INSERT INTO ai_interactions (user_id, interaction_type, response, context, user_feedback) VALUES (?, ?, ?, ?, ?)',
        [userId, 'feedback', 'User feedback received', JSON.stringify(context), feedback]
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error processing feedback:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async chatWithAi(req, res) {
    try {
      const { userId } = req.params;
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message required' });
      }
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({ error: 'OPENAI_API_KEY not set. Add it to your .env and restart.' });
      }

      // Determine requested range: day (default), week, or month based on message
      const now = new Date();
      let rangeLabel = 'today';
      let rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      const msgLower = (message || '').toLowerCase();
      if (msgLower.includes('this week') || msgLower.includes('week view') || msgLower.includes('week')) {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        rangeLabel = 'this week';
        rangeStart = startOfWeek;
        rangeEnd = endOfWeek;
      } else if (msgLower.includes('this month') || msgLower.includes('month view') || msgLower.includes('month')) {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);
        rangeLabel = 'this month';
        rangeStart = startOfMonth;
        rangeEnd = endOfMonth;
      }

      const events = await this.db.getEventsForDateRange(userId, rangeStart, rangeEnd);
      const reflections = await this.db.getRecentReflections(userId, 5);
      const interactions = await this.db.getRecentInteractions(userId, 10);

      const prompt = `You are an AI schedule assistant. The user says: "${message}". Consider ${rangeLabel}'s events (${rangeStart.toISOString()} to ${rangeEnd.toISOString()}): ${JSON.stringify(events)}. Recent reflections: ${JSON.stringify(reflections)}. Recent interactions: ${JSON.stringify(interactions)}. Provide a helpful, concise reply referencing patterns when useful.`;
      let reply;
      try {
        const completion = await this.scheduleOptimizer.openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful AI schedule assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5
        });
        reply = completion.choices?.[0]?.message?.content || 'I am here to help with your schedule!';
      } catch (apiError) {
        // Fallback: improved local Q&A from today's events
        const userMsg = (message || '').toLowerCase();
        const sorted = (events || []).slice().sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
        const fmt = (d) => new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const findByTitle = (q) => {
          const terms = q.split(/\s+/).filter(t => t.length > 2);
          let best = null, bestScore = 0;
          for (const e of sorted) {
            const title = (e.title||'').toLowerCase();
            let score = 0;
            terms.forEach(t => { if (title.includes(t)) score++; });
            if (score > bestScore) { best = e; bestScore = score; }
          }
          return bestScore > 0 ? best : null;
        };

        if (!sorted.length) {
          reply = 'No events found for today.';
        } else if (userMsg.includes('how many') || userMsg.includes('number of') || userMsg.includes('count')) {
          reply = `You have ${sorted.length} events today.`;
        } else if (userMsg.includes('first')) {
          reply = `Your first event is "${sorted[0].title}" at ${fmt(sorted[0].start_time)}.`;
        } else if (userMsg.includes('last')) {
          reply = `Your last event is "${sorted[sorted.length-1].title}" ending at ${fmt(sorted[sorted.length-1].end_time)}.`;
        } else if (userMsg.includes('what time') || userMsg.includes('when')) {
          const cleaned = userMsg.replace(/what time is|what time's|when is|when's|my|the/gi,'').trim();
          const match = findByTitle(cleaned);
          if (match) {
            reply = `"${match.title}" is from ${fmt(match.start_time)} to ${fmt(match.end_time)}.`;
          } else {
            reply = `You have ${sorted.length} events today. The first starts at ${fmt(sorted[0].start_time)}.`;
          }
        } else if (userMsg.includes('where')) {
          const cleaned = userMsg.replace(/where is|where's|my|the/gi,'').trim();
          const match = findByTitle(cleaned) || sorted[0];
          reply = match.location ? `"${match.title}" is at ${match.location}.` : `"${match.title}" has no location set.`;
        } else if (userMsg.includes('priority')) {
          const high = sorted.filter(e => e.priority === 1).map(e => e.title);
          reply = high.length ? `High priority today: ${high.join(', ')}.` : 'No high priority events today.';
        } else {
          reply = `You have ${sorted.length} events today. First: "${sorted[0].title}" at ${fmt(sorted[0].start_time)}.`;
        }
      }

      await this.db.addAiInteraction({
        user_id: userId,
        interaction_type: 'question',
        question: message,
        response: reply,
        context: JSON.stringify({ events })
      });

      res.json({ reply });
    } catch (error) {
      console.error('Error in chatWithAi:', error);
      if (error?.code === 'invalid_api_key' || error?.status === 401) {
        return res.status(400).json({ error: 'Invalid OpenAI API key. Update OPENAI_API_KEY and restart.' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Calendar Integration Endpoints
  async syncCalendar(req, res) {
    try {
      const { userId } = req.params;
      const startDate = new Date();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      const calendarEvents = await this.calendarService.syncCalendarEvents(userId, startDate, endDate);
      
      // Store events in database
      for (const event of calendarEvents) {
        await this.db.addEvent(event);
      }
      
      res.json({ success: true, synced_events: calendarEvents.length });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getCalendarEvents(req, res) {
    try {
      const { userId } = req.params;
      const { start, end } = req.query;
      
      const startDate = start ? new Date(start) : new Date();
      const endDate = end ? new Date(end) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const events = await this.calendarService.syncCalendarEvents(userId, startDate, endDate);
      res.json(events);
    } catch (error) {
      console.error('Error getting calendar events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async importIcsCalendar(req, res) {
    try {
      const { userId } = req.params;
      const { ics } = req.body;
      if (!ics || typeof ics !== 'string') {
        return res.status(400).json({ error: 'Missing ICS data' });
      }
      const parsed = await this.calendarService.parseICalendar(ics);
      let inserted = 0;
      for (const event of parsed) {
        const eventId = await this.db.addEvent({ ...event, user_id: userId });
        if (eventId) inserted++;
      }
      res.json({ success: true, imported_events: inserted });
    } catch (error) {
      console.error('Error importing ICS:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Health Data Endpoints
  async getHealthData(req, res) {
    try {
      const { userId } = req.params;
      const healthData = await this.healthService.syncHealthData(userId);
      res.json(healthData);
    } catch (error) {
      console.error('Error getting health data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async syncHealthData(req, res) {
    try {
      const { userId } = req.params;
      const healthData = await this.healthService.syncHealthData(userId);
      res.json({ success: true, data: healthData });
    } catch (error) {
      console.error('Error syncing health data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Notification Endpoints
  async getNotifications(req, res) {
    try {
      const { userId } = req.params;
      const notifications = this.notificationService.getScheduledNotifications();
      res.json(notifications);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async testNotification(req, res) {
    try {
      const { userId } = req.params;
      this.notificationService.sendImmediateNotification(
        'Test Notification',
        'This is a test notification from your AI Schedule Agent',
        'info'
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Special Events Endpoints
  async searchSpecialEvents(req, res) {
    try {
      const { userId } = req.params;
      const { interests, location } = req.query;
      
      // This would integrate with Eventbrite, Meetup, etc.
      // For now, return mock data
      const mockEvents = [
        {
          title: 'Tech Meetup',
          description: 'Weekly tech discussion',
          event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          location: 'Downtown',
          event_type: 'tech',
          source: 'meetup'
        }
      ];
      
      res.json(mockEvents);
    } catch (error) {
      console.error('Error searching events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async markEventInterest(req, res) {
    try {
      const { userId } = req.params;
      const { event_id, interested } = req.body;
      
      await this.db.run(
        'UPDATE special_events SET is_interested = ? WHERE id = ? AND user_id = ?',
        [interested, event_id, userId]
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking event interest:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Testing utilities
  async createSampleSchedule(req, res) {
    try {
      const { userId } = req.params;
      const today = new Date();
      const dayStr = today.toISOString().split('T')[0];
      const sample = [
        { title: 'Sample Class', description: 'Intro to AI', start_time: `${dayStr} 09:00:00`, end_time: `${dayStr} 10:15:00`, event_type: 'class', priority: 2, location: 'Room 101', source: 'ai_generated' },
        { title: 'Lunch', description: 'Healthy meal', start_time: `${dayStr} 12:00:00`, end_time: `${dayStr} 12:45:00`, event_type: 'meal', priority: 3, location: 'Cafeteria', source: 'ai_generated' },
        { title: 'Study Session', description: 'Review notes', start_time: `${dayStr} 14:00:00`, end_time: `${dayStr} 16:00:00`, event_type: 'assignment', priority: 2, location: 'Library', source: 'ai_generated' }
      ];
      for (const e of sample) {
        await this.db.addEvent({ ...e, user_id: userId });
      }
      res.json({ success: true, created: sample.length });
    } catch (error) {
      console.error('Error creating sample schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createConflictingEvents(req, res) {
    try {
      const { userId } = req.params;
      const today = new Date();
      const dayStr = today.toISOString().split('T')[0];
      const conflicts = [
        { title: 'Overlap A', start_time: `${dayStr} 10:00:00`, end_time: `${dayStr} 11:00:00`, event_type: 'work', priority: 2 },
        { title: 'Overlap B', start_time: `${dayStr} 10:30:00`, end_time: `${dayStr} 11:30:00`, event_type: 'work', priority: 2 }
      ];
      for (const e of conflicts) {
        await this.db.addEvent({ ...e, user_id: userId, description: '', location: '', source: 'ai_generated' });
      }
      res.json({ success: true, created: conflicts.length });
    } catch (error) {
      console.error('Error creating conflicts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async start() {
    try {
      // Initialize database
      await this.db.initialize();
      
      // Initialize services
      await this.calendarService.initializeGoogleCalendar();
      await this.healthService.initializeHealthAPIs();
      
      const port = process.env.PORT || 3000;
      this.app.listen(port, () => {
        console.log(`AI Schedule Agent running on port ${port}`);
        console.log(`Open http://localhost:${port} to view the application`);
      });
    } catch (error) {
      console.error('Error starting application:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      this.notificationService.destroy();
      await this.db.close();
      console.log('Application stopped gracefully');
    } catch (error) {
      console.error('Error stopping application:', error);
    }
  }
}

export default ScheduleAgent;
