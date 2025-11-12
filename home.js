import { auth, db } from "./firebase_config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function() {
    
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    const logoutBtn = document.getElementById('logout-btn');
    const findTutorBtn = document.getElementById('find-tutor-btn');
    
    const defaultAvatarUrl = 'https://placehold.co/30x30/ff7d2a/ffffff?text=U';

    /**
     * Fetches user data from Firestore and updates the header elements.
     * @param {string} uid The current user's unique ID.
     */

    async function loadUserHeaderData(uid) {
        try {
            const userDocRef = doc(db, "users", uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userNameElement) userNameElement.textContent = userData.username || 'User';
                if (userAvatarElement) userAvatarElement.src = userData.avatarUrl || defaultAvatarUrl;
            } else {
                if (userNameElement) userNameElement.textContent = 'User';
                console.log("User data not found in Firestore.");
            }
        } catch (error) {
            console.error("Error loading user data:", error);
            if (userNameElement) userNameElement.textContent = 'User';
            if (userAvatarElement) userAvatarElement.src = defaultAvatarUrl;
        }
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadUserHeaderData(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(event) {
            event.preventDefault();
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error("Logout failed:", error);
                console.log("Logout failed. Please try again.");
            });
        });
    }

    if (findTutorBtn) {
        findTutorBtn.addEventListener('click', () => {
            window.location.href = `tutor_match.html`;
        });
    }
});