#!/usr/bin/env node

// Demo script for AI Schedule Agent
// This demonstrates the core functionality without requiring API keys

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const demoUserId = 'demo_user_1';

// Check if user wants to reset demo data
const shouldReset = process.argv.includes('--reset') || process.argv.includes('-r');

async function runDemo() {
    console.log('🤖 AI Schedule Agent Demo');
    console.log('========================\n');

    try {
        // Initialize database
        const db = await open({
            filename: './data/schedule.db',
            driver: sqlite3.Database
        });
        
        // Create tables
        await db.exec(`
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
                interests TEXT,
                location TEXT,
                timezone TEXT DEFAULT 'UTC',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
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
                recurrence_pattern TEXT,
                is_completed BOOLEAN DEFAULT FALSE,
                completion_time DATETIME,
                source TEXT CHECK(source IN ('manual', 'google_calendar', 'apple_calendar', 'health', 'ai_generated')) DEFAULT 'manual',
                external_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Database initialized');

        // Reset demo data if requested
        if (shouldReset) {
            await db.run('DELETE FROM events WHERE user_id = ?', [demoUserId]);
            await db.run('DELETE FROM user_profile WHERE user_id = ?', [demoUserId]);
            console.log('🗑️  Demo data reset');
        }

        // Create demo user profile
        await db.run(`
            INSERT OR REPLACE INTO user_profile 
            (user_id, wake_time, sleep_time, breakfast_time, lunch_time, dinner_time, 
             personality_type, interests, location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            demoUserId,
            '07:00',
            '23:00',
            '08:00',
            '12:30',
            '19:00',
            'ambivert',
            JSON.stringify(['technology', 'fitness', 'reading']),
            'San Francisco, CA'
        ]);
        console.log('✅ Demo user profile created');

        // Get today's date for demo
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        console.log(`📅 Creating demo events for: ${todayStr}`);
        
        // Check if demo events already exist for the week
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);
        
        const existingEvents = await db.all(
            'SELECT COUNT(*) as count FROM events WHERE user_id = ? AND start_time >= ? AND start_time < ?',
            [demoUserId, startOfWeek.toISOString().split('T')[0], endOfWeek.toISOString().split('T')[0]]
        );

        console.log(`🔍 Found ${existingEvents[0].count} existing events for this week`);
        
        if (existingEvents[0].count === 0) {
            // Create demo events for the entire week
            const demoEvents = [];
            
            // Generate events for each day of the week
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                const dayStr = day.toISOString().split('T')[0];
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i];
                
                // Different events for different days
                if (i === 0) { // Sunday
                    demoEvents.push(
                        [demoUserId, 'Sunday Brunch', 'Relaxing brunch with friends', `${dayStr} 10:00:00`, `${dayStr} 12:00:00`, 'personal', 4, 'Local Café'],
                        [demoUserId, 'Grocery Shopping', 'Weekly grocery run', `${dayStr} 14:00:00`, `${dayStr} 15:30:00`, 'personal', 3, 'Supermarket'],
                        [demoUserId, 'Movie Night', 'Watch latest release', `${dayStr} 19:00:00`, `${dayStr} 21:30:00`, 'personal', 4, 'Home']
                    );
                } else if (i === 1) { // Monday
                    demoEvents.push(
                        [demoUserId, 'Monday Morning Standup', 'Team sync meeting', `${dayStr} 09:00:00`, `${dayStr} 09:30:00`, 'work', 1, 'Office'],
                        [demoUserId, 'Client Presentation', 'Quarterly review presentation', `${dayStr} 14:00:00`, `${dayStr} 15:30:00`, 'work', 1, 'Conference Room B'],
                        [demoUserId, 'Gym Session', 'Strength training', `${dayStr} 18:00:00`, `${dayStr} 19:00:00`, 'personal', 2, 'Fitness Center']
                    );
                } else if (i === 2) { // Tuesday (today - keep existing events)
                    demoEvents.push(
                        [demoUserId, 'Morning Workout', '30-minute cardio session', `${dayStr} 07:30:00`, `${dayStr} 08:00:00`, 'personal', 2, 'Home Gym'],
                        [demoUserId, 'Team Meeting', 'Weekly sprint planning', `${dayStr} 10:00:00`, `${dayStr} 11:00:00`, 'work', 1, 'Conference Room A'],
                        [demoUserId, 'Lunch Break', 'Time to eat and recharge', `${dayStr} 12:30:00`, `${dayStr} 13:30:00`, 'meal', 3, 'Office Cafeteria'],
                        [demoUserId, 'Project Deadline', 'Submit quarterly report', `${dayStr} 14:00:00`, `${dayStr} 16:00:00`, 'work', 1, 'Office'],
                        [demoUserId, 'Evening Reading', 'Read latest tech articles', `${dayStr} 20:00:00`, `${dayStr} 21:00:00`, 'personal', 4, 'Home']
                    );
                } else if (i === 3) { // Wednesday
                    demoEvents.push(
                        [demoUserId, 'Midweek Check-in', 'Progress review with manager', `${dayStr} 10:00:00`, `${dayStr} 11:00:00`, 'work', 2, 'Office'],
                        [demoUserId, 'Lunch with Colleague', 'Networking lunch', `${dayStr} 12:00:00`, `${dayStr} 13:00:00`, 'personal', 3, 'Restaurant'],
                        [demoUserId, 'Code Review Session', 'Review team code submissions', `${dayStr} 15:00:00`, `${dayStr} 16:30:00`, 'work', 2, 'Office']
                    );
                } else if (i === 4) { // Thursday
                    demoEvents.push(
                        [demoUserId, 'Product Demo', 'Show new features to stakeholders', `${dayStr} 11:00:00`, `${dayStr} 12:00:00`, 'work', 1, 'Conference Room C'],
                        [demoUserId, 'Team Building', 'Afternoon team activity', `${dayStr} 16:00:00`, `${dayStr} 17:30:00`, 'work', 3, 'Office'],
                        [demoUserId, 'Cooking Class', 'Learn new recipes', `${dayStr} 19:00:00`, `${dayStr} 21:00:00`, 'personal', 4, 'Cooking School']
                    );
                } else if (i === 5) { // Friday
                    demoEvents.push(
                        [demoUserId, 'Week Wrap-up', 'End of week team meeting', `${dayStr} 09:30:00`, `${dayStr} 10:30:00`, 'work', 2, 'Office'],
                        [demoUserId, 'Happy Hour', 'Friday celebration', `${dayStr} 17:00:00`, `${dayStr} 19:00:00`, 'personal', 4, 'Bar'],
                        [demoUserId, 'Weekend Planning', 'Plan weekend activities', `${dayStr} 20:00:00`, `${dayStr} 21:00:00`, 'personal', 3, 'Home']
                    );
                } else if (i === 6) { // Saturday
                    demoEvents.push(
                        [demoUserId, 'Saturday Hike', 'Morning nature walk', `${dayStr} 08:00:00`, `${dayStr} 11:00:00`, 'personal', 3, 'State Park'],
                        [demoUserId, 'Lunch with Family', 'Family gathering', `${dayStr} 12:30:00`, `${dayStr} 15:00:00`, 'personal', 4, 'Family Home'],
                        [demoUserId, 'Relaxation Time', 'Read and unwind', `${dayStr} 16:00:00`, `${dayStr} 18:00:00`, 'personal', 4, 'Home']
                    );
                }
            }

            for (const event of demoEvents) {
                await db.run(`
                    INSERT INTO events 
                    (user_id, title, description, start_time, end_time, event_type, priority, location)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, event);
            }
            console.log('✅ Demo events added');
        } else {
            console.log('✅ Demo events already exist, skipping creation');
        }

        // Get today's schedule
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const events = await db.all(
            'SELECT * FROM events WHERE user_id = ? AND start_time >= ? AND start_time <= ? ORDER BY start_time',
            [demoUserId, startOfDay.toISOString(), endOfDay.toISOString()]
        );
        
        console.log(`📊 Retrieved ${events.length} events from database`);
        console.log('\n📅 Today\'s Schedule:');
        events.forEach(event => {
            const startTime = new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const priorityText = ['High', 'Medium-High', 'Medium', 'Low'][event.priority - 1];
            console.log(`  ${startTime} - ${event.title} (${priorityText} priority)`);
        });

        // Demonstrate schedule optimization (without OpenAI for demo)
        console.log('\n🧠 AI Schedule Analysis:');
        
        // Check for conflicts
        const conflicts = [];
        for (let i = 0; i < events.length - 1; i++) {
            const currentEvent = events[i];
            const nextEvent = events[i + 1];
            
            const currentEnd = new Date(currentEvent.end_time);
            const nextStart = new Date(nextEvent.start_time);
            
            if (currentEnd > nextStart) {
                conflicts.push({
                    event1: currentEvent.title,
                    event2: nextEvent.title,
                    conflict: 'Time overlap detected'
                });
            }
        }

        if (conflicts.length > 0) {
            console.log('  ⚠️  Conflicts detected:');
            conflicts.forEach(conflict => {
                console.log(`    - ${conflict.event1} overlaps with ${conflict.event2}`);
            });
        } else {
            console.log('  ✅ No conflicts detected');
        }

        // Check work-life balance
        const workEvents = events.filter(e => e.event_type === 'work');
        const personalEvents = events.filter(e => e.event_type === 'personal');
        
        console.log(`  📊 Work-Life Balance:`);
        console.log(`    - Work events: ${workEvents.length}`);
        console.log(`    - Personal events: ${personalEvents.length}`);
        
        if (workEvents.length > personalEvents.length * 2) {
            console.log('    ⚠️  Consider adding more personal time');
        } else {
            console.log('    ✅ Good work-life balance');
        }

        // Demonstrate notification scheduling
        console.log('\n🔔 Notification System:');
        events.forEach(event => {
            const endTime = new Date(event.end_time);
            const warningTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5 minutes before
            console.log(`  - ${event.title}: Warning at ${warningTime.toLocaleTimeString()}`);
        });

        // Show daily stats
        const completedEvents = events.filter(e => e.is_completed);
        const completionRate = Math.round((completedEvents.length / events.length) * 100);
        
        console.log('\n📈 Daily Statistics:');
        console.log(`  - Total events: ${events.length}`);
        console.log(`  - Completed: ${completedEvents.length}`);
        console.log(`  - Completion rate: ${completionRate}%`);

        // Health recommendations
        console.log('\n💪 Health Recommendations:');
        const workHours = workEvents.reduce((total, event) => {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);
            return total + (end - start) / (1000 * 60 * 60); // Convert to hours
        }, 0);
        
        if (workHours > 8) {
            console.log('  ⚠️  Consider taking more breaks - you have over 8 hours of work scheduled');
        } else {
            console.log('  ✅ Good work schedule - under 8 hours');
        }

        console.log('\n🎉 Demo completed successfully!');
        console.log('\nTo run the full application:');
        console.log('1. Add your API keys to .env file');
        console.log('2. Run: npm start');
        console.log('3. Open: http://localhost:3000');
        console.log('\nDemo commands:');
        console.log('- Run demo: node demo.js');
        console.log('- Reset demo data: node demo.js --reset');

        await db.close();

    } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    }
}

runDemo();
