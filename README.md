# AI Schedule Agent

An intelligent personal schedule management system that uses AI to optimize your daily routine, integrate with calendars and health data, and provide personalized insights.

## Features

### 🤖 AI-Powered Optimization
- Intelligent schedule optimization using GPT-4
- Conflict detection and resolution
- Priority-based task scheduling
- Health-aware schedule adjustments

### 📅 Calendar Integration
- Google Calendar sync
- Apple Calendar support
- Automatic event categorization
- Real-time conflict detection

### 💪 Health Integration
- Sleep schedule tracking
- Activity level monitoring
- Energy-based schedule adjustments
- Health recommendations

### 🔔 Smart Notifications
- 5-minute event warnings
- Wake-up notifications
- End-of-day reflections
- Snooze functionality

### 📊 Analytics & Insights
- Daily productivity tracking
- Weekly performance stats
- AI-generated insights
- Pattern recognition

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd ai-schedule-agent

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your API keys
nano .env
```

Required environment variables:
```env
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
DATABASE_PATH=./data/schedule.db
PORT=3000
```

### 3. API Keys Setup

#### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file

#### Google Calendar API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Add client ID and secret to `.env`

### 4. Run the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## Architecture

### Core Components

1. **Schedule Optimizer** (`src/ai/scheduleOptimizer.js`)
   - GPT-4 powered schedule optimization
   - Conflict detection and resolution
   - Health-aware adjustments

2. **Calendar Service** (`src/integrations/calendarService.js`)
   - Google Calendar integration
   - Apple Calendar support
   - Event categorization

3. **Health Service** (`src/integrations/healthService.js`)
   - Sleep schedule tracking
   - Activity monitoring
   - Health-based recommendations

4. **Notification Service** (`src/services/notificationService.js`)
   - Smart notifications
   - Alarm management
   - Snooze functionality

5. **Database** (`src/models/database.js`)
   - SQLite database
   - User profiles and events
   - Schedule adjustments

### API Endpoints

#### User Profile
- `GET /api/profile/:userId` - Get user profile
- `PUT /api/profile/:userId` - Update user profile

#### Schedule Management
- `GET /api/schedule/:userId/today` - Today's schedule
- `GET /api/schedule/:userId/week` - Weekly schedule
- `GET /api/schedule/:userId/month` - Monthly schedule
- `POST /api/schedule/:userId/optimize` - Optimize schedule

#### Event Management
- `GET /api/events/:userId` - Get events
- `POST /api/events/:userId` - Create event
- `PUT /api/events/:eventId` - Update event
- `DELETE /api/events/:eventId` - Delete event
- `POST /api/events/:eventId/complete` - Mark complete
- `POST /api/events/:eventId/snooze` - Snooze event

#### AI Interactions
- `POST /api/ai/:userId/questions` - Generate daily questions
- `POST /api/ai/:userId/reflection` - Generate insights
- `POST /api/ai/:userId/feedback` - Process feedback

#### Calendar Integration
- `POST /api/calendar/:userId/sync` - Sync calendar
- `GET /api/calendar/:userId/events` - Get calendar events

#### Health Data
- `GET /api/health/:userId` - Get health data
- `POST /api/health/:userId/sync` - Sync health data

## Usage Examples

### 1. Basic Schedule Management

```javascript
// Get today's schedule
const response = await fetch('/api/schedule/demo_user_1/today');
const schedule = await response.json();

// Add a new event
const eventData = {
  title: "Team Meeting",
  event_type: "work",
  start_time: "2024-01-15T10:00:00Z",
  end_time: "2024-01-15T11:00:00Z",
  priority: 2
};

await fetch('/api/events/demo_user_1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(eventData)
});
```

### 2. AI Optimization

```javascript
// Optimize today's schedule
const optimization = await fetch('/api/schedule/demo_user_1/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ date: '2024-01-15' })
});

const result = await optimization.json();
console.log('Conflicts:', result.conflicts);
console.log('Suggestions:', result.suggestions);
```

### 3. Health Integration

```javascript
// Get health data
const healthData = await fetch('/api/health/demo_user_1');
const health = await healthData.json();

// Health data will automatically adjust schedules
// based on sleep quality, energy levels, etc.
```

## Configuration

### User Preferences

Set up your profile with:
- Wake and sleep times
- Meal preferences
- Shower schedule (morning/night)
- Personality type (introvert/extrovert)
- Interests for event discovery
- Location for local events

### Notification Settings

The system automatically schedules:
- 5-minute warnings before events end
- Wake-up notifications
- End-of-day reflections
- Custom alarms

## Development

### Project Structure

```
ai-schedule-agent/
├── src/
│   ├── ai/
│   │   └── scheduleOptimizer.js
│   ├── integrations/
│   │   ├── calendarService.js
│   │   └── healthService.js
│   ├── models/
│   │   └── database.js
│   ├── services/
│   │   └── notificationService.js
│   ├── app.js
│   └── index.js
├── public/
│   └── index.html
├── data/
│   └── schedule.db
├── package.json
├── env.example
└── README.md
```

### Adding New Features

1. **New Integrations**: Add to `src/integrations/`
2. **AI Features**: Extend `src/ai/scheduleOptimizer.js`
3. **Database Changes**: Update `src/models/database.js`
4. **API Endpoints**: Add to `src/app.js`

### Testing

```bash
# Run tests (when implemented)
npm test

# Test specific functionality
npm run test:api
npm run test:ai
```

## Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_PATH=/var/lib/ai-schedule-agent/schedule.db
OPENAI_API_KEY=your_production_key
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_secret
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Database not found**: Ensure the `data/` directory exists
2. **API key errors**: Verify all API keys are correctly set in `.env`
3. **Calendar sync issues**: Check Google Calendar API credentials
4. **Notifications not working**: Ensure system notifications are enabled

### Logs

Check application logs for detailed error information:
```bash
# Development
npm run dev

# Production
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Open an issue on GitHub

---

**Built with ❤️ using Node.js, Express, OpenAI GPT-4, and modern web technologies.**
