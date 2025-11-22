import { auth, db } from "./firebase_config.js"; 
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";


const usernameInput = document.getElementById('username');
const skillsKnownTextarea = document.getElementById('skillsKnown');
const skillsToLearnTextarea = document.getElementById('skillsToLearn');
const avatarPreview = document.getElementById('avatarPreview');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logout-btn'); 
const messageBox = document.getElementById('messageBox');
const openAvatarModalBtn = document.getElementById('openAvatarModalBtn');
const closeAvatarModalBtn = document.getElementById('closeAvatarModalBtn');
const avatarModalOverlay = document.getElementById('avatarModalOverlay');
const avatarGrid = document.getElementById('avatarGrid');

let currentUserId = null;
let unsubscribeProfile = null;

const AVATAR_OPTIONS = [
    'https://i.ibb.co/BHJX7Wds/B1.jpg', 
    'https://i.ibb.co/Y7HQddN6/B2.jpg', 
    'https://i.ibb.co/whpQrKSg/B3.jpg',
    'https://i.ibb.co/XNDN1nn/G1.jpg', 
    'https://i.ibb.co/FktjwR0n/G2.jpg', 
];

function cleanAndSplitSkills(skillsString) {
    if (!skillsString) return [];
    return skillsString
        .split(/[,\s]+/)
        .map(skill => skill.toLowerCase().trim()) 
        .filter(skill => skill.length > 0) 
        .map(skill => skill.charAt(0).toUpperCase() + skill.slice(1)); 
}


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

async function loadProfile(uid) {
    const userDocRef = doc(db, "users", uid);

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            usernameInput.value = data.username || '';
            skillsKnownTextarea.value = Array.isArray(data.skillsKnown) ? data.skillsKnown.join(', ') : data.skillsKnown || '';
            skillsToLearnTextarea.value = Array.isArray(data.skillsToLearn) ? data.skillsToLearn.join(', ') : data.skillsToLearn || '';
            
            const avatarUrl = data.avatarUrl || AVATAR_OPTIONS[0];
            avatarPreview.src = avatarUrl;
            avatarPreview.dataset.selectedUrl = avatarUrl;

        } else {
            await setDoc(userDocRef, {
                username: '',
                skillsKnown: [],
                skillsToLearn: [],
                avatarUrl: AVATAR_OPTIONS[0], // Uses new default
                createdAt: new Date().toISOString()
            }, { merge: true });
            avatarPreview.src = AVATAR_OPTIONS[0];
            avatarPreview.dataset.selectedUrl = AVATAR_OPTIONS[0];
            showMessage("Welcome! Please complete your profile.", false);
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        showMessage("Failed to load profile data. Please refresh.", true);
    }
}

async function saveProfile(event) {
    event.preventDefault();
    if (!currentUserId) {
        showMessage("You must be logged in to save your profile.", true);
        return;
    }
    
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    const newUsername = usernameInput.value.trim();
    const rawSkillsKnown = skillsKnownTextarea.value.trim();
    const rawSkillsToLearn = skillsToLearnTextarea.value.trim();
    const selectedAvatarUrl = avatarPreview.dataset.selectedUrl;

    if (!newUsername) {
        showMessage("Username cannot be empty.", true);
        saveBtn.textContent = 'Save Changes';
        saveBtn.disabled = false;
        return;
    }

    const skillsKnownArray = cleanAndSplitSkills(rawSkillsKnown);
    const skillsToLearnArray = cleanAndSplitSkills(rawSkillsToLearn);
    
    try {
        const userDocRef = doc(db, "users", currentUserId);
        await updateDoc(userDocRef, {
            username: newUsername,
            skillsKnown: skillsKnownArray, 
            skillsToLearn: skillsToLearnArray,
            avatarUrl: selectedAvatarUrl
        });
        
        showMessage("Profile saved successfully!", false);

    } catch (error) {
        console.error("Error saving profile:", error);
        showMessage("Failed to save profile. Please try again.", true);
    } finally {
        saveBtn.textContent = 'Save Changes';
        saveBtn.disabled = false;
    }
}


function renderAvatarOptions() {
    avatarGrid.innerHTML = '';
    const currentSelectedUrl = avatarPreview.dataset.selectedUrl;

    AVATAR_OPTIONS.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Avatar Option';
        img.classList.add('avatar-option');
        if (url === currentSelectedUrl) {
            img.classList.add('selected');
        }

        img.addEventListener('click', () => {
            avatarGrid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            img.classList.add('selected');
            
            avatarPreview.src = url;
            avatarPreview.dataset.selectedUrl = url;
            
            hideModal();
        });

        avatarGrid.appendChild(img);
    });
}

function showModal() {
    renderAvatarOptions(); 
    avatarModalOverlay.classList.add('show');
}

function hideModal() {
    avatarModalOverlay.classList.remove('show');
}

openAvatarModalBtn.addEventListener('click', showModal);
closeAvatarModalBtn.addEventListener('click', hideModal);
avatarModalOverlay.addEventListener('click', (event) => {
    if (event.target === avatarModalOverlay) {
        hideModal();
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', function(event) {
        event.preventDefault();
        signOut(auth).then(() => {
            if (unsubscribeProfile) unsubscribeProfile(); 
            console.log("Logged out successfully.");
            window.location.href = 'index.html'; 
        }).catch((error) => {
            console.error("Logout failed:", error);
            showMessage("Logout failed. Please try again.", true);
        });
    });
}

document.getElementById('profileForm').addEventListener('submit', saveProfile);


onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadProfile(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});
