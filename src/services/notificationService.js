import cron from 'node-cron';
import notifier from 'node-notifier';
import moment from 'moment';

class NotificationService {
  constructor() {
    this.scheduledNotifications = new Map();
    this.activeAlarms = new Map();
  }

  async scheduleEventNotifications(events) {
    // Clear existing notifications
    this.clearAllNotifications();

    events.forEach(event => {
      if (event.is_completed) return;

      // Schedule 5-minute warning before event ends
      const endTime = moment(event.end_time);
      const warningTime = endTime.subtract(5, 'minutes');
      
      if (warningTime.isAfter(moment())) {
        this.scheduleNotification({
          id: `warning_${event.id}`,
          title: `${event.title} ending soon`,
          message: `5 minutes left for ${event.title}`,
          time: warningTime.toDate(),
          type: 'warning',
          event_id: event.id
        });
      }

      // Schedule event start notification
      const startTime = moment(event.start_time);
      if (startTime.isAfter(moment())) {
        this.scheduleNotification({
          id: `start_${event.id}`,
          title: `${event.title} starting`,
          message: `Time for ${event.title}`,
          time: startTime.toDate(),
          type: 'start',
          event_id: event.id
        });
      }
    });
  }

  scheduleNotification(notification) {
    const { id, title, message, time, type, event_id } = notification;
    
    const now = moment();
    const notificationTime = moment(time);
    
    if (notificationTime.isBefore(now)) {
      return; // Don't schedule past notifications
    }

    // Calculate delay in milliseconds
    const delay = notificationTime.diff(now);
    
    const timeoutId = setTimeout(() => {
      this.sendNotification(title, message, type, event_id);
      this.scheduledNotifications.delete(id);
    }, delay);

    this.scheduledNotifications.set(id, {
      timeoutId,
      notification,
      scheduled_for: notificationTime.format()
    });

    console.log(`Scheduled notification: ${title} at ${notificationTime.format()}`);
  }

  sendNotification(title, message, type = 'info', event_id = null) {
    // Desktop notification
    notifier.notify({
      title: title,
      message: message,
      icon: this.getNotificationIcon(type),
      sound: type === 'warning' || type === 'urgent',
      wait: true,
      timeout: 10
    });

    // Log notification
    console.log(`Notification sent: ${title} - ${message}`);
    
    // In a real app, you might also send:
    // - Push notifications to mobile devices
    // - Email notifications
    // - SMS notifications
    // - WebSocket updates to connected clients
  }

  getNotificationIcon(type) {
    const icons = {
      'start': '📅',
      'warning': '⚠️',
      'urgent': '🚨',
      'info': 'ℹ️',
      'complete': '✅'
    };
    return icons[type] || icons['info'];
  }

  // Schedule daily wake-up notification
  scheduleWakeUpNotification(wakeTime) {
    const wakeMoment = moment(wakeTime, 'HH:mm');
    const today = moment().startOf('day');
    wakeMoment.set({
      year: today.year(),
      month: today.month(),
      date: today.date()
    });

    // If wake time has passed today, schedule for tomorrow
    if (wakeMoment.isBefore(moment())) {
      wakeMoment.add(1, 'day');
    }

    this.scheduleNotification({
      id: 'daily_wake_up',
      title: 'Good morning!',
      message: 'Time to start your day. Here\'s your schedule.',
      time: wakeMoment.toDate(),
      type: 'start'
    });
  }

  // Schedule end-of-day reflection
  scheduleEndOfDayReflection(bedtime) {
    const bedMoment = moment(bedtime, 'HH:mm');
    const today = moment().startOf('day');
    bedMoment.set({
      year: today.year(),
      month: today.month(),
      date: today.date()
    });

    // Schedule 30 minutes before bedtime
    bedMoment.subtract(30, 'minutes');

    // If bedtime has passed today, schedule for tomorrow
    if (bedMoment.isBefore(moment())) {
      bedMoment.add(1, 'day');
    }

    this.scheduleNotification({
      id: 'daily_reflection',
      title: 'End of day reflection',
      message: 'How was your day? Let\'s review your progress.',
      time: bedMoment.toDate(),
      type: 'info'
    });
  }

  // Handle snooze functionality
  snoozeEvent(eventId, snoozeMinutes = 5) {
    const eventNotifications = Array.from(this.scheduledNotifications.values())
      .filter(n => n.notification.event_id === eventId);

    eventNotifications.forEach(notification => {
      clearTimeout(notification.timeoutId);
      this.scheduledNotifications.delete(notification.notification.id);

      // Reschedule with delay
      const newTime = moment(notification.notification.time).add(snoozeMinutes, 'minutes');
      const rescheduledNotification = {
        ...notification.notification,
        time: newTime.toDate()
      };

      this.scheduleNotification(rescheduledNotification);
    });

    console.log(`Snoozed notifications for event ${eventId} by ${snoozeMinutes} minutes`);
  }

  // Send immediate notification (for urgent alerts)
  sendImmediateNotification(title, message, type = 'urgent') {
    this.sendNotification(title, message, type);
  }

  // Cancel specific notification
  cancelNotification(notificationId) {
    const notification = this.scheduledNotifications.get(notificationId);
    if (notification) {
      clearTimeout(notification.timeoutId);
      this.scheduledNotifications.delete(notificationId);
      console.log(`Cancelled notification: ${notificationId}`);
      return true;
    }
    return false;
  }

  // Cancel all notifications for an event
  cancelEventNotifications(eventId) {
    const eventNotifications = Array.from(this.scheduledNotifications.entries())
      .filter(([id, notification]) => notification.notification.event_id === eventId);

    eventNotifications.forEach(([id, notification]) => {
      clearTimeout(notification.timeoutId);
      this.scheduledNotifications.delete(id);
    });

    console.log(`Cancelled all notifications for event ${eventId}`);
  }

  // Clear all scheduled notifications
  clearAllNotifications() {
    this.scheduledNotifications.forEach((notification, id) => {
      clearTimeout(notification.timeoutId);
    });
    this.scheduledNotifications.clear();
    console.log('Cleared all scheduled notifications');
  }

  // Get list of scheduled notifications
  getScheduledNotifications() {
    return Array.from(this.scheduledNotifications.values()).map(n => ({
      id: n.notification.id,
      title: n.notification.title,
      scheduled_for: n.scheduled_for,
      event_id: n.notification.event_id
    }));
  }

  // Handle traffic/weather alerts
  async handleExternalAlerts(alerts) {
    alerts.forEach(alert => {
      if (alert.type === 'traffic' || alert.type === 'weather') {
        this.sendImmediateNotification(
          `${alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} Alert`,
          alert.message,
          'urgent'
        );
      }
    });
  }

  // Schedule recurring notifications (daily, weekly, etc.)
  scheduleRecurringNotification(cronExpression, title, message, type = 'info') {
    const task = cron.schedule(cronExpression, () => {
      this.sendNotification(title, message, type);
    }, {
      scheduled: true,
      timezone: "America/New_York" // Adjust based on user's timezone
    });

    return task;
  }

  // Clean up resources
  destroy() {
    this.clearAllNotifications();
  }
}

export default NotificationService;
