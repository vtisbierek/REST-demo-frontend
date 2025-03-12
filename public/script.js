let userToken = localStorage.getItem('userToken');

// Token validation functions
function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        return payload.exp * 1000 < Date.now();
    } catch (error) {
        return true;
    }
}

// API helper function
async function fetchWithAuth(url, options = {}) {
    if (userToken) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${userToken}`
        };
    }

    const response = await fetch(url, options);
    
    if (response.status === 401) {
        const data = await response.json();
        if (data.error === "Token expired") {
            localStorage.removeItem('userToken');
            userToken = null;
            updateAuthUI();
            alert("Session expired. Please login again.");
        }
    }
    
    return response;
}

// Authentication state functions
function isLoggedIn() {
    const token = localStorage.getItem('userToken');
    if (isTokenExpired(token)) {
        localStorage.removeItem('userToken');
        return false;
    }
    return true;
}

function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const bookSection = document.getElementById('bookSection');
    
    if (isLoggedIn()) {
        authSection.style.display = 'none';
        bookSection.style.display = 'block';
        fetchBooks();
    } else {
        authSection.style.display = 'block';
        bookSection.style.display = 'none';
    }
}

// Function to handle registration
async function register(event) {
    event.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;

    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            userToken = data.token;
            localStorage.setItem('userToken', userToken);
            updateAuthUI();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to handle login
async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            userToken = data.token;
            localStorage.setItem('userToken', userToken);
            updateAuthUI();
        } else {
            alert(data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to handle logout
function logout() {
    userToken = null;
    localStorage.removeItem('userToken');
    updateAuthUI();
}

// Function to fetch all books
async function fetchBooks() {
    try {
        const response = await fetchWithAuth('/books');
        const books = await response.json();
        displayBooks(books);
    } catch (error) {
        console.error('Error fetching books:', error);
    }
}

// Function to display books
function displayBooks(books) {
    const booksListDiv = document.getElementById('booksList');
    booksListDiv.innerHTML = '';

    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.innerHTML = `
            <div class="book-content">
                <h3>${book.title}</h3>
                <p>Author: ${book.author}</p>
            </div>
            <button class="delete-btn" data-id="${book.id}">Delete</button>
        `;
        
        // Add click handler for delete button
        const deleteBtn = bookCard.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteBook(book.id));
        
        booksListDiv.appendChild(bookCard);
    });
}

// Function to add a new book
async function addBook(event) {
    event.preventDefault();

    const title = document.getElementById('title').value;
    const author = document.getElementById('author').value;

    try {
        const response = await fetchWithAuth('/books', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, author })
        });

        if (response.ok) {
            document.getElementById('addBookForm').reset();
            fetchBooks();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to delete a book
async function deleteBook(id) {
    if (!confirm('Are you sure you want to delete this book?')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/books/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            fetchBooks();
        } else {
            const data = await response.json();
            alert(data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Event listeners
document.getElementById('registerForm').addEventListener('submit', register);
document.getElementById('loginForm').addEventListener('submit', login);
document.getElementById('logoutButton').addEventListener('click', logout);
document.getElementById('addBookForm').addEventListener('submit', addBook);

// Initialize UI
updateAuthUI(); 