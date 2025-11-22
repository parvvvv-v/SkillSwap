import { auth, db } from "./firebase_config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import {
  collection, query, where, onSnapshot, addDoc, serverTimestamp,
  orderBy, doc, getDoc, updateDoc, deleteDoc, getDocs, arrayUnion, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const chatList = document.getElementById("chatList");
const chatArea = document.getElementById("chatArea");
const searchInput = document.getElementById("searchInput");

let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;
let chatsUnsub = null;

const directUserId = new URLSearchParams(window.location.search).get("user");

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "login.html");
  currentUser = user;
  loadChats();
  if (directUserId) openChatDirect(directUserId);
});

async function loadChats() {
  chatList.innerHTML = "";

  const q = query(collection(db, "chats"), where("users", "array-contains", currentUser.uid));

  if (chatsUnsub) chatsUnsub();

  chatsUnsub = onSnapshot(q, async snap => {
    document.querySelectorAll(".real-chat").forEach(e => e.remove());

    for (const d of snap.docs) {
      const data = d.data();
      const otherId = data.users.find(u => u !== currentUser.uid);
      if (!otherId) continue;

      const uSnap = await getDoc(doc(db, "users", otherId));
      const u = uSnap.exists() ? uSnap.data() : { username: "User", avatarUrl: null };

      const item = document.createElement("div");
      item.className = "chat-item real-chat";
      item.dataset.chatId = d.id;
      item.innerHTML = `
        <div class="chat-avatar"><img src="${u.avatarUrl || 'https://via.placeholder.com/48'}"></div>
        <div class="chat-info">
          <div class="chat-name">${escape(u.username)}</div>
          <div class="chat-preview">${escape(data.lastMessage || "")}</div>
        </div>
      `;
      item.onclick = () => openChat(d.id, otherId, u.username, u.avatarUrl);

      chatList.appendChild(item);
    }
  });
}

function staticChat({ avatar, name, preview, chatId, otherId }) {
  const div = document.createElement("div");
  div.className = "chat-item";
  div.dataset.chatId = chatId;
  div.innerHTML = `
    <div class="chat-avatar"><img src="${avatar}"></div>
    <div class="chat-info">
      <div class="chat-name">${name}</div>
      <div class="chat-preview">${preview}</div>
    </div>
  `;
  div.onclick = () => openChat(chatId, otherId, name, avatar);
  return div;
}

async function openChat(chatId, otherUserId, name, pic) {
  if (unsubscribeMessages) unsubscribeMessages();

  currentChatId = chatId;

  chatArea.innerHTML = `
    <div class="chat-area-header">
      <div class="chat-area-info">
        <img src="${pic || 'https://via.placeholder.com/44'}">
        <div>
          <div class="chat-area-name">${escape(name)}</div>
          <div class="chat-area-status">online</div>
        </div>
      </div>

      <div class="chat-area-actions">
        <button id="meetBtn" title="Start Google Meet">
          <i class="fas fa-video"></i>
        </button>
        <button id="deleteChatBtn" title="Delete Chat">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>

    <div id="messagesContainer" class="messages-container"></div>

    <div class="input-area">
      <input id="messageInput" placeholder="Type a message">
      <button id="sendBtn" class="send-btn"><i class="fas fa-paper-plane"></i></button>
    </div>
  `;

  document.getElementById("meetBtn").onclick = async () => {
    const url = `https://meet.google.com/new`;
    window.open(url, "_blank");

    await addDoc(collection(db, "chats", currentChatId, "messages"), {
      text: `📹 Google Meet started — Join: ${url}`,
      sender: currentUser.uid,
      timestamp: serverTimestamp(),
      meeting: true,
      meetUrl: url,
      deletedFor: []
    });

    await updateDoc(doc(db, "chats", currentChatId), {
      lastMessage: "Started a Google Meet",
      lastMessageTime: serverTimestamp()
    });
  };

  document.getElementById("deleteChatBtn").onclick = () => deleteChat(currentChatId);

  const send = document.getElementById("sendBtn");
  const input = document.getElementById("messageInput");
  const container = document.getElementById("messagesContainer");

  send.onclick = () => { sendMsg(input.value); input.value = ""; };
  input.onkeypress = e => { if (e.key === "Enter") { sendMsg(input.value); input.value = ""; } };

  const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp"));

  unsubscribeMessages = onSnapshot(q, snap => {
    const msgs = [];
    snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
    renderMessages(container, msgs);
    container.scrollTop = container.scrollHeight;
  });
}

function renderMessages(container, msgs) {
  container.innerHTML = "";

  msgs.forEach((m, i) => {
    if ((m.deletedFor || []).includes(currentUser.uid)) {
      return;
    }

    let side = m.sender === currentUser.uid ? "sent" : "received";
    if (m.sender === 'skillswap_bot' && currentChatId === 'skillswap_help_chat') {
        side = "received";
    }


    const bubble = m.meeting
      ? `<strong>📹 Google Meet</strong><br>Tap to join<br>
         <a href="${m.meetUrl}" target="_blank">${m.meetUrl}</a>
         <div class="message-time">${time(m.timestamp)}</div>`
      : `${escape(m.text)}<div class="message-time">${time(m.timestamp)}</div>`;

    const messageId = m.id;

    container.innerHTML += `
      <div class="message ${side}">
        <div class="message-bubble">
          <div class="delete-icon" data-message-id="${messageId}"><i class="fas fa-trash"></i></div>
          ${bubble}
        </div>
      </div>`;
  });

  document.querySelectorAll('.delete-icon').forEach(icon => {
    icon.onclick = (e) => {
      const messageId = e.currentTarget.dataset.messageId;
      deleteForMe(currentChatId, messageId);
    };
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".msg-menu-box").forEach(b => b.classList.remove("show"));
});

async function sendMsg(t) {
  if (!t.trim()) return;

  await addDoc(collection(db, "chats", currentChatId, "messages"), {
    text: t,
    sender: currentUser.uid,
    timestamp: serverTimestamp(),
    deletedFor: []
  });

  await updateDoc(doc(db, "chats", currentChatId), {
    lastMessage: t,
    lastMessageTime: serverTimestamp()
  });

  if (currentChatId === "skillswap_help_chat") {
      await generateBotResponse(t);
  }
}

async function generateBotResponse(userMessage) {
    let botResponse = "I'm a SkillSwap bot, built to assist you. I'm currently set to provide automated responses. How can I help you connect, learn, or share skills today?";
    const msg = userMessage.toLowerCase();

    if (msg.includes("hello") || msg.includes("hi")) {
        botResponse = "Hello! I'm SkillSwap Bot. I can help you navigate the app. What skill are you looking to swap or learn?";
    } else if (msg.includes("skillswap")) {
        botResponse = "SkillSwap is a platform dedicated to connecting individuals for skill exchange. You can teach what you know and learn something new in return!";
    } else if (msg.includes("help") || msg.includes("support")) {
        botResponse = "For app support, please check the 'Requests' tab or tell me briefly what issue you're facing, and I will try to direct you!";
    } else if (msg.includes("gemini")) {
        botResponse = "I aim to be as helpful as a large language model! While I have simple, rule-based responses for now, my purpose is to guide you through SkillSwap.";
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await addDoc(collection(db, "chats", currentChatId, "messages"), {
        text: botResponse,
        sender: 'skillswap_bot', 
        timestamp: serverTimestamp(),
        deletedFor: []
    });
    await updateDoc(doc(db, "chats", currentChatId), {
        lastMessage: "SkillSwap Bot: " + botResponse,
        lastMessageTime: serverTimestamp()
    });
}


function deleteForMe(chatId, msgId) {
  updateDoc(doc(db, "chats", chatId, "messages", msgId), {
    deletedFor: arrayUnion(currentUser.uid)
  });
}

function deleteForAll(chatId, msgId) {
  deleteDoc(doc(db, "chats", chatId, "messages", msgId));
}

async function deleteChat(chatId) {
  if (!chatId) return;

  const confirmation = confirm("Are you sure you want to delete this chat for you only? Other participants will still see the messages.");
  if (!confirmation) return;

  try {
    const messagesQuery = query(collection(db, "chats", chatId, "messages"));
    const messagesSnapshot = await getDocs(messagesQuery);

    if (messagesSnapshot.empty) {
        console.log("No messages to delete.");
        const container = document.getElementById("messagesContainer");
        if (container) container.innerHTML = "";
        return;
    }
    
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;

    messagesSnapshot.forEach((messageDoc) => {
      const messageRef = doc(db, "chats", chatId, "messages", messageDoc.id);
      currentBatch.update(messageRef, {
        deletedFor: arrayUnion(currentUser.uid)
      });
      operationCount++;
      if (operationCount >= 499) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    });
    if (operationCount > 0) {
        batches.push(currentBatch);
    }

    await Promise.all(batches.map(batch => batch.commit()));
    
  } catch (error) {
    console.error("Error deleting chat for user:", error);
    alert("Failed to delete chat history. Please try again.");
  }
}


async function openChatDirect(uid) {
  const q = query(collection(db, "chats"),
    where("users", "array-contains-any", [currentUser.uid, uid])
  );

  const snap = await getDocs(q);
  let found = null;

  snap.forEach(d => {
    const x = d.data();
    if (x.users.includes(currentUser.uid) && x.users.includes(uid)) found = d;
  });

  const us = await getDoc(doc(db, "users", uid));
  const u = us.exists() ? us.data() : { username: "User", avatarUrl: null };

  if (found) return openChat(found.id, uid, u.username, u.avatarUrl);

  const newChat = await addDoc(collection(db, "chats"), {
    users: [currentUser.uid, uid],
    createdAt: serverTimestamp(),
    lastMessage: "",
    lastMessageTime: serverTimestamp()
  });

  openChat(newChat.id, uid, u.username, u.avatarUrl);
}

searchInput.oninput = e => {
  const t = e.target.value.toLowerCase();
  document.querySelectorAll(".chat-item").forEach(item => {
    const n = item.querySelector(".chat-name")?.textContent.toLowerCase();
    if (item.classList.contains("real-chat")) {
        if (n) {
          item.style.display = n.includes(t) ? "flex" : "none";
        }
    } else {
        item.style.display = "none";
    }
  });
};

function time(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escape(s) {
  return s ? s.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}
