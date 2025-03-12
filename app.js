require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = '24h';

// 2. Basic middleware
app.use(cors());
app.use(bodyParser.json());
app.use(helmet());
app.use(express.static('public'));

// Add this with your other middleware
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// 3. Authentication middleware
//for admin calls
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).json({ error: "Authentication required" });
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = auth[0];
    const password = auth[1];

    // Need to replace these with secure credentials (preferably in environment variables)
    if (username === 'admin' && password === 'adminpass') {
        next();
    } else {
        res.setHeader('WWW-Authenticate', 'Basic');
        res.status(401).json({ error: "Invalid credentials" });
    }
};

//for internal calls
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Authentication required" });
    }

    try {
        // Remove 'Bearer ' from token
        const token = authHeader.split(' ')[1];
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Find user
        const user = users.find(u => u.username === decoded.username);
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        // Add user info to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Token expired" });
        }
        return res.status(401).json({ error: "Invalid token" });
    }
};

// for API calls
const authenticateBasic = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).json({ error: "Authentication required" });
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = auth[0];
    const password = auth[1];

    // Find user and check credentials
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        res.setHeader('WWW-Authenticate', 'Basic');
        return res.status(401).json({ error: "Invalid credentials" });
    }

    req.user = user;
    next();
};

// 4. Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 5. Routes
app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
    }

    if (users.some(u => u.username === username)) {
        return res.status(400).json({ error: "Username already exists" });
    }

    const user = {
        username,
        password, // precisa de hashing pra prod!
    };

    users.push(user);
    saveUsers();

    // Generate JWT token
    const token = jwt.sign(
        { username: user.username },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );

    logOperation('REGISTER', username, 'New user registered');
    res.status(201).json({ token });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate new JWT token
    const token = jwt.sign(
        { username: user.username },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );

    logOperation('LOGIN', username, 'User logged in');
    res.json({ token });
});

app.get('/books', (req, res) => {
    res.json(books);
});

app.post('/books', authenticateUser, (req, res) => {
    if (!req.body.title || !req.body.author) {
        return res.status(400).json({ error: "Title and author are required" });
    }

    const newBook = {
        id: books.length > 0 ? books[books.length - 1].id + 1 : 1,
        title: req.body.title,
        author: req.body.author
    };
    
    books.push(newBook);
    saveBooks(); // Save to file after adding new book
    logOperation('CREATE', req.user.username, `Added book: ${newBook.title}`);
    res.status(201).json(newBook);
});

app.delete('/books/:id', authenticateUser, (req, res) => {
    const bookIndex = books.findIndex(b => b.id === parseInt(req.params.id));
    if (bookIndex === -1) {
        return res.status(404).json({ error: "Book not found" });
    }

    const deletedBook = books[bookIndex];
    books.splice(bookIndex, 1);
    saveBooks(); // Save to file after deleting book
    logOperation('DELETE', req.user.username, `Deleted book: ${deletedBook.title}`);
    res.json({ message: "Book deleted" });
});

app.get('/api/logs', authenticateAdmin, (req, res) => {
    try {
        const logs = fs.readFileSync(path.join(__dirname, 'operations.log'), 'utf8');
        res.send(logs);
    } catch (error) {
        res.status(500).json({ error: "Could not retrieve logs" });
    }
});

// Replace the placeholder API endpoints with actual implementations
app.get('/api/books', authenticateBasic, (req, res) => {
    res.json(books);
});

app.post('/api/books', authenticateBasic, (req, res) => {
    if (!req.body.title || !req.body.author) {
        return res.status(400).json({ error: "Title and author are required" });
    }

    const newBook = {
        id: books.length > 0 ? books[books.length - 1].id + 1 : 1,
        title: req.body.title,
        author: req.body.author
    };
    
    books.push(newBook);
    saveBooks();
    logOperation('CREATE', req.user.username, `Added book: ${newBook.title}`);
    res.status(201).json(newBook);
});

app.delete('/api/books/:id', authenticateBasic, (req, res) => {
    const bookIndex = books.findIndex(b => b.id === parseInt(req.params.id));
    if (bookIndex === -1) {
        return res.status(404).json({ error: "Book not found" });
    }

    const deletedBook = books[bookIndex];
    books.splice(bookIndex, 1);
    saveBooks();
    logOperation('DELETE', req.user.username, `Deleted book: ${deletedBook.title}`);
    res.json({ message: "Book deleted" });
});

app.put('/api/books/:id', authenticateBasic, (req, res) => {
    const book = books.find(b => b.id === parseInt(req.params.id));
    if (!book) {
        return res.status(404).json({ error: "Book not found" });
    }

    if (!req.body) {
        return res.status(400).json({ error: "Bad request" });
    }

    book.title = req.body.title || book.title;
    book.author = req.body.author || book.author;
    
    saveBooks();
    logOperation('UPDATE', req.user.username, `Updated book: ${book.title}`);
    res.json(book);
});

app.get('/api/books/:id', authenticateBasic, (req, res) => {
    const book = books.find(b => b.id === parseInt(req.params.id));
    if (!book) {
        return res.status(404).json({ error: "Book not found" });
    }
    res.json(book);
});

// Load books from file on startup
let books = [];
const BOOKS_FILE = path.join(__dirname, 'books.json');

try {
    if (fs.existsSync(BOOKS_FILE)) {
        books = JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8'));
    } else {
        // Initial books data if file doesn't exist
        books = [
            { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
            { id: 2, title: "1984", author: "George Orwell" }
        ];
        // Save initial books to file
        fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
    }
} catch (error) {
    console.error('Error loading books:', error);
}

// Function to save books to file
function saveBooks() {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
}

// Load users from file on startup
let users = [];
const USERS_FILE = path.join(__dirname, 'users.json');

try {
    if (fs.existsSync(USERS_FILE)) {
        users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
} catch (error) {
    console.error('Error loading users:', error);
}

// Function to save users to file
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Logging function
function logOperation(operation, user, details) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - User: ${user} - ${operation} - ${details}\n`;
    fs.appendFileSync(path.join(__dirname, 'operations.log'), logEntry);
}

// If no users exist, create a demo user
if (users.length === 0) {
    users.push({
        username: "demo",
        password: "demo123"  // Don't do this in production!
    });
    saveUsers();
}

// If no books exist, add sample books
if (books.length === 0) {
    books = [
        { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
        { id: 2, title: "1984", author: "George Orwell" }
    ];
    saveBooks();
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 