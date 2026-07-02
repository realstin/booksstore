# 📚 Booksstore API

A small, clean **Books CRUD API** built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**.

This project is written to be **read**, not just run. It's meant to teach the core ideas of backend development  routing,
middleware, controllers, models, error handling and more others   using the smallest possible real-world example: a bookstore 
where you can create, read, update, and delete books.

If you're learning backend development, this repo shows you **one clean way** 
to organize an Express app so it doesn't turn into a single giant file.

---

## 🧠 What You'll Learn From This Repo

- How an HTTP request travels through an Express app, step by step
- Why we split code into `routes`, `controllers`, `models`, and `middleware`
- What middleware actually is, and how it's different from a controller
- How to talk to MongoDB using Mongoose schemas and models
- How to validate input **before** it touches your database
- How to handle errors in one central place instead of everywhere
- How to keep secrets (like database URLs) out of your code using `.env`

---

## 🛠️ Tech Stack

| Tool | Purpose |
|---|---|
| **Node.js** | JavaScript runtime that runs the server |
| **Express.js** | Web framework — handles routing and HTTP logic |
| **MongoDB** | NoSQL database that stores the books |
| **Mongoose** | Library that lets us model MongoDB data as JS objects |
| **dotenv** | Loads environment variables from a `.env` file |

---

## 📁 Project Structure

```
booksstore/
├── server.js                 # Entry point — starts everything
├── config/
│   └── database.js           # Connects to MongoDB
├── models/
│   └── Book.js                # Defines what a "Book" looks like in the database
├── controllers/
│   └── bookController.js     # The actual logic for each action (create, get, update, delete)
├── routes/
│   └── books.js               # Maps URLs + HTTP methods to controller functions
├── middleware/
│   ├── validateBook.js       # Checks incoming data before it reaches the controller
│   └── errorHandler.js       # Catches errors from anywhere in the app
├── .env                       # Your secret config (PORT, MONGODB_URI) — not committed
└── package.json
```

**Why split it up like this?** Each file has exactly one job. If something breaks with validation, you know to look in `middleware/`. If a database field is wrong, you look in `models/`. This is called **separation of concerns**, and it's one of the most important habits in backend development.

---


## 🔄 How a Request Flows Through This App

Say a client sends: `POST /api/books` with a JSON body like `{ "title": "Dune", "author": "Frank Herbert", "price": 15 }`.

Here's the exact path that request takes:

1. **`server.js`** receives the request and hands it to Express's routing system.

2. Express sees the URL starts with `/api/books`, so it forwards the request to **`routes/books.js`**.

3. `routes/books.js` sees it's a `POST` request to `/`, so it runs **`middleware/validateBook.js`** first.

4. `validateBook.js` checks that `title`, `author`, and `price` all exist. If something's missing, it stops the request right there 
and sends back an error. If everything looks good, it calls `next()` to pass control forward.

5. Control reaches **`controllers/bookController.js`**, specifically the `createBook` function, which builds a new `Book`
 using **`models/Book.js`** and saves it to MongoDB.

6. If saving succeeds, the controller sends back the saved book as JSON.

7. If *anything* throws an error along the way, it gets passed to **`middleware/errorHandler.js`**, which is the last piece of middleware in 
`server.js` and catches errors from the whole app.

This request → middleware → controller → model → response pipeline is the backbone of almost every Express app you'll ever build.

---

## 📡 API Endpoints

Base URL: `/api/books`

| Method | Endpoint | Description | Needs Validation? |
|---|---|---|---|
| `POST` | `/api/books` | Create a new book | ✅ |
| `GET` | `/api/books` | Get all books | ❌ |
| `GET` | `/api/books/:id` | Get one book by its ID | ❌ |
| `PUT` | `/api/books/:id` | Update a book by its ID | ✅ |
| `DELETE` | `/api/books/:id` | Delete a book by its ID | ❌ |

### Example: Create a Book
```http
POST /api/books
Content-Type: application/json

{
  "title": "Dune",
  "author": "Frank Herbert",
  "price": 15
}
```

### Example: Get All Books
```http
GET /api/books
```

---

## ⚙️ Setup & Running Locally

1. **Clone the repo**
   ```bash
   git clone https://github.com/realstin/booksstore.git
   cd booksstore
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the root folder with:
   ```
   PORT=5000 
   MONGODB_URI=your_mongodb_connection_string
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. Test it with a tool like **Postman**

---

## 🧩 Key Concepts, Explained One at a Time

**Routes** — decide *which URL + HTTP method* triggers *which function*. They don't contain logic themselves; they just point traffic.

**Controllers** — contain the actual logic: what happens when that route is hit. This is where we talk to the database and 
decide what response to send back.

**Models** — define the *shape* of your data (a Book has a title, author, and price) and give you methods to save, find, update, 
and delete that data in MongoDB.

**Middleware** — functions that run *before* your controller, with the power to stop the request early (like validation) or just 
pass it along (`next()`). Express apps are really just a chain of middleware functions.

**Error Handling Middleware** — a special kind of middleware (it takes 4 arguments: `err, req, res, next`) that Express automatically 
routes errors to, so you don't need `try/catch` boilerplate scattered everywhere.

---

## 📄 License
       ISC