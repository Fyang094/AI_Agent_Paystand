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

    // Health data routes
    this.app.get('/api/health/:userId', this.getHealthData.bind(this));
    this.app.post('/api/health/:userId/sync', this.syncHealthData.bind(this));

    // AI interaction routes
    this.app.post('/api/ai/:userId/questions', this.generateDailyQuestions.bind(this));
    this.app.post('/api/ai/:userId/reflection', this.generateReflection.bind(this));
    this.app.post('/api/ai/:userId/feedback', this.processFeedback.bind(this));

    // Notification routes
    this.app.get('/api/notifications/:userId', this.getNotifications.bind(this));
    this.app.post('/api/notifications/:userId/test', this.testNotification.bind(this));

    // Special events routes
    this.app.get('/api/events/search/:userId', this.searchSpecialEvents.bind(this));
    this.app.post('/api/events/interest/:userId', this.markEventInterest.bind(this));

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
      
      const optimization = await this.scheduleOptimizer.optimizeSchedule(userId, events, userProfile);
      
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
