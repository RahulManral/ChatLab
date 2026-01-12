# 💬 ChatLab — Real-Time Chat Application

ChatLab is a **real-time chat application** built with the modern web stack.  
It enables seamless peer-to-peer communication with live message updates, a clean and responsive UI, and robust backend support for scalability and security.

---

## 🚀 Features

- ⚡ **Real-time Messaging:** Instant message delivery using Socket.IO  
- 🎨 **Modern UI:** Built with React and Tailwind CSS for clean, responsive design  
- 🔐 **Secure Communication:** Integrated user authentication & protected chat routes  
- ♻️ **Persistent Chat History:** Messages are securely stored and managed in MongoDB  
- 🌍 **Scalable Architecture:** Designed for performance and horizontal scaling  
- 💾 **Backend REST API:** Built with Node.js and Express for clean service separation  

---

## 🧩 Tech Stack

**Frontend:**
- React.js  
- Tailwind CSS  
- HTML5, CSS3, JavaScript (ES6+)

**Backend:**
- Node.js  
- Express.js  
- Socket.IO (for real-time communication)

**Database:**
- MongoDB (via Mongoose)

---

## ⚙️ Installation and Setup

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/ChatLab.git
cd ChatLab
```

### 2. Install Dependencies
Install dependencies for both client and server:

```bash
# Install server dependencies
npm install

# Move to client folder and install frontend dependencies
cd client
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the `server` directory with the following:
```bash
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### 4. Run the Application
Run both frontend and backend concurrently:

```bash
# From the root folder
npm run dev
```

(Ensure your `package.json` includes a **concurrent** script for ease of development.)

---

## 💬 Usage

- Sign up or log in to access ChatLab.  
- Create or join chat rooms instantly.  
- Start sending and receiving messages in real time.  
- Chat history is automatically saved and retrievable on next login.

---

## 🧰 Scripts

| Command | Description |
|----------|--------------|
| `npm run dev` | Run both client and server concurrently |
| `npm run client` | Start React development server |
| `npm run server` | Start Node.js/Express backend |
| `npm run build` | Build optimized production-ready React app |

---

## 🔒 Security

- MongoDB database protected using authentication and environment secrets  
- WebSocket connections managed via Socket.IO event namespaces and rooms  
- User authentication through JWT tokens (if implemented)

---

## 🧑💻 Future Enhancements

- Add **user presence indicators** (online/offline status)  
- Implement **typing indicators** for active chats  
- Add **file sharing** and **image upload** support  
- Enable **group chats** and **private rooms**

---

## 📸 UI Preview

*(You can add screenshots of your app here)*

---

## 🤝 Contributing

Contributions are always welcome!  
To contribute:
1. Fork the repository  
2. Create a new branch (`feature/your-feature-name`)  
3. Commit and push your changes  
4. Create a pull request explaining your updates  

---

## 🧾 License

This project is licensed under the **MIT License** — feel free to use, modify, and share it.

---

## ✨ Author

**Rahuwul**  
Full-Stack Developer  
📧 6rahulmanral9@gmail.com 
🌐 rahulmanral.com
