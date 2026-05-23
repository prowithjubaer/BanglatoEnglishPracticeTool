# PRO English BD - Sentence Practice Tool

A complete web-based learning tool for the PRO English BD spoken English course platform. Students practice Bangla to English sentence translation with spaced repetition, XP gamification, homework system, and full admin control.

## Features

### Student Side
- **Practice by Tense/Category** - 16 categories with 9 sub-categories each
- **Spaced Repetition** - Wrong answers come back next day, correct ones after 7 days
- **XP & Levels** - Earn XP for correct answers, level up with badges
- **Homework System** - Teacher-assigned homework sets with deadlines
- **Leaderboard** - Global and batch-wise leaderboards
- **Mistake Notebook** - Auto-saved wrong answers for review
- **Premium Locking** - Premium content gated with CTA
- **Multiple Practice Modes** - Normal, Due Review, Wrong Review, Mastered Review

### Admin Side
- **Full Sentence CRUD** - Create, edit, delete with multiple correct answers
- **CSV/XLSX Upload** - Bulk import sentences via spreadsheet
- **Category Management** - Create/edit tense categories and sub-categories
- **Homework Management** - Create sets, assign to batches, set deadlines
- **Student Reports** - Individual progress, category breakdown, accuracy stats
- **Settings Control** - XP values, revision gaps, feedback messages, all configurable
- **Level System** - Customize levels, XP ranges, badges
- **Export** - Download sentences and student progress as CSV

### Answer Checking
- **Exact Match** - Case-insensitive exact matching
- **Flexible Match** - Ignores punctuation, spacing, apostrophe variations
- **AI/Semantic** (Future) - Optional semantic matching

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, React Router
- **Backend**: Express.js, better-sqlite3
- **Auth**: JWT tokens, bcrypt passwords

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Seed the database
npm run seed

# Build frontend
npm run build

# Start the server
npm start
```

Server runs on `http://localhost:3001`

## Demo Credentials

- **Admin**: admin@proenglishbd.com / admin123
- **Student**: student@proenglishbd.com / student123

## Development

```bash
# Run server
npm run dev:server

# Run client (in another terminal)
npm run dev:client
```

## CSV Upload Format

| Column | Required | Example |
|--------|----------|---------|
| bangla_sentence | Yes | আমি প্রতিদিন ইংরেজি শিখি। |
| correct_answer_1 | Yes | I learn English every day. |
| correct_answer_2-5 | No | I study English every day. |
| advanced_version | No | I make it a habit to practice English daily. |
| explanation | No | Present Simple for daily habits. |
| hint | No | Use subject + base verb. |
| category | No | Present Simple |
| subcategory | No | Basic |
| difficulty | No | Easy/Medium/Hard |
| is_premium | No | Yes/No |
| checking_mode | No | exact/flexible/ai |
| tags | No | daily routine, habit |

## License

Proprietary - PRO English BD
