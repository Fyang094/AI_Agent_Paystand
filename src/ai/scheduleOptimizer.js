import OpenAI from 'openai';
import moment from 'moment';

class ScheduleOptimizer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async optimizeSchedule(userId, events, userProfile) {
    const prompt = this.buildOptimizationPrompt(events, userProfile);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an AI schedule optimization expert. Analyze schedules for conflicts, prioritize tasks based on deadlines and importance, and suggest optimal timing for activities."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3
      });

      const optimizationResult = JSON.parse(response.choices[0].message.content);
      return this.processOptimizationResult(optimizationResult, events);
    } catch (error) {
      console.error('Error optimizing schedule:', error);
      return this.fallbackOptimization(events, userProfile);
    }
  }

  buildOptimizationPrompt(events, userProfile) {
    const eventsJson = JSON.stringify(events, null, 2);
    const profileJson = JSON.stringify(userProfile, null, 2);

    return `
Analyze the following schedule and user profile to optimize the user's daily schedule:

USER PROFILE:
${profileJson}

CURRENT EVENTS:
${eventsJson}

Please analyze and provide optimization suggestions in the following JSON format:
{
  "conflicts": [
    {
      "event1_id": "id",
      "event2_id": "id",
      "conflict_type": "time_overlap|insufficient_travel_time|too_many_tasks",
      "severity": "low|medium|high",
      "description": "Description of the conflict"
    }
  ],
  "suggestions": [
    {
      "event_id": "id",
      "suggestion_type": "reschedule|extend|split|merge",
      "new_time": "YYYY-MM-DD HH:mm:ss",
      "reason": "Why this change is beneficial",
      "priority": "low|medium|high"
    }
  ],
  "health_warnings": [
    {
      "type": "overwork|insufficient_break|late_night|early_morning",
      "description": "Health concern description",
      "recommendation": "Suggested action"
    }
  ],
  "productivity_tips": [
    "Tip 1 for better productivity",
    "Tip 2 for better focus",
    "Tip 3 for energy management"
  ]
}

Focus on:
1. Identifying time conflicts and overlaps
2. Ensuring adequate travel time between locations
3. Balancing work/study with personal time
4. Respecting sleep schedule and meal times
5. Prioritizing tasks based on deadlines and importance
6. Suggesting breaks for long work sessions
7. Optimizing for user's personality type and preferences
`;
  }

  processOptimizationResult(result, events) {
    return {
      conflicts: result.conflicts || [],
      suggestions: result.suggestions || [],
      healthWarnings: result.health_warnings || [],
      productivityTips: result.productivity_tips || [],
      optimizedEvents: this.applyOptimizations(events, result.suggestions || [])
    };
  }

  applyOptimizations(events, suggestions) {
    const optimizedEvents = [...events];
    
    suggestions.forEach(suggestion => {
      const eventIndex = optimizedEvents.findIndex(e => e.id === suggestion.event_id);
      if (eventIndex !== -1) {
        switch (suggestion.suggestion_type) {
          case 'reschedule':
            optimizedEvents[eventIndex].start_time = suggestion.new_time;
            optimizedEvents[eventIndex].suggested = true;
            optimizedEvents[eventIndex].suggestion_reason = suggestion.reason;
            break;
          case 'extend':
            const originalDuration = moment(optimizedEvents[eventIndex].end_time)
              .diff(moment(optimizedEvents[eventIndex].start_time), 'minutes');
            optimizedEvents[eventIndex].end_time = moment(suggestion.new_time)
              .add(originalDuration, 'minutes').format();
            break;
        }
      }
    });

    return optimizedEvents;
  }

  fallbackOptimization(events, userProfile) {
    // Simple rule-based optimization as fallback
    const sortedEvents = [...events].sort((a, b) => {
      // Sort by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by deadline
      return new Date(a.start_time) - new Date(b.start_time);
    });

    return {
      conflicts: [],
      suggestions: [],
      healthWarnings: this.detectHealthIssues(sortedEvents, userProfile),
      productivityTips: [
        "Consider taking breaks between intense tasks",
        "Schedule your most important tasks during your peak energy hours",
        "Ensure adequate sleep and meal times"
      ],
      optimizedEvents: sortedEvents
    };
  }

  detectHealthIssues(events, userProfile) {
    const warnings = [];
    
    // Check for overwork (more than 8 hours of work/study)
    const workEvents = events.filter(e => 
      ['class', 'assignment', 'exam', 'quiz', 'work'].includes(e.event_type)
    );
    
    const totalWorkMinutes = workEvents.reduce((total, event) => {
      return total + moment(event.end_time).diff(moment(event.start_time), 'minutes');
    }, 0);

    if (totalWorkMinutes > 480) { // 8 hours
      warnings.push({
        type: "overwork",
        description: `You have ${Math.round(totalWorkMinutes / 60)} hours of work scheduled today`,
        recommendation: "Consider rescheduling some tasks or breaking them into smaller chunks"
      });
    }

    // Check for late night activities
    const lateEvents = events.filter(e => {
      const hour = moment(e.start_time).hour();
      return hour >= 22 || hour <= 6;
    });

    if (lateEvents.length > 0) {
      warnings.push({
        type: "late_night",
        description: "You have activities scheduled late at night",
        recommendation: "Consider moving some activities earlier to maintain good sleep schedule"
      });
    }

    return warnings;
  }

  async generateDailyQuestions(userId, currentSchedule, completedTasks) {
    const prompt = `
Based on the user's current schedule and progress, generate 2-3 personalized questions to help them stay on track:

CURRENT SCHEDULE:
${JSON.stringify(currentSchedule, null, 2)}

COMPLETED TASKS:
${JSON.stringify(completedTasks, null, 2)}

Generate questions that:
1. Check if they're still on track with current tasks
2. Help them prioritize remaining tasks
3. Gather feedback on their energy and focus levels
4. Identify any obstacles or concerns

Return as JSON array of questions:
["Question 1", "Question 2", "Question 3"]
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant that asks thoughtful questions to help users stay productive and on track with their schedule."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating questions:', error);
      return [
        "How are you feeling about your current tasks?",
        "Are you on track with your schedule?",
        "Do you need to adjust anything for the rest of the day?"
      ];
    }
  }

  async generateReflectionInsights(userId, dailyData) {
    const prompt = `
Analyze the user's daily performance and provide insights:

DAILY DATA:
${JSON.stringify(dailyData, null, 2)}

Provide insights in JSON format:
{
  "productivity_score": 8,
  "key_insights": [
    "You completed 80% of your planned tasks",
    "You were most productive in the morning hours",
    "Consider scheduling breaks between intense work sessions"
  ],
  "tomorrow_recommendations": [
    "Start with your highest priority task",
    "Schedule a 15-minute break after 2 hours of work",
    "Consider adjusting your wake-up time by 30 minutes"
  ],
  "patterns_noticed": [
    "You tend to delay tasks in the afternoon",
    "Your energy peaks between 9-11 AM"
  ]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an AI productivity coach that analyzes daily patterns and provides actionable insights for better time management."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating insights:', error);
      return {
        productivity_score: 7,
        key_insights: ["Good progress today!"],
        tomorrow_recommendations: ["Keep up the good work!"],
        patterns_noticed: []
      };
    }
  }
}

export default ScheduleOptimizer;
