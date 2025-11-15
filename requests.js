import { auth, db } from "./firebase_config.js";
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { 
    collection, 
    query, 
    where, 
    onSnapshot, 
    doc, 
    updateDoc, 
    serverTimestamp,
    orderBy,
    addDoc,
    getDocs,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";


const receivedList = document.getElementById('received-list');
const sentList = document.getElementById('sent-list');
const receivedEmptyEl = document.getElementById('received-empty');
const sentEmptyEl = document.getElementById('sent-empty');
const receivedCountSpan = document.getElementById('received-count');
const sentCountSpan = document.getElementById('sent-count');
const messageBox = document.getElementById('messageBox');
const receivedTabBtn = document.getElementById('received-tab-btn');
const sentTabBtn = document.getElementById('sent-tab-btn');

let currentUserId = null;
let requestsCollectionRef = null;
let receivedListState = []; 
let sentListState = [];    
let unsubscribeReceived = null;
let unsubscribeSent = null;


function showMessage(message, isError = false) {
    messageBox.textContent = message;
    messageBox.className = 'message-box show';
    if (isError) {
        messageBox.classList.add('error');
    } else {
        messageBox.classList.remove('error');
    }

    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);
}

function formatSkillsForDisplay(skillsData) {
    if (Array.isArray(skillsData)) {
        return skillsData.join(', ');
    } else if (typeof skillsData === 'string') {
        return skillsData.trim();
    }
    return 'Not specified';
}

const getTime = (req) => req.timestamp && req.timestamp.toDate ? req.timestamp.toDate().getTime() : 0;


async function createChat(userId1, userId2) {
    try {
        const chatsRef = collection(db, "chats");

        const q = query(chatsRef, where("users", "array-contains", userId1));
        const snap = await getDocs(q);

        for (const d of snap.docs) {
            const data = d.data();
            if (data.users.includes(userId2)) {
                return d.id;
            }
        }

        const newChat = await addDoc(chatsRef, {
            users: [userId1, userId2],
            createdAt: serverTimestamp(),
            lastMessage: "",
        });

        return newChat.id;

    } catch (error) {
        console.error("Chat creation FAILED:", error);
        return null;
    }
}

async function updateRequestStatus(requestId, newStatus) {
    try {
        const requestDocRef = doc(db, "requests", requestId);
        await updateDoc(requestDocRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        if (newStatus === 'rejected') {
            showMessage("Request declined!");
            return;
        }

        if (newStatus === 'accepted') {
            const requestDoc = await getDoc(requestDocRef);
            const requestData = requestDoc.data();

            const chatId = await createChat(requestData.senderId, requestData.receiverId);

            showMessage("Request accepted!");

        
            window.location.href = `chats.html?user=${requestData.senderId}`;
        }

    } catch (error) {
        console.error("Update request error:", error);
        showMessage("Failed to update request", true);
    }
}

function renderRequestItem(req, type) {
    let senderReceiverText = '';
    let actionButtons = '';
    let statusDisplay = '';

    const timestamp = (req.timestamp && req.timestamp.toDate) ? 
        new Date(req.timestamp.toDate()).toLocaleString() : 
        "N/A";

    if (req.status === 'pending') {
        statusDisplay = `<span class="pending-status">⏳ Pending</span>`;
    } else if (req.status === 'accepted') {
        statusDisplay = `<span class="accepted-status">✔ Accepted</span>`;
    } else {
        statusDisplay = `<span class="rejected-status">✖ Declined</span>`;
    }

    const learnSkillsDisplay = formatSkillsForDisplay(req.skillToLearn);
    const teachSkillsDisplay = formatSkillsForDisplay(req.skillToTeach);

    if (type === 'received') {
        senderReceiverText = `<p>From: <strong>${req.senderName}</strong></p>`;
        if (req.status === 'pending') {
            actionButtons = `
                <button class="action-btn action-accept" data-id="${req.id}" data-action="accept">Accept</button>
                <button class="action-btn action-reject" data-id="${req.id}" data-action="reject">Decline</button>
            `;
        } else if (req.status === 'accepted') {
            actionButtons = `
                <button class="action-btn action-chat" data-id="${req.id}" data-other-id="${req.senderId}" data-action="chat">Start Chat</button>
            `;
        }
    } else {
        senderReceiverText = `<p>To: <strong>${req.receiverName}</strong></p>`;
        if (req.status === 'accepted') {
            actionButtons = `
                <button class="action-btn action-chat" data-id="${req.id}" data-other-id="${req.receiverId}" data-action="chat">Start Chat</button>
            `;
        }
    }

    const item = document.createElement('div');
    item.className = `request-card ${req.status}`;
    item.dataset.id = req.id;

    item.innerHTML = `
        <div class="request-details">
            ${senderReceiverText}
            <p>Asking to learn: <strong>${learnSkillsDisplay}</strong></p>
            <p>Offering to teach: <strong>${teachSkillsDisplay}</strong></p>
            <p>Sent on: ${timestamp}</p>
        </div>
        <div class="request-actions">
            ${statusDisplay}
            ${actionButtons}
        </div>
    `;
    return item;
}

function renderRequests(listState, listEl, emptyEl, countSpan, type) {
    const sortedList = listState.sort((a, b) => getTime(b) - getTime(a));

    listEl.innerHTML = '';
    countSpan.textContent = sortedList.length;

    if (sortedList.length === 0) {
        emptyEl.classList.remove('hidden');
    } else {
        emptyEl.classList.add('hidden');
        sortedList.forEach(req => {
            listEl.appendChild(renderRequestItem(req, type));
        });
    }
}

function renderAllRequests() {
    renderRequests(receivedListState, receivedList, receivedEmptyEl, receivedCountSpan, 'received');
    renderRequests(sentListState, sentList, sentEmptyEl, sentCountSpan, 'sent');
    attachActionListeners();
}

function attachActionListeners() {
    receivedList.onclick = handleActionClick;
    sentList.onclick = handleActionClick;
}

function handleActionClick(event) {
    const target = event.target.closest('.action-btn');
    if (!target) return;

    const requestId = target.dataset.id;
    const action = target.dataset.action;
    const otherUserId = target.dataset.otherId;

    if (action === "chat") {
        window.location.href = `chats.html?user=${otherUserId}`;
    }

    if (action === "accept") updateRequestStatus(requestId, "accepted");
    if (action === "reject") updateRequestStatus(requestId, "rejected");
}

function switchTab(tab) {
    document.getElementById('received-requests').style.display = tab === 'received' ? 'block' : 'none';
    document.getElementById('sent-requests').style.display = tab === 'sent' ? 'block' : 'none';

    receivedTabBtn.classList.toggle('active', tab === 'received');
    sentTabBtn.classList.toggle('active', tab === 'sent');
}

receivedTabBtn.addEventListener('click', () => switchTab('received'));
sentTabBtn.addEventListener('click', () => switchTab('sent'));

document.addEventListener('DOMContentLoaded', () => {
    requestsCollectionRef = collection(db, "requests");
    
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        currentUserId = user.uid;

        const qReceived = query(requestsCollectionRef, where("receiverId", "==", currentUserId));
        const qSent = query(requestsCollectionRef, where("senderId", "==", currentUserId));

        unsubscribeReceived = onSnapshot(qReceived, (snapshot) => {
            receivedListState = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAllRequests();
        });

        unsubscribeSent = onSnapshot(qSent, (snapshot) => {
            sentListState = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAllRequests();
        });
    });
});
