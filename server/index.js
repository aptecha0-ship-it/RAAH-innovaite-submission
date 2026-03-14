import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

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
            } catch(e) {
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

        // Specifically set user role if approved? It's already 'lawyer' during signup but good sanity check.
        if (status === 'approved') {
            await pool.query("UPDATE users SET role = 'lawyer' WHERE id = $1", [result.rows[0].user_id]);
        }

        res.json({ message: `Lawyer status updated to ${status}`, profile: result.rows[0] });
    } catch (error) {
        console.error('Error updating lawyer status:', error);
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
