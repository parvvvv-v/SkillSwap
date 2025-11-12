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
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// --- UI Elements ---
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


async function updateRequestStatus(requestId, newStatus) {
    try {
        const requestDocRef = doc(db, "requests", requestId);
        await updateDoc(requestDocRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        

        if (newStatus === 'rejected') {
            const rejectedCard = document.querySelector(`.request-card[data-id="${requestId}"]`);
            if (rejectedCard) {
                rejectedCard.classList.add('hidden'); 
                setTimeout(() => rejectedCard.remove(), 500); 
            }
            showMessage(`Request declined and removed!`);
        } else {
            showMessage(`Request ${newStatus} successfully!`);
        }
    } catch (error) {
        console.error(`Error updating request status to ${newStatus}:`, error);
        showMessage(`Failed to ${newStatus} request.`, true);
    }
}

function renderRequestItem(req, type) {
    let senderReceiverText = '';
    let actionButtons = '';
    let statusDisplay = '';

    const timestamp = (req.timestamp && req.timestamp.toDate) ? new Date(req.timestamp.toDate()).toLocaleString() : (req.status === 'pending' ? 'Sending...' : 'N/A');

    if (req.status === 'pending') {
        statusDisplay = `<span class="pending-status"><i class="fas fa-clock"></i> Pending</span>`;
    } else if (req.status === 'accepted') {
        statusDisplay = `<span class="accepted-status"><i class="fas fa-check-circle"></i> Accepted</span>`;
    } else if (req.status === 'rejected') {
        statusDisplay = `<span class="rejected-status"><i class="fas fa-times-circle"></i> Declined</span>`; 
    }

    const learnSkillsDisplay = formatSkillsForDisplay(req.skillToLearn);
    const teachSkillsDisplay = formatSkillsForDisplay(req.skillToTeach);

    if (type === 'received') {
        senderReceiverText = `<p>From: <strong>${req.senderName}</strong></p>`;
        
        if (req.status === 'pending') {
            actionButtons = `
                <button class="action-btn action-accept" data-id="${req.id}" data-action="accept"><i class="fas fa-check"></i> Accept</button>
                <button class="action-btn action-reject" data-id="${req.id}" data-action="reject"><i class="fas fa-times"></i> Decline</button>
            `;
        } else if (req.status === 'accepted') {
            actionButtons = `
                <button class="action-btn action-chat" data-id="${req.id}" data-action="chat" data-other-id="${req.senderId}"><i class="fas fa-comment-dots"></i> Start Chat</button>
            `;
        }
        
    } else {
 
        senderReceiverText = `<p>To: <strong>${req.receiverName}</strong></p>`;
        if (req.status === 'accepted') {
             actionButtons = `
                <button class="action-btn action-chat" data-id="${req.id}" data-action="chat" data-other-id="${req.receiverId}"><i class="fas fa-comment-dots"></i> Start Chat</button>
            `;
        }
    }

    const item = document.createElement('div');
    item.className = `request-card ${req.status} ${type === 'received' && req.status === 'rejected' ? 'hidden' : ''}`;
    item.dataset.id = req.id;
    item.innerHTML = `
        <div class="request-content">
            <div class="request-details">
                ${senderReceiverText}
                <p>Asking to learn: <strong>${learnSkillsDisplay}</strong></p>
                <p>Offering to teach: <strong>${teachSkillsDisplay}</strong></p>
                <p class="request-meta">Sent on: ${timestamp}</p>
            </div>
            <div class="request-actions">
                ${statusDisplay}
                ${actionButtons}
            </div>
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
            if (type === 'received' && req.status === 'rejected') {
                return; 
            }
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

    receivedList.removeEventListener('click', handleActionClick); 
    sentList.removeEventListener('click', handleActionClick); 

    receivedList.addEventListener('click', handleActionClick);
    sentList.addEventListener('click', handleActionClick);
}

function handleActionClick(event) {
    const target = event.target.closest('.action-btn');
    if (target) {
        const requestId = target.dataset.id;
        const action = target.dataset.action;
        const otherUserId = target.dataset.otherId;

        if (action === 'accept' || action === 'reject') {
            updateRequestStatus(requestId, action === 'accept' ? 'accepted' : 'rejected');
        } else if (action === 'chat') {
            if (otherUserId) {
                window.location.href = `chat.html?request=${requestId}&user=${otherUserId}`;
            } else {
                showMessage("Chat error: Missing partner ID.", true);
            }
        }
    }
}

function switchTab(tab) {
    document.getElementById('received-requests').style.display = tab === 'received' ? 'block' : 'none';
    document.getElementById('sent-requests').style.display = tab === 'sent' ? 'block' : 'none';

    receivedTabBtn.classList.remove('active');
    sentTabBtn.classList.remove('active');

    if (tab === 'received') {
        receivedTabBtn.classList.add('active');
    } else {
        sentTabBtn.classList.add('active');
    }
}

receivedTabBtn.addEventListener('click', () => switchTab('received'));
sentTabBtn.addEventListener('click', () => switchTab('sent'));

document.addEventListener('DOMContentLoaded', () => {
    requestsCollectionRef = collection(db, "requests");
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("--- REQUESTS.JS INIT ---");
            console.log("Current User ID (UID):", currentUserId);

            const qReceived = query(
                requestsCollectionRef, 
                where("receiverId", "==", currentUserId), 
                orderBy("timestamp", "desc") 
            );

            const qSent = query(
                requestsCollectionRef, 
                where("senderId", "==", currentUserId), 
                orderBy("timestamp", "desc") 
            );
            unsubscribeReceived = onSnapshot(qReceived, (snapshot) => {
                receivedListState = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`[Received Listener] Found ${receivedListState.length} requests for UID: ${currentUserId}`);
                renderAllRequests();
            }, (error) => {
                console.error("Error listening to received requests:", error);
                showMessage("Failed to load received requests (Missing Index? Check console).", true); 
            });
            unsubscribeSent = onSnapshot(qSent, (snapshot) => {
                sentListState = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`[Sent Listener] Found ${sentListState.length} requests sent by UID: ${currentUserId}`);
                renderAllRequests();
            }, (error) => {
                console.error("Error listening to sent requests:", error);
                showMessage("Failed to load sent requests (Missing Index? Check console).", true);
            });
            
        } else {
            console.log("User is logged out in requests.js. Redirecting.");
            if (unsubscribeReceived) unsubscribeReceived();
            if (unsubscribeSent) unsubscribeSent();
            window.location.href = "index.html";
        }
    });
});