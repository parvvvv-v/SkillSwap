// firebase_config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

// Use one consistent config (I'll use the signup one since it includes Firestore)
const firebaseConfig = {
  apiKey: "AIzaSyCcDIzEA8WjPU4z9wt_qNbd4C7gtmP9xOg",
  authDomain: "skillswap-dd970.firebaseapp.com",
  projectId: "skillswap-dd970",
  storageBucket: "skillswap-dd970.appspot.com",
  messagingSenderId: "1017956892616",
  appId: "1:1017956892616:web:f48cce6218eed280434afd",
  measurementId: "G-SZHT2Q03XN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export for usage in modules
export { app, auth, db };
