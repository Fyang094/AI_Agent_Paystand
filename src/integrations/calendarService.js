import { google } from 'googleapis';
import ical from 'node-ical';
import moment from 'moment';

class CalendarService {
  constructor() {
    this.googleAuth = null;
    this.calendar = null;
  }

  async initializeGoogleCalendar() {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // In a real app, you'd store and retrieve tokens from database
      // For now, we'll use a service account or manual token setup
      this.googleAuth = oauth2Client;
      this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      
      console.log('Google Calendar service initialized');
      return true;
    } catch (error) {
      console.error('Error initializing Google Calendar:', error);
      return false;
    }
  }

  async getGoogleCalendarEvents(userId, startDate, endDate) {
    try {
      if (!this.calendar) {
        await this.initializeGoogleCalendar();
      }

      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      return events.map(event => ({
        external_id: event.id,
        title: event.summary || 'No Title',
        description: event.description || '',
        start_time: event.start.dateTime || event.start.date,
        end_time: event.end.dateTime || event.end.date,
        location: event.location || '',
        event_type: this.categorizeEvent(event),
        priority: this.determinePriority(event),
        source: 'google_calendar',
        is_recurring: !!event.recurrence,
        recurrence_pattern: event.recurrence ? JSON.stringify(event.recurrence) : null,
        user_id: userId
      }));
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      return [];
    }
  }

  categorizeEvent(event) {
    const title = (event.summary || '').toLowerCase();
    const description = (event.description || '').toLowerCase();
    
    if (title.includes('class') || title.includes('lecture') || title.includes('course')) {
      return 'class';
    } else if (title.includes('exam') || title.includes('test') || title.includes('quiz')) {
      return 'exam';
    } else if (title.includes('assignment') || title.includes('homework') || title.includes('project')) {
      return 'assignment';
    } else if (title.includes('work') || title.includes('meeting') || title.includes('conference')) {
      return 'work';
    } else if (title.includes('meal') || title.includes('lunch') || title.includes('dinner') || title.includes('breakfast')) {
      return 'meal';
    } else if (title.includes('sleep') || title.includes('bedtime')) {
      return 'sleep';
    } else {
      return 'personal';
    }
  }

  determinePriority(event) {
    const title = (event.summary || '').toLowerCase();
    
    // High priority keywords
    if (title.includes('urgent') || title.includes('deadline') || title.includes('exam')) {
      return 1;
    }
    // Medium-high priority
    if (title.includes('important') || title.includes('meeting') || title.includes('class')) {
      return 2;
    }
    // Medium priority
    if (title.includes('work') || title.includes('assignment')) {
      return 3;
    }
    // Low priority
    return 4;
  }

  async parseICalendar(icalData) {
    try {
      const events = ical.parseICS(icalData);
      const parsedEvents = [];

      for (let eventId in events) {
        const event = events[eventId];
        
        if (event.type === 'VEVENT') {
          parsedEvents.push({
            external_id: event.uid,
            title: event.summary || 'No Title',
            description: event.description || '',
            start_time: event.start ? event.start.toISOString() : null,
            end_time: event.end ? event.end.toISOString() : null,
            location: event.location || '',
            event_type: this.categorizeEvent({ summary: event.summary, description: event.description }),
            priority: this.determinePriority({ summary: event.summary }),
            source: 'apple_calendar',
            is_recurring: !!event.rrule,
            recurrence_pattern: event.rrule ? JSON.stringify(event.rrule) : null
          });
        }
      }

      return parsedEvents;
    } catch (error) {
      console.error('Error parsing iCalendar data:', error);
      return [];
    }
  }

  async syncCalendarEvents(userId, startDate, endDate) {
    const events = [];
    
    // Sync Google Calendar
    try {
      const googleEvents = await this.getGoogleCalendarEvents(userId, startDate, endDate);
      events.push(...googleEvents);
    } catch (error) {
      console.error('Failed to sync Google Calendar:', error);
    }

    // Sync Apple Calendar (would need iCloud integration)
    // This is a placeholder for Apple Calendar integration
    // In a real implementation, you'd use iCloud APIs or require users to export their calendar

    return events;
  }

  async createEvent(userId, eventData) {
    try {
      if (!this.calendar) {
        await this.initializeGoogleCalendar();
      }

      const googleEvent = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.start_time,
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.end_time,
          timeZone: 'UTC',
        },
        location: eventData.location,
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: googleEvent,
      });

      return {
        ...eventData,
        external_id: response.data.id,
        source: 'google_calendar'
      };
    } catch (error) {
      console.error('Error creating Google Calendar event:', error);
      throw error;
    }
  }

  async updateEvent(eventId, eventData) {
    try {
      if (!this.calendar) {
        await this.initializeGoogleCalendar();
      }

      const googleEvent = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.start_time,
          timeZone: 'UTC',
        },
        end: {
          dateTime: eventData.end_time,
          timeZone: 'UTC',
        },
        location: eventData.location,
      };

      await this.calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        resource: googleEvent,
      });

      return true;
    } catch (error) {
      console.error('Error updating Google Calendar event:', error);
      return false;
    }
  }

  async deleteEvent(eventId) {
    try {
      if (!this.calendar) {
        await this.initializeGoogleCalendar();
      }

      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      return true;
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error);
      return false;
    }
  }

  // Helper method to detect schedule conflicts
  detectConflicts(events) {
    const conflicts = [];
    const sortedEvents = events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEvent = sortedEvents[i];
      const nextEvent = sortedEvents[i + 1];

      const currentEnd = moment(currentEvent.end_time);
      const nextStart = moment(nextEvent.start_time);

      // Check for time overlap
      if (currentEnd.isAfter(nextStart)) {
        conflicts.push({
          event1_id: currentEvent.id,
          event2_id: nextEvent.id,
          conflict_type: 'time_overlap',
          severity: 'high',
          description: `${currentEvent.title} overlaps with ${nextEvent.title}`
        });
      }

      // Check for insufficient travel time (less than 15 minutes)
      const travelTime = nextStart.diff(currentEnd, 'minutes');
      if (travelTime < 15 && travelTime > 0) {
        conflicts.push({
          event1_id: currentEvent.id,
          event2_id: nextEvent.id,
          conflict_type: 'insufficient_travel_time',
          severity: 'medium',
          description: `Only ${travelTime} minutes between ${currentEvent.title} and ${nextEvent.title}`
        });
      }
    }

    return conflicts;
  }
}

export default CalendarService;
