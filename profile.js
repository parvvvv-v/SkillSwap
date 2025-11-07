import { auth, db } from "./firebase_config.js"; 
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
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
    'G1.jpg',
    'G2.jpg',
    'B1.jpg', 
    'B2.jpg', 
    'B3.jpg', 
];

const DEFAULT_AVATAR = AVATAR_OPTIONS[0];

function showMessage(msg) {
    messageBox.textContent = msg;
    messageBox.classList.add('show');
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 3000);
}

function setButtonState(btn, text, isDisabled) {
    btn.innerHTML = isDisabled ? '<i class="fas fa-spinner fa-spin"></i> Saving...' : text;
    btn.disabled = isDisabled;
    btn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadUserProfile(currentUserId);
    } else {
        window.location.href = 'index.html';
    }
});

async function loadUserProfile(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        
        let avatarUrl = DEFAULT_AVATAR;

        if (userDoc.exists()) {
            const userData = userDoc.data();
            usernameInput.value = userData.username || '';
            skillsKnownTextarea.value = userData.skillsKnown || '';
            skillsToLearnTextarea.value = userData.skillsToLearn || '';

            if (userData.avatarUrl && AVATAR_OPTIONS.includes(userData.avatarUrl)) {
                avatarUrl = userData.avatarUrl;
            } else if (userData.avatarUrl) {
                avatarUrl = userData.avatarUrl;
            }
        } 
        
        avatarPreview.src = avatarUrl;
        avatarPreview.dataset.selectedUrl = avatarUrl; 

    } catch (error) {
        console.error("Error loading user profile:", error);
        showMessage("Error loading profile data.");
    }
}

document.getElementById('profileForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    if (!currentUserId) {
        showMessage("User not authenticated. Please log in again.");
        return;
    }

    setButtonState(saveBtn, '<i class="fas fa-save"></i> Save Changes', true);

    try {
        const avatarUrl = avatarPreview.dataset.selectedUrl;
        
        const userDocRef = doc(db, "users", currentUserId);
        
        const profileData = {
            username: usernameInput.value.trim(),
            skillsKnown: skillsKnownTextarea.value.trim(),
            skillsToLearn: skillsToLearnTextarea.value.trim(),
            avatarUrl: avatarUrl
        };
        
        await setDoc(userDocRef, profileData, { merge: true });

        showMessage("Profile updated successfully!");

    } catch (error) {
        console.error("Error updating profile:", error);
        showMessage("Failed to update profile. Check console for details.");
    } finally {
        setButtonState(saveBtn, '<i class="fas fa-save"></i> Save Changes', false);
    }
});

function renderAvatarOptions() {
    avatarGrid.innerHTML = '';
    const currentSelectedUrl = avatarPreview.dataset.selectedUrl;

    AVATAR_OPTIONS.forEach(url => {
        const isSelected = url === currentSelectedUrl;
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Avatar Option';
        img.className = 'avatar-option';
        
        if (isSelected) {
            img.classList.add('selected');
        }
        
        img.setAttribute('data-url', url);

        img.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(opt => {
                opt.classList.remove('selected');
            });
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
            showMessage("Logout failed. Try again.");
        });
    });
}