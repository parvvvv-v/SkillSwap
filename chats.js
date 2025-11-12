
import { auth, db } from "./firebase_config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const chatList = document.getElementById("chatList");
const chatArea = document.getElementById("chatArea");
const searchInput = document.getElementById("searchInput");

let currentUser = null;
let currentChatId = null;
let unsubscribe = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadChats();
  } else {
    window.location.href = "login.html";
  }
});

async function loadChats() {
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("users", "array-contains", currentUser.uid));

  // Add SkillSwap help chat
  const skillSwapChatItem = document.createElement("div");
  skillSwapChatItem.classList.add("chat-item");
  skillSwapChatItem.dataset.chatId = "skillswap_help_chat";
  skillSwapChatItem.dataset.otherUserId = "skillswap_bot";

  skillSwapChatItem.innerHTML = `
    <div class="chat-avatar">
      <img src="https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg?size=626&ext=jpg&ga=GA1.1.1141335507.1718841600&semt=sph" alt="Avatar">
    </div>
    <div class="chat-info">
      <div class="chat-header-info">
        <span class="chat-name">SkillSwap</span>
        <span class="chat-time"></span>
      </div>
      <div class="chat-preview">Welcome to SkillSwap!</div>
    </div>
  `;
  chatList.appendChild(skillSwapChatItem);

  skillSwapChatItem.addEventListener("click", () => {
    openChat("skillswap_help_chat", "skillswap_bot", "SkillSwap", "https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg?size=626&ext=jpg&ga=GA1.1.1141335507.1718841600&semt=sph");
  });

  // Add Demo User Chat
  const demoChatItem = document.createElement("div");
  demoChatItem.classList.add("chat-item");
  demoChatItem.dataset.chatId = "demo_chat";
  demoChatItem.dataset.otherUserId = "demo_user";

  demoChatItem.innerHTML = `
    <div class="chat-avatar">
      <img src="https://www.w3schools.com/howto/img_avatar.png" alt="Avatar">
    </div>
    <div class="chat-info">
      <div class="chat-header-info">
        <span class="chat-name">Demo User</span>
        <span class="chat-time"></span>
      </div>
      <div class="chat-preview">This is a demo chat.</div>
    </div>
  `;
  chatList.appendChild(demoChatItem);

  demoChatItem.addEventListener("click", () => {
    openChat("demo_chat", "demo_user", "Demo User", "https://www.w3schools.com/howto/img_avatar.png");
  });


  onSnapshot(q, (snapshot) => {
    snapshot.forEach(async (doc) => {
      const chat = doc.data();
      const otherUserId = chat.users.find((uid) => uid !== currentUser.uid);
      const userDoc = await getDoc(doc(db, "users", otherUserId));
      const userData = userDoc.data();

      const chatItem = document.createElement("div");
      chatItem.classList.add("chat-item");
      chatItem.dataset.chatId = doc.id;
      chatItem.dataset.otherUserId = otherUserId;

      chatItem.innerHTML = `
        <div class="chat-avatar">
          <img src="${userData.profilePicture || 'https://via.placeholder.com/50'}" alt="Avatar">
        </div>
        <div class="chat-info">
          <div class="chat-header-info">
            <span class="chat-name">${userData.name}</span>
            <span class="chat-time"></span>
          </div>
          <div class="chat-preview"></div>
        </div>
        <div class="chat-item-actions">
            <button class="three-dots-btn">⋮</button>
            <div class="dropdown-menu">
                <button class="clear-chat-btn">Clear Chat</button>
                <button class="delete-chat-btn">Delete Chat</button>
            </div>
        </div>
      `;

      chatList.appendChild(chatItem);

      const threeDotsBtn = chatItem.querySelector(".three-dots-btn");
      const dropdownMenu = chatItem.querySelector(".dropdown-menu");
      const clearChatBtn = chatItem.querySelector(".clear-chat-btn");
      const deleteChatBtn = chatItem.querySelector(".delete-chat-btn");

      threeDotsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
      });

      clearChatBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearChat(doc.id);
        dropdownMenu.style.display = "none";
      });

      deleteChatBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteChat(doc.id);
        dropdownMenu.style.display = "none";
      });

      chatItem.addEventListener("click", () => {
        openChat(doc.id, otherUserId, userData.name, userData.profilePicture);
      });
    });
  });
}

async function clearChat(chatId) {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef);
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(async (doc) => {
    await deleteDoc(doc.ref);
  });
}

async function deleteChat(chatId) {
    await clearChat(chatId);
    await deleteDoc(doc(db, "chats", chatId));
    const chatItem = chatList.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatItem) {
        chatItem.remove();
    }
    if (currentChatId === chatId) {
        chatArea.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 80px;">💬</div>
                <h2>Select a chat to start messaging</h2>
            </div>
        `;
        currentChatId = null;
    }
}

const skillSwapBot = {
  knowledgeBase: {
    "webpage": "Our webpage is a platform for users to swap skills with each other.",
    "developer": "This application was created by a team of passionate developers from around the world.",
    "features": "We offer real-time chat, skill matching, and a secure platform for users to connect.",
    "benefits": "Users can learn new skills, share their expertise, and connect with like-minded individuals.",
  },
  getResponse: function(query) {
    query = query.toLowerCase();
    for (const key in this.knowledgeBase) {
      if (query.includes(key)) {
        return this.knowledgeBase[key];
      }
    }
    return "I'm sorry, I don't understand that question. Please ask me about our webpage, developer, features, or benefits.";
  }
};

function openChat(chatId, otherUserId, otherUserName, otherUserProfilePicture) {
  currentChatId = chatId;
  if (unsubscribe) {
    unsubscribe();
  }

  if (chatId === "skillswap_help_chat") {
    chatArea.innerHTML = `
      <div class="chat-area-header">
        <div class="chat-area-info">
          <div class="chat-avatar">
            <img src="${otherUserProfilePicture || 'https://via.placeholder.com/50'}" alt="Avatar">
          </div>
          <div>
            <div class="chat-area-name">${otherUserName}</div>
            <div class="chat-area-status">online</div>
          </div>
        </div>
        <div class="chat-area-actions">
          <button>⋮</button>
        </div>
      </div>
      <div class="messages-container" id="messagesContainer">
        <div class="message received">
          <div class="message-bubble">
            <div class="message-text">Welcome to SkillSwap! How can I help you today?</div>
          </div>
        </div>
      </div>
      <div class="input-area">
        <input type="text" id="messageInput" placeholder="Ask a question...">
        <button class="send-btn" id="sendBtn">➤</button>
      </div>
    `;

    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const messagesContainer = document.getElementById("messagesContainer");

    const sendMessageToBot = () => {
      const userMessage = messageInput.value;
      if (userMessage.trim() === "") return;

      const userMessageElement = document.createElement("div");
      userMessageElement.classList.add("message", "sent");
      userMessageElement.innerHTML = `
        <div class="message-bubble">
          <div class="message-text">${userMessage}</div>
        </div>
      `;
      messagesContainer.appendChild(userMessageElement);

      const botResponse = skillSwapBot.getResponse(userMessage);
      const botMessageElement = document.createElement("div");
      botMessageElement.classList.add("message", "received");
      botMessageElement.innerHTML = `
        <div class="message-bubble">
          <div class="message-text">${botResponse}</div>
        </div>
      `;
      messagesContainer.appendChild(botMessageElement);

      messageInput.value = "";
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    sendBtn.addEventListener("click", sendMessageToBot);
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessageToBot();
      }
    });

    return;
  }

  chatArea.innerHTML = `
    <div class="chat-area-header">
      <div class="chat-area-info">
        <div class="chat-avatar">
          <img src="${otherUserProfilePicture || 'https://via.placeholder.com/50'}" alt="Avatar">
        </div>
        <div>
          <div class="chat-area-name">${otherUserName}</div>
          <div class="chat-area-status">online</div>
        </div>
      </div>
      <div class="chat-area-actions">
        <button class="google-meet-btn">
          <img src="https://img.icons8.com/color/48/google-meet--v1.png" alt="Google Meet" class="meet-icon">
          Google Meet
        </button>
        <button class="swap-request-btn">Confirm Swap</button>
        <button class="chat-actions-btn">⋮</button>
        <div class="chat-actions-dropdown" style="display: none;">
          <button class="clear-chat-btn">Clear Chat</button>
          <button class="delete-chat-btn">Delete Chat</button>
        </div>
      </div>
    </div>
    <div class="messages-container" id="messagesContainer"></div>
    <div class="input-area">
      <button>😊</button>
      <input type="text" id="messageInput" placeholder="Type a message">
      <button class="send-btn" id="sendBtn">➤</button>
    </div>
  `;

  const messagesContainer = document.getElementById("messagesContainer");
  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const swapRequestBtn = document.querySelector(".swap-request-btn");
  const chatActionsBtn = document.querySelector(".chat-actions-btn");
  const chatActionsDropdown = document.querySelector(".chat-actions-dropdown");
  const clearChatBtn = document.querySelector(".clear-chat-btn");
  const deleteChatBtn = document.querySelector(".delete-chat-btn");
  const googleMeetBtn = document.querySelector(".google-meet-btn");

  chatActionsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    chatActionsDropdown.style.display = chatActionsDropdown.style.display === "none" ? "block" : "none";
  });

  clearChatBtn.addEventListener("click", () => {
    clearChat(chatId);
    chatActionsDropdown.style.display = "none";
  });

  deleteChatBtn.addEventListener("click", () => {
    deleteChat(chatId);
    chatActionsDropdown.style.display = "none";
  });

  googleMeetBtn.addEventListener("click", () => {
    const meetLink = "https://meet.google.com/new";
    sendMessage(`Let's connect on Google Meet: ${meetLink}`);
    window.open(meetLink, "_blank");
  });

  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp"));

  unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const message = change.doc.data();
        const messageId = change.doc.id;
        const messageElement = document.createElement("div");
        messageElement.id = messageId;
        messageElement.classList.add("message", message.sender === currentUser.uid ? "sent" : "received");
        
        let deleteButtonHTML = '';
        if (message.sender === currentUser.uid) {
            deleteButtonHTML = `<button class="delete-message-btn" data-message-id="${messageId}">🗑️</button>`;
        }

        messageElement.innerHTML = `
          <div class="message-bubble">
            <div class="message-text">${message.text}</div>
            <div class="message-time">${new Date(message.timestamp?.toDate()).toLocaleTimeString()}</div>
            ${deleteButtonHTML}
          </div>
        `;
        messagesContainer.appendChild(messageElement);

        if (message.sender === currentUser.uid) {
          const deleteButton = messageElement.querySelector('.delete-message-btn');
          deleteButton.addEventListener('click', async (e) => {
              const messageIdToDelete = e.target.dataset.messageId;
              if (confirm("Are you sure you want to delete this message?")) {
                  await deleteDoc(doc(db, "chats", chatId, "messages", messageIdToDelete));
              }
          });
        }
      }
      if (change.type === "removed") {
        const messageElement = document.getElementById(change.doc.id);
        if (messageElement) {
          messageElement.remove();
        }
      }
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update the chat time in the chat list
    const chatItem = chatList.querySelector(`[data-chat-id="${chatId}"]`);
    if (chatItem && snapshot.docs.length > 0) {
      const lastMessage = snapshot.docs[snapshot.docs.length - 1].data();
      chatItem.querySelector(".chat-time").textContent = new Date(lastMessage.timestamp?.toDate()).toLocaleTimeString();
    }
  });

  sendBtn.addEventListener("click", () => {
    sendMessage(messageInput.value);
    messageInput.value = "";
  });

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage(messageInput.value);
      messageInput.value = "";
    }
  });

  swapRequestBtn.addEventListener("click", () => {
    confirmSwap(otherUserId);
  });
}

async function sendMessage(text) {
  if (text.trim() === "" || !currentChatId) return;

  const messagesRef = collection(db, "chats", currentChatId, "messages");
  await addDoc(messagesRef, {
    text,
    sender: currentUser.uid,
    timestamp: serverTimestamp(),
  });
}

async function confirmSwap(otherUserId) {
    if (!currentChatId) return;
  
    const chatRef = doc(db, "chats", currentChatId);
    const chatDoc = await getDoc(chatRef);
    const chatData = chatDoc.data();
  
    // Check if a swap is already pending
    if (chatData.swap && chatData.swap.status === "pending") {
      // If the other user initiated the swap, confirm it
      if (chatData.swap.requester !== currentUser.uid) {
        await updateDoc(chatRef, {
          "swap.status": "confirmed",
        });
        alert("Swap confirmed!");
      } else {
        alert("You have already sent a swap request.");
      }
    } else {
      // If no swap is pending, initiate a new one
      await updateDoc(chatRef, {
        swap: {
          requester: currentUser.uid,
          status: "pending",
        },
      });
      alert("Swap request sent!");
    }
  }
  

searchInput.addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const chatItems = document.querySelectorAll(".chat-item");
  chatItems.forEach((item) => {
    const chatName = item.querySelector(".chat-name").textContent.toLowerCase();
    if (chatName.includes(searchTerm)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
});

window.addEventListener("click", () => {
    const dropdowns = document.querySelectorAll(".dropdown-menu");
    dropdowns.forEach(dropdown => {
        dropdown.style.display = "none";
    });
});
