import { auth, db } from "./firebase_config.js";
import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { 
    collection, 
    query, 
    getDocs, 
    addDoc, 
    serverTimestamp,
    doc,
    getDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const matchCardArea = document.getElementById('match-card-area');
const matchSkillTitle = document.getElementById('match-skill-title');
const matchCountInfo = document.getElementById('match-count-info');
const loadingIndicator = document.getElementById('loading-indicator');
const noMatchesDiv = document.getElementById('no-matches');
const skipBtn = document.getElementById('skip-btn');
const sendMatchBtn = document.getElementById('send-match-btn');
const messageBox = document.getElementById('messageBox');
const skillSearchInput = document.getElementById('skill-search-input');
const searchTutorBtn = document.getElementById('search-tutor-btn');

let currentUserId = null;
let potentialTutors = [];
let currentTutorIndex = 0;
let requiredSkill = ''; 
let currentUserData = null; 

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

function updateButtonState(enabled) {
    skipBtn.disabled = !enabled;
    sendMatchBtn.disabled = !enabled;
}

const safeSkillDisplay = (skills) => {
    if (Array.isArray(skills)) {
    
        return skills.filter(s => s && typeof s === 'string').join(', ').replace(/\s*,/g, ',');
    } else if (typeof skills === 'string') {
    
        return skills.trim();
    }
    return 'Not specified';
};

function createTutorCard(tutor) {
    const card = document.createElement('div');
    card.className = 'match-card';
    card.id = `tutor-card-${tutor.uid}`;

    const avatarUrl = tutor.avatarUrl || 'https://placehold.co/100x100/ff7d2a/ffffff?text=T';
    
    const knownSkillsDisplay = safeSkillDisplay(tutor.skillsKnown);
    const learnSkillsDisplay = safeSkillDisplay(tutor.skillsToLearn);

    card.innerHTML = `
        <img src="${avatarUrl}" class="tutor-avatar" onerror="this.onerror=null;this.src='https://placehold.co/100x100/ff7d2a/ffffff?text=T';" alt="Tutor Avatar">
        <h3 class="tutor-name">${tutor.username || 'Anonymous Tutor'}</h3>
        <div class="tutor-info">
            <p>Knows: <strong>${knownSkillsDisplay}</strong></p>
            <p>Wants to Learn: <strong>${learnSkillsDisplay}</strong></p>
        </div>
    `;
    return card;
}

function renderCurrentCard() {

    matchCardArea.querySelectorAll('.match-card').forEach(card => card.remove());
    loadingIndicator.classList.add('hidden');
    noMatchesDiv.classList.add('hidden');

    if (potentialTutors.length === 0) {
        if (requiredSkill) {
            matchSkillTitle.textContent = `No Tutors for "${requiredSkill}"`;
            noMatchesDiv.classList.remove('hidden');
            matchCountInfo.textContent = '';
        } else {
    
            matchSkillTitle.textContent = 'Start your search above.';
        }
        updateButtonState(false);
        return;
    }

    if (currentTutorIndex >= potentialTutors.length) {
        matchSkillTitle.textContent = `No More Tutors for "${requiredSkill}"`;
        noMatchesDiv.classList.remove('hidden');
        noMatchesDiv.querySelector('h3').textContent = 'You have seen all matching tutors.';
        noMatchesDiv.querySelector('p').textContent = 'Try searching for a different skill!';
        updateButtonState(false);
        return;
    }

    const currentTutor = potentialTutors[currentTutorIndex];
    const card = createTutorCard(currentTutor);
    matchCardArea.appendChild(card);
    
    matchSkillTitle.textContent = `Tutor for "${requiredSkill}"`;
    matchCountInfo.textContent = `Tutor ${currentTutorIndex + 1} of ${potentialTutors.length}`;
    updateButtonState(true);
}

function skipTutor() {
    if (potentialTutors.length > 0) {
        currentTutorIndex++;
        renderCurrentCard();
    }
}

async function sendMatchRequest() {
    if (currentUserId === null || potentialTutors.length === 0 || !currentUserData) {
        showMessage("Cannot send request. Please log in or search for tutors.", true);
        return;
    }

    const receiver = potentialTutors[currentTutorIndex];
    if (!receiver) {
        showMessage("No tutor selected.", true);
        return;
    }
    
    const skillToTeachArray = Array.isArray(currentUserData.skillsKnown) 
        ? currentUserData.skillsKnown
        : (typeof currentUserData.skillsKnown === 'string' ? currentUserData.skillsKnown.split(',').map(s => s.trim()) : []);
    

    const skillToTeachString = skillToTeachArray.filter(s => s).join(', ');

    updateButtonState(false);
    sendMatchBtn.textContent = "Sending...";

    try {
        const requestData = {
            senderId: currentUserId,
            senderName: currentUserData.username || 'Unknown User',
            receiverId: receiver.uid, 
            receiverName: receiver.username || 'Unknown Tutor',
            skillToLearn: requiredSkill, 
            skillToTeach: skillToTeachString, 
            status: "pending", 
            timestamp: serverTimestamp()
        };

        const requestsCol = collection(db, "requests");
        await addDoc(requestsCol, requestData);

        showMessage(`Match request sent to ${receiver.username}!`);
        
        currentTutorIndex++;
        renderCurrentCard();

    } catch (error) {
        console.error("Error sending match request:", error);
        showMessage("Failed to send request. Check console for details.", true);
    } finally {
        sendMatchBtn.textContent = "Send Match Request";
    }
}

async function fetchPotentialTutors(skill) {
    if (!skill) return;
    requiredSkill = skill; 
    matchSkillTitle.textContent = `Finding Tutors for "${skill}"...`;
    loadingIndicator.classList.remove('hidden');
    noMatchesDiv.classList.add('hidden');
    updateButtonState(false);
   
    potentialTutors = [];
    currentTutorIndex = 0;

    try {
        const usersCol = collection(db, "users");
        const snapshot = await getDocs(usersCol); 
        
        let matchingTutors = [];

        const normalizedSearchSkill = requiredSkill.toLowerCase().trim();

        snapshot.forEach(doc => {
            const userData = doc.data();
            const uid = doc.id;

            if (uid === currentUserId) {
                return;
            }

            const rawSkills = userData.skillsKnown;
            let skillsArray = []; 
            if (Array.isArray(rawSkills)) {
                 skillsArray = rawSkills.filter(s => s && typeof s === 'string');
            } else if (typeof rawSkills === 'string') {

                 skillsArray = rawSkills.split(',').map(s => s.trim()).filter(s => s);
            }
            
            const skillMatch = skillsArray.some(skillItem => skillItem.toLowerCase().includes(normalizedSearchSkill));

            if (skillMatch) {
                matchingTutors.push({ uid, ...userData });
            }
        });

        potentialTutors = matchingTutors;
        renderCurrentCard();

    } catch (error) {
        console.error("Error fetching tutors:", error);
        showMessage("Failed to search for tutors.", true);
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function handleSearch() {
    const skill = skillSearchInput.value.trim();
    if (skill) {
        fetchPotentialTutors(skill);
    } else {
        showMessage("Please enter a skill to search.", true);
    }
}

skipBtn.addEventListener('click', skipTutor);
sendMatchBtn.addEventListener('click', sendMatchRequest);
searchTutorBtn.addEventListener('click', handleSearch);
skillSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            const userDocRef = doc(db, "users", currentUserId);
            getDoc(userDocRef).then(docSnapshot => {
                if (docSnapshot.exists()) {
                    currentUserData = docSnapshot.data();

                    renderCurrentCard(); 
                } else {
                    showMessage("Your user profile is incomplete. Cannot match.", true);
                }
            }).catch(e => {
                 console.error("Error fetching current user data:", e);
                 showMessage("Failed to load user data. Logging out...", true);
                 setTimeout(() => window.location.href = "index.html", 2000); 
            });
        } else {
            window.location.href = "index.html";
        }
    });
});