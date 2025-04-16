import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc,
  updateDoc 
} from "firebase/firestore";
import axios from 'axios'; // Axios for ImgBB API requests

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ==================== CORE FUNCTIONS ====================

/**
 * Saves user data to Firestore
 */
export const saveUserToFirestore = async (user, additionalData = {}) => {
  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: user.email,
    displayName: additionalData.displayName || user.displayName || "",
    photoURL: additionalData.photoURL || user.photoURL || null, // Store photoURL in Firestore
    createdAt: new Date(),
    lastLoginAt: new Date(),
    ...additionalData,
  }, { merge: true });
};

// ==================== AUTHENTICATION ====================

export const signUpWithEmail = async (email, password, displayName, file, additionalData = {}) => {
  try {
    // Step 1: Create User
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }

    // Step 2: Upload the profile picture (ImgBB)
    const imageURL = await uploadImageToImgBB(file);

    // Step 3: Update user profile in Firebase Authentication with the ImgBB URL
    await updateProfile(userCredential.user, { photoURL: imageURL });

    // Step 4: Save the user's data in Firestore with the photoURL
    await saveUserToFirestore(userCredential.user, { photoURL: imageURL, ...additionalData });

    return userCredential.user;
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await saveUserToFirestore(userCredential.user);
    return userCredential.user;
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await saveUserToFirestore(result.user);
    return result.user;
  } catch (error) {
    console.error("Google sign in error:", error);
    throw error;
  }
};

// ==================== PROFILE MANAGEMENT ====================

export const updateUserProfile = async (updates) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");
    
    await updateProfile(user, updates);
    await saveUserToFirestore(user, updates);
    return user;
  } catch (error) {
    console.error("Profile update error:", error);
    throw error;
  }
};

export const updateUserPassword = async (newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error("Password update error:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

// ==================== PROFILE PICTURE HANDLING ====================

/**
 * Upload image to ImgBB and get the URL
 */
export const uploadImageToImgBB = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.REACT_APP_IMGBB_API_KEY}`, // Use the API key from .env
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data.url; // ImgBB returns the image URL here
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    throw new Error('Failed to upload image to ImgBB');
  }
};

/**
 * Update the user's profile picture with the ImgBB URL
 */
export const updateProfilePicture = async (file) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");

    // Upload to ImgBB
    const imageURL = await uploadImageToImgBB(file);

    // Update profile with the ImgBB URL
    await updateProfile(user, {
      photoURL: imageURL, // This stores the URL in Firebase Authentication
    });

    // Optionally, store the URL in Firestore as well
    await saveUserToFirestore(user, { photoURL: imageURL });

    return imageURL;
  } catch (error) {
    console.error("Profile picture update failed:", error);
    throw error;
  }
};

/**
 * Remove profile picture
 */
export const removeProfilePicture = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No user signed in");

    // Update profile to remove picture
    await updateProfile(user, {
      photoURL: "",
    });

    // Optionally, remove the photo from Firestore
    await saveUserToFirestore(user, { photoURL: "" });

    return true;
  } catch (error) {
    console.error("Failed to remove profile picture:", error);
    throw error;
  }
};
