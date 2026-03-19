import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pinecone } from '@pinecone-database/pinecone';

dotenv.config();

// ----------------------------------------------------------------------
// DEBUG: Catch 'alert' calls
global.alert = (msg) => {
    console.error('SERVER-SIDE ALERT CALLED:', msg);
    console.trace();
};

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret_for_jwt_signing_raah_123';

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ----------------------------------------------------------------------
// PINECONE CLIENT + EMBEDDING HELPERS
// ----------------------------------------------------------------------

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || '' });
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'raah-aap';

// Ensure the Pinecone index exists (dim=768 for gemini-embedding-001 default, metric=cosine)
const ensurePineconeIndex = async () => {
    try {
        const { indexes } = await pinecone.listIndexes();
        const exists = indexes && indexes.some(i => i.name === PINECONE_INDEX_NAME);
        if (!exists) {
            console.log(`Creating Pinecone index '${PINECONE_INDEX_NAME}'...`);
            await pinecone.createIndex({
                name: PINECONE_INDEX_NAME,
                dimension: 768,
                metric: 'cosine',
                spec: { serverless: { cloud: 'aws', region: 'us-east-1' } }
            });
            // Wait for index to be ready
            await new Promise(r => setTimeout(r, 10000));
            console.log('Pinecone index created.');
        }
    } catch (err) {
        console.error('Pinecone index check/create failed:', err.message);
    }
};

// Diagnostic endpoint to check Pinecone status
app.get('/api/debug/pinecone', async (req, res) => {
    try {
        console.log('[Debug] Checking Pinecone status...');
        const { indexes } = await pinecone.listIndexes();
        const indexList = indexes.map(i => i.name);
        const exists = indexList.includes(PINECONE_INDEX_NAME);
        
        let indexStats = null;
        if (exists) {
            const index = pinecone.index(PINECONE_INDEX_NAME);
            indexStats = await index.describeIndexStats();
        }

        res.json({
            indexName: PINECONE_INDEX_NAME,
            indexExists: exists,
            allIndexes: indexList,
            stats: indexStats,
            env: {
                hasApiKey: !!process.env.PINECONE_API_KEY,
                region: 'us-east-1' // from the hardcoded spec
            }
        });
    } catch (error) {
        console.error('[Debug] Pinecone diagnostic failed:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

// Embed text using Gemini gemini-embedding-001 (768 dims default, reads key from ai_settings)
const embedText = async (text) => {
    const settingsResult = await pool.query('SELECT gemini_api_key FROM ai_settings LIMIT 1');
    const row = settingsResult.rows[0];
    const apiKey = row?.gemini_api_key || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('No Gemini API key configured for embeddings.');

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] }, outputDimensionality: 768 })
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Embedding API error: ${err?.error?.message || res.status}`);
    }
    const data = await res.json();
    const values = data?.embedding?.values;
    if (!values || values.length === 0) {
        console.error('[embedText] Unexpected Gemini response structure:', JSON.stringify(data).slice(0, 500));
        throw new Error('Gemini embedding returned empty or missing values');
    }
    console.log(`[embedText] Generated ${values.length}-dim vector for text: "${text.slice(0, 50)}..."`);
    return values;
};

// Build a text string from a lawyer DB row for embedding
const lawyerToText = (row) => {
    let areas = row.practice_areas || '';
    try { areas = JSON.parse(areas).join(', '); } catch { }
    return [
        `Name: ${row.full_name || ''}`,
        `Practice Areas: ${areas}`,
        `City: ${row.city || ''}`,
        `Experience: ${row.years_of_experience || ''} years`,
        `Bar Council: ${row.bar_council_name || ''}`,
    ].join('. ');
};

const upsertLawyerToPinecone = async (lawyerRow) => {
    console.log(`[Pinecone Sync] Processing lawyer ${lawyerRow.id} (${lawyerRow.full_name})...`);
    try {
        const text = lawyerToText(lawyerRow);
        console.log(`[Pinecone Sync] Embedding text: "${text.slice(0, 100)}..."`);
        const vector = await embedText(text);
        
        if (!vector || vector.length === 0) {
            console.warn(`[Pinecone Sync] Lawyer ${lawyerRow.id}: Empty vector generated, skipping.`);
            return;
        }

        const index = pinecone.index(PINECONE_INDEX_NAME);
        const record = {
            id: `lawyer_${lawyerRow.id}`,
            values: vector,
            metadata: { 
                lawyer_id: lawyerRow.id, 
                city: lawyerRow.city || '', 
                full_name: lawyerRow.full_name || '' 
            }
        };

        // Explicitly ensuring an array of records is sent within the options object
        const recordsToUpsert = [record];
        console.log(`[Pinecone Sync] Attempting upsert for lawyer ${lawyerRow.id}. Records count: ${recordsToUpsert.length}`);
        
        // Pinecone v3/v4 SDK expects { records: [...] } instead of directly passing the array
        const upsertResponse = await index.upsert({ records: recordsToUpsert });
        console.log(`[Pinecone Sync] Lawyer ${lawyerRow.id} synced successfully! Response:`, JSON.stringify(upsertResponse));
    } catch (err) {
        console.error(`[Pinecone Sync] FATAL ERROR syncing lawyer ${lawyerRow.id}:`, err);
        if (err.stack) console.error(err.stack);
    }
};

ensurePineconeIndex();

// Initialize database table
const initDb = async () => {
    try {
        const client = await pool.connect();
        console.log('Connected to Neon PostgreSQL DB');

        // Create users table if it doesn't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        interview_completed BOOLEAN DEFAULT FALSE,
        role VARCHAR(50) DEFAULT 'user',
        lawyer_onboarding_completed BOOLEAN DEFAULT FALSE,
        profile_summary JSONB,
        chat_history JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Check if the column exists and add it if not (for existing databases)
        const checkColumn = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users' AND column_name='interview_completed';
        `);

        if (checkColumn.rows.length === 0) {
            await client.query(`
              ALTER TABLE users ADD COLUMN interview_completed BOOLEAN DEFAULT FALSE;
            `);
            console.log('Added interview_completed column to users table');
        }

        const checkRoleColumn = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users' AND column_name='role';
        `);
        if (checkRoleColumn.rows.length === 0) {
            await client.query(`ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';`);
        }

        const checkLawyerColumn = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users' AND column_name='lawyer_onboarding_completed';
        `);
        if (checkLawyerColumn.rows.length === 0) {
            await client.query(`ALTER TABLE users ADD COLUMN lawyer_onboarding_completed BOOLEAN DEFAULT FALSE;`);
        }

        const checkProfileSummaryColumn = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users' AND column_name='profile_summary';
        `);
        if (checkProfileSummaryColumn.rows.length === 0) {
            await client.query(`ALTER TABLE users ADD COLUMN profile_summary JSONB;`);
        }

        const checkChatHistoryColumn = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='users' AND column_name='chat_history';
        `);
        if (checkChatHistoryColumn.rows.length === 0) {
            await client.query(`ALTER TABLE users ADD COLUMN chat_history JSONB;`);
        }

        // Create lawyer_profiles table
        await client.query(`
      CREATE TABLE IF NOT EXISTS lawyer_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
        full_name VARCHAR(255),
        bar_council_number VARCHAR(255),
        bar_council_name VARCHAR(255),
        chamber_address TEXT,
        city VARCHAR(255),
        practice_areas TEXT,
        years_of_experience VARCHAR(50),
        phone VARCHAR(50),
        cnic VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Check if status column exists in lawyer_profiles and add it if not (for existing databases)
        const checkLawyerStatusColumn = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name='lawyer_profiles' AND column_name='status';
        `);
        if (checkLawyerStatusColumn.rows.length === 0) {
            await client.query(`ALTER TABLE lawyer_profiles ADD COLUMN status VARCHAR(50) DEFAULT 'pending';`);
            console.log('Added status column to lawyer_profiles table');
        }

        // Create Admin user if none exists
        const adminCheck = await client.query(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
        if (adminCheck.rows.length === 0) {
            console.log('No admin found. Creating default admin account...');
            const adminEmail = 'admin@raah.pk';
            const adminPassword = 'admin123';
            const salt = await bcrypt.genSalt(10);
            const adminHash = await bcrypt.hash(adminPassword, salt);

            await client.query(
                `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)`,
                [adminEmail, adminHash, 'admin']
            );
            console.log(`Default admin created: ${adminEmail} / ${adminPassword}`);
        } else {
            console.log('Admin account natively detected.');
        }

        // Create initial interview test questions table
        await client.query(`
          CREATE TABLE IF NOT EXISTS interview_questions (
            id SERIAL PRIMARY KEY,
            question_text TEXT NOT NULL,
            subtitle TEXT,
            options JSONB NOT NULL,
            order_index INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Check if there are any questions, if not, insert the defaults
        const questionsCheck = await client.query('SELECT id FROM interview_questions LIMIT 1');
        if (questionsCheck.rows.length === 0) {
            console.log('Inserting default interview questions...');
            const defaultQuestions = [
                {
                    q: 'Are you currently in a safe, private location and do you have exclusive control over this device?',
                    sub: 'Your safety is our top priority. Please answer honestly.',
                    opts: JSON.stringify([{ label: 'Yes, I am safe and private', value: 'safe' }, { label: 'No, I am in a shared space', value: 'shared' }, { label: 'I need to exit/hide this chat quickly', value: 'exit' }]),
                    order: 1
                },
                {
                    q: 'Which province or territory is your legal issue located in?',
                    sub: 'This helps us apply the correct provincial laws to your case.',
                    opts: JSON.stringify([{ label: 'Punjab', value: 'punjab' }, { label: 'Sindh', value: 'sindh' }, { label: 'Khyber Pakhtunkhwa (KPK)', value: 'kpk' }, { label: 'Balochistan', value: 'balochistan' }, { label: 'Islamabad (ICT) / Other', value: 'ict' }]),
                    order: 2
                },
                {
                    q: 'Which category best describes your primary legal concern?',
                    sub: 'Select the area that most closely matches your situation.',
                    opts: JSON.stringify([{ label: 'Marriage, Divorce, or Khula', value: 'marriage' }, { label: 'Domestic Violence or Safety', value: 'domestic' }, { label: 'Inheritance or Property Rights', value: 'inheritance' }, { label: 'Workplace or Public Harassment', value: 'harassment' }]),
                    order: 3
                },
                {
                    q: 'Is this an ongoing emergency or an immediate threat to your safety?',
                    sub: 'This helps us prioritize your case appropriately.',
                    opts: JSON.stringify([{ label: 'Yes, I am in immediate danger', value: 'immediate' }, { label: 'No, but it is urgent', value: 'urgent' }, { label: 'No, I am seeking general guidance', value: 'general' }]),
                    order: 4
                },
                {
                    q: 'How long has this issue been occurring?',
                    sub: 'Understanding the timeline helps us provide better guidance.',
                    opts: JSON.stringify([{ label: 'Less than a week', value: 'week' }, { label: 'Several months', value: 'months' }, { label: 'More than a year', value: 'year' }]),
                    order: 5
                },
                {
                    q: 'Have you already initiated any formal legal proceedings?',
                    sub: 'This helps us understand where you are in the legal process.',
                    opts: JSON.stringify([{ label: 'Yes, an FIR has been filed', value: 'fir' }, { label: 'Yes, a legal notice has been sent', value: 'notice' }, { label: 'No, I haven\'t taken legal action yet', value: 'none' }]),
                    order: 6
                },
                {
                    q: 'Do you have access to any supporting evidence for your case?',
                    sub: 'Evidence can strengthen your case. Select what you have available.',
                    opts: JSON.stringify([{ label: 'Documents (Nikahnama, Property deeds)', value: 'documents' }, { label: 'Digital Evidence (Texts, Photos, Audio)', value: 'digital' }, { label: 'Witnesses who can testify', value: 'witnesses' }, { label: 'No evidence at this time', value: 'no-evidence' }]),
                    order: 7
                },
                {
                    q: 'In 1–2 sentences, please describe the core incident you are facing.',
                    sub: 'A brief summary helps us understand your situation better. Keep it concise. (Text Input)',
                    opts: JSON.stringify([{ label: 'Text Input', value: 'textarea' }]),
                    order: 8
                },
                {
                    q: 'What is your preferred outcome from using this platform today?',
                    sub: 'Let us know how we can best help you right now.',
                    opts: JSON.stringify([{ label: 'Seek instant AI legal advice', value: 'ai-advice' }, { label: 'Match with a verified lawyer', value: 'match-lawyer' }, { label: 'Prepare a case summary for court', value: 'case-summary' }]),
                    order: 9
                },
                {
                    q: 'Do you have a specific preference for your legal consultant?',
                    sub: 'We\'ll match you with lawyers based on your preferences.',
                    opts: JSON.stringify([{ label: 'Female Lawyer / Budget-Friendly', value: 'female-budget' }, { label: 'Female Lawyer / Standard Rates', value: 'female-standard' }, { label: 'No Gender Preference / Budget-Friendly', value: 'no-pref-budget' }, { label: 'No Gender Preference / Standard Rates', value: 'no-pref-standard' }]),
                    order: 10
                }
            ];

            for (const item of defaultQuestions) {
                await client.query(
                    'INSERT INTO interview_questions (question_text, subtitle, options, order_index) VALUES ($1, $2, $3, $4)',
                    [item.q, item.sub, item.opts, item.order]
                );
            }
            console.log('Default interview questions inserted.');
        }

        // Create ai_settings table
        await client.query(`
          CREATE TABLE IF NOT EXISTS ai_settings (
            id SERIAL PRIMARY KEY,
            active_model VARCHAR(50) DEFAULT 'gemini',
            gemini_api_key TEXT,
            grok_api_key TEXT,
            system_prompt TEXT,
            gemini_status VARCHAR(50) DEFAULT 'operational',
            grok_status VARCHAR(50) DEFAULT 'operational',
            last_error TEXT,
            last_error_at TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Check if system_prompt column exists and add it if not (for existing databases)
        const checkSystemPromptColumn = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name='ai_settings' AND column_name='system_prompt';
        `);
        if (checkSystemPromptColumn.rows.length === 0) {
            await client.query(`ALTER TABLE ai_settings ADD COLUMN system_prompt TEXT;`);
            console.log('Added system_prompt column to ai_settings table');
        }

        // Add status columns for fallback mechanism (for existing databases)
        const checkGeminiStatusColumn = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name='ai_settings' AND column_name='gemini_status';
        `);
        if (checkGeminiStatusColumn.rows.length === 0) {
            await client.query(`
                ALTER TABLE ai_settings
                ADD COLUMN gemini_status VARCHAR(50) DEFAULT 'operational',
                ADD COLUMN grok_status VARCHAR(50) DEFAULT 'operational',
                ADD COLUMN last_error TEXT,
                ADD COLUMN last_error_at TIMESTAMP WITH TIME ZONE;
            `);
            console.log('Added AI status tracking columns to ai_settings table');
        }

        // Seed one default row if none exists
        const aiSettingsCheck = await client.query('SELECT id FROM ai_settings LIMIT 1');
        if (aiSettingsCheck.rows.length === 0) {
            await client.query(`INSERT INTO ai_settings (active_model) VALUES ('gemini')`);
            console.log('Default ai_settings row created.');
        }

        // Create consultations table
        await client.query(`
          CREATE TABLE IF NOT EXISTS consultations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            lawyer_profile_id INTEGER REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
            user_summary TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create consultation_messages table for real-time chat
        await client.query(`
          CREATE TABLE IF NOT EXISTS consultation_messages (
            id SERIAL PRIMARY KEY,
            consultation_id INTEGER REFERENCES consultations(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        console.log('Users table initialized or already exists');
        client.release();
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

initDb();

// Routes
// POST /api/signup
app.post('/api/signup', async (req, res) => {
    const { email, password, role = 'user' } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Check if user already exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert new user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, interview_completed, role, lawyer_onboarding_completed, profile_summary, chat_history',
            [email, passwordHash, role]
        );

        const user = result.rows[0];

        // Generate JWT
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                interview_completed: user.interview_completed,
                role: user.role,
                lawyer_onboarding_completed: user.lawyer_onboarding_completed,
                profile_summary: user.profile_summary,
                chat_history: user.chat_history,
                lawyer_profile: null
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Find user by email
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        let lawyerProfile = null;
        if (user.role === 'lawyer' && user.lawyer_onboarding_completed) {
            const profileResult = await pool.query('SELECT * FROM lawyer_profiles WHERE user_id = $1', [user.id]);
            lawyerProfile = profileResult.rows[0] || null;
        }

        res.json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                interview_completed: user.interview_completed,
                role: user.role,
                lawyer_onboarding_completed: user.lawyer_onboarding_completed,
                profile_summary: user.profile_summary,
                chat_history: user.chat_history,
                lawyer_profile: lawyerProfile
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Optionally verify endpoint
app.get('/api/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query('SELECT id, email, interview_completed, role, lawyer_onboarding_completed, profile_summary, chat_history FROM users WHERE id = $1', [decoded.userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let lawyerProfile = null;
        if (user.role === 'lawyer' && user.lawyer_onboarding_completed) {
            const profileResult = await pool.query('SELECT * FROM lawyer_profiles WHERE user_id = $1', [user.id]);
            lawyerProfile = profileResult.rows[0] || null;
        }

        res.json({
            user: {
                ...user,
                lawyer_profile: lawyerProfile
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// POST /api/user/complete-interview
app.post('/api/user/complete-interview', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        await pool.query('UPDATE users SET interview_completed = true WHERE id = $1', [decoded.userId]);

        res.json({ message: 'Interview marked as completed' });
    } catch (error) {
        console.error('Complete interview error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// POST /api/user/profile-summary
app.post('/api/user/profile-summary', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { summary } = req.body;

        await pool.query('UPDATE users SET profile_summary = $1 WHERE id = $2', [JSON.stringify(summary), decoded.userId]);

        res.json({ message: 'Profile summary updated' });
    } catch (error) {
        console.error('Update profile summary error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/user/chat-history
app.post('/api/user/chat-history', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { history } = req.body;

        await pool.query('UPDATE users SET chat_history = $1 WHERE id = $2', [JSON.stringify(history), decoded.userId]);

        res.json({ message: 'Chat history updated' });
    } catch (error) {
        console.error('Update chat history error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/lawyer-onboarding
app.post('/api/lawyer-onboarding', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;

        const {
            fullName, barCouncilNumber, barCouncilName, chamberAddress, city, practiceAreas, yearsOfExperience, phone, cnic
        } = req.body;

        // Upsert into lawyer_profiles
        await pool.query(`
            INSERT INTO lawyer_profiles 
            (user_id, full_name, bar_council_number, bar_council_name, chamber_address, city, practice_areas, years_of_experience, phone, cnic, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            bar_council_number = EXCLUDED.bar_council_number,
            bar_council_name = EXCLUDED.bar_council_name,
            chamber_address = EXCLUDED.chamber_address,
            city = EXCLUDED.city,
            practice_areas = EXCLUDED.practice_areas,
            years_of_experience = EXCLUDED.years_of_experience,
            phone = EXCLUDED.phone,
            cnic = EXCLUDED.cnic,
            status = 'pending'
        `, [
            userId, fullName, barCouncilNumber, barCouncilName, chamberAddress, city,
            JSON.stringify(practiceAreas), yearsOfExperience, phone, cnic
        ]);

        // Update user
        await pool.query('UPDATE users SET lawyer_onboarding_completed = true WHERE id = $1', [userId]);

        const profileResult = await pool.query('SELECT * FROM lawyer_profiles WHERE user_id = $1', [userId]);
        const lawyerProfile = profileResult.rows[0];

        res.json({ message: 'Lawyer onboarding completed successfully', lawyer_profile: lawyerProfile });
    } catch (error) {
        console.error('Lawyer onboarding error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin Middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch user from db to confirm role is explicitly admin
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [decoded.userId]);
        if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden. Admin access required.' });
        }

        req.user = { userId: decoded.userId, role: result.rows[0].role };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
        const totalUsers = parseInt(totalUsersResult.rows[0].count, 10);

        const interviewsCompletedResult = await pool.query('SELECT COUNT(*) FROM users WHERE interview_completed = true');
        const interviewsCompleted = parseInt(interviewsCompletedResult.rows[0].count, 10);

        const lawyersResult = await pool.query("SELECT COUNT(*) FROM lawyer_profiles WHERE status = 'pending'");
        const pendingLawyers = parseInt(lawyersResult.rows[0].count, 10);

        const activeAiChats = 0; // Placeholder until chat logs are implemented

        res.json({
            totalUsers,
            interviewsCompleted,
            activeAiChats,
            pendingLawyers
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/users
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.email, u.role, u.interview_completed, u.lawyer_onboarding_completed, u.created_at,
                   lp.full_name, lp.bar_council_number 
            FROM users u
            LEFT JOIN lawyer_profiles lp ON u.id = lp.user_id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/admin/users/:id
app.put('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { role, email } = req.body;

    try {
        const result = await pool.query(
            'UPDATE users SET role = $1, email = $2 WHERE id = $3 RETURNING id, email, role',
            [role, email, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        // Prevent admin from accidentally deleting themselves
        if (parseInt(id) === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete the active admin account.' });
        }

        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ----------------------------------------------------------------------
// LAWYER MANAGEMENT (PUBLIC)
// ----------------------------------------------------------------------

// GET /api/lawyers
app.get('/api/lawyers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.email, lp.id, lp.full_name, lp.city, lp.practice_areas, lp.years_of_experience, lp.status, lp.phone, lp.chamber_address
            FROM lawyer_profiles lp
            JOIN users u ON lp.user_id = u.id
            WHERE lp.status = 'approved'
            ORDER BY lp.created_at DESC
        `);

        const lawyers = result.rows.map(row => {
            let spec = '';
            try {
                const parsed = JSON.parse(row.practice_areas || '[]');
                spec = Array.isArray(parsed) ? parsed.join(' / ') : row.practice_areas;
            } catch (e) {
                spec = row.practice_areas;
            }

            return {
                id: row.id.toString(),
                name: row.full_name,
                city: row.city,
                specialization: spec || 'General Practice',
                experience: row.years_of_experience || '1+ years',
                rating: 4.8, // placeholder
                verified: true,
                phone: row.phone || null,
                email: row.email || null,
                chamberAddress: row.chamber_address || null,
            };
        });

        res.json(lawyers);
    } catch (error) {
        console.error('Error fetching public lawyers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ----------------------------------------------------------------------
// LAWYER MANAGEMENT (ADMIN)
// ----------------------------------------------------------------------

// GET /api/admin/lawyers
app.get('/api/admin/lawyers', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.email, lp.*
            FROM lawyer_profiles lp
            JOIN users u ON lp.user_id = u.id
            ORDER BY lp.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching lawyers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/lawyers/stats
app.get('/api/admin/lawyers/stats', authenticateAdmin, async (req, res) => {
    try {
        const pendingResult = await pool.query("SELECT COUNT(*) FROM lawyer_profiles WHERE status = 'pending'");
        const approvedResult = await pool.query("SELECT COUNT(*) FROM lawyer_profiles WHERE status = 'approved'");
        const rejectedResult = await pool.query("SELECT COUNT(*) FROM lawyer_profiles WHERE status = 'rejected'");

        // Count practice areas by fetching all profiles and counting internally 
        // (jsonb array aggregation is possible in postgres natively, but simpler to parse here since array size is small)
        const allProfilesResult = await pool.query("SELECT practice_areas FROM lawyer_profiles");

        const categoriesMap = {};
        allProfilesResult.rows.forEach(row => {
            try {
                const areas = JSON.parse(row.practice_areas || '[]');
                areas.forEach(area => {
                    categoriesMap[area] = (categoriesMap[area] || 0) + 1;
                });
            } catch (e) {
                // Ignore parsing errors for empty/invalid json
            }
        });

        res.json({
            pending: parseInt(pendingResult.rows[0].count, 10),
            approved: parseInt(approvedResult.rows[0].count, 10),
            rejected: parseInt(rejectedResult.rows[0].count, 10),
            categories: categoriesMap
        });
    } catch (error) {
        console.error('Error fetching lawyers stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/admin/lawyers/:id/status
app.put('/api/admin/lawyers/:id/status', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const result = await pool.query(`
            UPDATE lawyer_profiles 
            SET status = $1 
            WHERE id = $2 
            RETURNING *
        `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lawyer profile not found' });
        }

        // Set user role on approval
        if (status === 'approved') {
            await pool.query("UPDATE users SET role = 'lawyer' WHERE id = $1", [result.rows[0].user_id]);
            // Auto-embed into Pinecone asynchronously (don't block the response)
            upsertLawyerToPinecone(result.rows[0]);
        }

        res.json({ message: `Lawyer status updated to ${status}`, profile: result.rows[0] });
    } catch (error) {
        console.error('Error updating lawyer status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ----------------------------------------------------------------------
// AI SETTINGS (ADMIN + USER)
// ----------------------------------------------------------------------

// GET /api/ai-config (public — returns active model name and key presence only, no key values)
app.get('/api/ai-config', async (req, res) => {
    try {
        const result = await pool.query('SELECT active_model, gemini_api_key, grok_api_key FROM ai_settings ORDER BY id LIMIT 1');
        const row = result.rows[0] || {};
        res.json({
            active_model: row.active_model || 'gemini',
            has_gemini_key: !!(row.gemini_api_key && row.gemini_api_key.trim()),
            has_grok_key: !!(row.grok_api_key && row.grok_api_key.trim()),
        });
    } catch (error) {
        console.error('Error fetching ai-config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/chat-key (user auth — returns active key for chat usage)
app.get('/api/chat-key', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET); // just validate, no need for userId
        const result = await pool.query('SELECT active_model, gemini_api_key, grok_api_key, system_prompt FROM ai_settings ORDER BY id LIMIT 1');
        const row = result.rows[0] || {};
        res.json({
            active_model: row.active_model || 'gemini',
            gemini_api_key: row.gemini_api_key || '',
            grok_api_key: row.grok_api_key || '',
            system_prompt: row.system_prompt || ''
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// GET /api/admin/ai-settings (admin — full keys for the settings form)
app.get('/api/admin/ai-settings', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ai_settings ORDER BY id LIMIT 1');
        const row = result.rows[0] || {
            active_model: 'gemini', gemini_api_key: '', grok_api_key: '', system_prompt: '',
            gemini_status: 'operational', grok_status: 'operational', last_error: null, last_error_at: null
        };
        res.json(row);
    } catch (error) {
        console.error('Error fetching admin ai-settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/admin/ai-settings (admin — save model + keys)
app.put('/api/admin/ai-settings', authenticateAdmin, async (req, res) => {
    const { active_model, gemini_api_key, grok_api_key, system_prompt } = req.body;
    if (!active_model || !['gemini', 'grok'].includes(active_model)) {
        return res.status(400).json({ error: 'Invalid active_model. Must be gemini or grok.' });
    }
    try {
        // Check if a row exists and upsert accordingly
        const existing = await pool.query('SELECT id FROM ai_settings LIMIT 1');
        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE ai_settings SET
                    active_model = $1, gemini_api_key = $2, grok_api_key = $3, system_prompt = $4,
                    gemini_status = 'operational', grok_status = 'operational', last_error = NULL, last_error_at = NULL,
                    updated_at = NOW()
                 WHERE id = $5`,
                [active_model, gemini_api_key || null, grok_api_key || null, system_prompt || null, existing.rows[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO ai_settings (active_model, gemini_api_key, grok_api_key, system_prompt) VALUES ($1, $2, $3, $4)`,
                [active_model, gemini_api_key || null, grok_api_key || null, system_prompt || null]
            );
        }
        res.json({ message: 'AI settings saved successfully, health status reset to operational.' });
    } catch (error) {
        console.error('Error saving ai-settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/ai-settings/report-error (user auth — quietly records API failure)
app.post('/api/ai-settings/report-error', async (req, res) => {
    // We intentionally don't strictly require a Bearer token here so it can silently fail and log,
    // but typically it accepts the user token anyway.
    const { provider, error_message } = req.body;
    
    if (!provider || !['gemini', 'grok'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' });
    }

    try {
        const errorText = error_message ? String(error_message).substring(0, 500) : 'Unknown API failure';
        
        if (provider === 'gemini') {
            await pool.query(`UPDATE ai_settings SET gemini_status = 'failing', last_error = $1, last_error_at = NOW()`, [errorText]);
        } else {
            await pool.query(`UPDATE ai_settings SET grok_status = 'failing', last_error = $1, last_error_at = NOW()`, [errorText]);
        }
        
        res.json({ success: true, message: 'Error logged' });
    } catch (err) {
        // We don't want this to crash the chat, so just silently fail.
        console.error('Failed to report AI error:', err);
        res.status(500).json({ error: 'Failed to record error' });
    }
});

// POST /api/admin/sync-pinecone (admin — bulk embed all approved lawyers)
app.post('/api/admin/sync-pinecone', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM lawyer_profiles WHERE status = 'approved'");
        const lawyers = result.rows;
        
        if (lawyers.length === 0) {
            return res.json({ message: 'No approved lawyers found to sync.', synced: 0 });
        }

        // Respond immediately as this might take a while
        res.json({ 
            message: `Starting background sync of ${lawyers.length} lawyer(s) to Pinecone.`, 
            synced: lawyers.length 
        });

        // Run sync in the background
        (async () => {
            console.log(`[Pinecone Sync] starting bulk sync of ${lawyers.length} lawyers...`);
            for (const lawyer of lawyers) {
                await upsertLawyerToPinecone(lawyer);
                // 300ms delay to avoid aggressive rate limiting
                await new Promise(r => setTimeout(r, 300));
            }
            console.log('[Pinecone Sync] Bulk sync complete.');
        })().catch(err => {
            console.error('[Pinecone Sync] Fatal error during bulk sync:', err);
        });

    } catch (error) {
        console.error('[Pinecone Sync] API error:', error);
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});


// ----------------------------------------------------------------------
// RECOMMENDATIONS (USER AUTH)
// ----------------------------------------------------------------------

// POST /api/recommendations — embed user profile + chat → query Pinecone → return enriched lawyer profiles
app.post('/api/recommendations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { userProfile, chatMessages } = req.body;

    try {
        // Build a context text to embed
        const profileText = userProfile ? [
            `Legal Concern: ${userProfile.legalConcern || ''}`,
            `Province: ${userProfile.province || ''}`,
            `Emergency: ${userProfile.emergencyStatus || ''}`,
            `Preferred Outcome: ${userProfile.preferredOutcome || ''}`,
            `Issue: ${userProfile.incidentDescription || ''}`,
        ].join('. ') : '';

        const chatText = Array.isArray(chatMessages)
            ? chatMessages.slice(-8).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
            : '';

        const queryText = [profileText, chatText].filter(Boolean).join('\n\n').slice(0, 2500);

        // Generate embedding for user context
        console.log('[Recommendations] Generating embedding for query text...');
        const queryVector = await embedText(queryText || 'Legal assistance in Pakistan');

        // Query Pinecone for top 3 similar lawyers
        console.log(`[Recommendations] Querying Pinecone index '${PINECONE_INDEX_NAME}'...`);
        const index = pinecone.index(PINECONE_INDEX_NAME);
        const queryResult = await index.query({ vector: queryVector, topK: 3, includeMetadata: true });

        console.log(`[Recommendations] Pinecone returned ${queryResult.matches?.length || 0} matches.`);
        const matches = queryResult.matches || [];
        if (matches.length === 0) {
            console.log('[Recommendations] No matches found in Pinecone.');
            return res.json({ recommendations: [] });
        }

        // Extract lawyer IDs from Pinecone metadata
        const lawyerIds = matches.map(m => {
            console.log(`[Recommendations] Match: ID=${m.id}, Score=${m.score}, Metadata=`, JSON.stringify(m.metadata));
            return m.metadata?.lawyer_id;
        }).filter(Boolean);

        // Fetch full profiles from PostgreSQL
        const profilesResult = await pool.query(
            `SELECT u.email, lp.* FROM lawyer_profiles lp JOIN users u ON lp.user_id = u.id WHERE lp.id = ANY($1)`,
            [lawyerIds]
        );

        // Merge score from Pinecone with full profile
        const enriched = matches.map(match => {
            const lid = match.metadata?.lawyer_id;
            const profile = profilesResult.rows.find(r => r.id === lid);
            if (!profile) return null;
            let areas = profile.practice_areas || '';
            try { areas = JSON.parse(areas).join(' / '); } catch { }
            return {
                id: profile.id,
                full_name: profile.full_name,
                city: profile.city,
                specialization: areas || 'General Practice',
                years_of_experience: profile.years_of_experience,
                bar_council_name: profile.bar_council_name,
                chamber_address: profile.chamber_address,
                phone: profile.phone,
                email: profile.email,
                score: match.score || 0,              // cosine similarity 0-1
                matchPercent: Math.round((match.score || 0) * 100),
            };
        }).filter(Boolean);

        res.json({ recommendations: enriched });
    } catch (error) {
        console.error('Recommendation error:', error);
        res.status(500).json({ error: 'Recommendation failed: ' + error.message });
    }
});


// ----------------------------------------------------------------------
// CONSULTATIONS
// ----------------------------------------------------------------------

// POST /api/consultations — user sends a consultation request to a lawyer
app.post('/api/consultations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { lawyerProfileId, userSummary } = req.body;
    if (!lawyerProfileId) return res.status(400).json({ error: 'lawyerProfileId is required' });

    try {
        // Prevent duplicate requests to same lawyer
        const existing = await pool.query(
            `SELECT id FROM consultations WHERE user_id = $1 AND lawyer_profile_id = $2 AND status = 'pending'`,
            [userId, lawyerProfileId]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You already have a pending request with this lawyer.' });
        }

        const result = await pool.query(
            `INSERT INTO consultations (user_id, lawyer_profile_id, user_summary) VALUES ($1, $2, $3) RETURNING *`,
            [userId, lawyerProfileId, userSummary || null]
        );
        res.status(201).json({ message: 'Consultation request sent.', consultation: result.rows[0] });
    } catch (error) {
        console.error('Consultation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/user/consultations — user views their own requests
app.get('/api/user/consultations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        const result = await pool.query(`
            SELECT c.*, lp.full_name as lawyer_name, lp.practice_areas as lawyer_specialty
            FROM consultations c
            JOIN lawyer_profiles lp ON c.lawyer_profile_id = lp.id
            WHERE c.user_id = $1
            ORDER BY c.created_at DESC
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Fetch user consultations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/lawyer/consultations — lawyer views their incoming requests
app.get('/api/lawyer/consultations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        // Get the lawyer_profile id for this user
        const lawyerResult = await pool.query('SELECT id FROM lawyer_profiles WHERE user_id = $1', [userId]);
        if (lawyerResult.rows.length === 0) return res.status(403).json({ error: 'No lawyer profile found.' });
        const lawyerProfileId = lawyerResult.rows[0].id;

        const result = await pool.query(`
            SELECT c.*, u.email as user_email
            FROM consultations c
            JOIN users u ON c.user_id = u.id
            WHERE c.lawyer_profile_id = $1
            ORDER BY c.created_at DESC
        `, [lawyerProfileId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Fetch consultations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/lawyer/consultations/:id — lawyer accepts or declines a request
app.put('/api/lawyer/consultations/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Status must be accepted or declined' });

    try {
        const lawyerResult = await pool.query('SELECT id FROM lawyer_profiles WHERE user_id = $1', [userId]);
        if (lawyerResult.rows.length === 0) return res.status(403).json({ error: 'No lawyer profile found.' });
        const lawyerProfileId = lawyerResult.rows[0].id;

        const result = await pool.query(
            `UPDATE consultations SET status = $1 WHERE id = $2 AND lawyer_profile_id = $3 RETURNING *`,
            [status, id, lawyerProfileId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Consultation not found or not yours.' });
        res.json({ message: `Request ${status}.`, consultation: result.rows[0] });
    } catch (error) {
        console.error('Update consultation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/consultations/:id/messages — fetch chat history for a consultation
app.get('/api/consultations/:id/messages', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    
    try {
        // Basic auth check: Ensure the user is either the client or the lawyer for this consultation
        const consultationCheck = await pool.query(
            `SELECT c.id FROM consultations c 
             LEFT JOIN lawyer_profiles lp ON c.lawyer_profile_id = lp.id
             WHERE c.id = $1 AND (c.user_id = $2 OR lp.user_id = $2)`,
            [id, userId]
        );
        
        if (consultationCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to this consultation.' });
        }

        const result = await pool.query(`
            SELECT m.*, u.email as sender_email, u.role as sender_role
            FROM consultation_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.consultation_id = $1
            ORDER BY m.created_at ASC
        `, [id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/consultations/:id/messages — send a message
app.post('/api/consultations/:id/messages', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
    const token = authHeader.split(' ')[1];
    let userId;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { id } = req.params;
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
        return res.status(400).json({ error: 'Message cannot be empty' });
    }

    try {
        // Basic auth check: Ensure the user is either the client or the lawyer for this consultation
        const consultationCheck = await pool.query(
            `SELECT c.id, c.status FROM consultations c 
             LEFT JOIN lawyer_profiles lp ON c.lawyer_profile_id = lp.id
             WHERE c.id = $1 AND (c.user_id = $2 OR lp.user_id = $2)`,
            [id, userId]
        );
        
        if (consultationCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Unauthorized access to this consultation.' });
        }
        
        if (consultationCheck.rows[0].status !== 'accepted') {
            return res.status(400).json({ error: 'Cannot send messages until consultation is accepted.' });
        }

        const result = await pool.query(
            `INSERT INTO consultation_messages (consultation_id, sender_id, message) 
             VALUES ($1, $2, $3) RETURNING *`,
            [id, userId, message]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ----------------------------------------------------------------------
// INTERVIEW QUESTIONS CRUD (ADMIN)
// ----------------------------------------------------------------------

// GET /api/questions (Public, active only, for the interview flow)
app.get('/api/questions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM interview_questions 
            WHERE is_active = true 
            ORDER BY order_index ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/questions (Admin, all questions)
app.get('/api/admin/questions', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM interview_questions 
            ORDER BY order_index ASC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching admin questions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/questions (Admin, create new)
app.post('/api/admin/questions', authenticateAdmin, async (req, res) => {
    const { question_text, subtitle, options, order_index, is_active } = req.body;

    if (!question_text || !options) {
        return res.status(400).json({ error: 'Question text and options are required' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO interview_questions (question_text, subtitle, options, order_index, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [question_text, subtitle, JSON.stringify(options), order_index || 0, is_active !== false]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating question:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/admin/questions/:id (Admin, update)
app.put('/api/admin/questions/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { question_text, subtitle, options, order_index, is_active } = req.body;

    try {
        const result = await pool.query(`
            UPDATE interview_questions 
            SET question_text = $1, subtitle = $2, options = $3, order_index = $4, is_active = $5
            WHERE id = $6
            RETURNING *
        `, [
            question_text,
            subtitle,
            JSON.stringify(options),
            order_index || 0,
            is_active !== false,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/admin/questions/:id (Admin, delete)
app.delete('/api/admin/questions/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM interview_questions WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Serve the built React frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

// Serve static assets from the React build directory
app.use(express.static(distPath));

// For all other routes, serve index.html (supports React Router)
app.get('*', (req, res) => {
    // If it's an API call that wasn't handled, send 404
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    // For all other requests, send index.html
    res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
