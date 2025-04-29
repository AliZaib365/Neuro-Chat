import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { signOut, updatePassword, updateProfile } from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { db, uploadImageToImgBB } from "../firebase";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ChatBox() {
  const [shareableLink, setShareableLink] = useState(null);
  const [userFullName, setUserFullName] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const modalRef = useRef(null);

  // Validate group name
  const validateGroupName = (name) => {
    if (!name.trim()) {
      return "Please enter a group name";
    }
    
    // Check for special characters using regex
    const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    if (specialChars.test(name)) {
      return "Group name cannot contain special characters";
    }
    
    return null;
  };

  // Fetch user data from Firestore
  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userDoc.exists()) {
            setUserFullName(
              userDoc.data().displayName ||
              auth.currentUser.displayName ||
              "User"
            );
            if (userDoc.data().photoBase64) {
              setProfilePicUrl(userDoc.data().photoBase64);
            }
          } else {
            setUserFullName(auth.currentUser.displayName || "User");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUserFullName(auth.currentUser.displayName || "User");
        }
      }
    };

    fetchUserData();
  }, []);

  // Close dropdown and modals when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        (showPasswordModal || showNameModal)
      ) {
        setShowPasswordModal(false);
        setShowNameModal(false);
        setPasswordError("");
        setNameError("");
        setNewPassword("");
        setConfirmPassword("");
        setNewDisplayName("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPasswordModal, showNameModal]);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Clear created room ID on mount
  useEffect(() => {
    localStorage.removeItem("createdRoomId");
    setCreatedRoomId(null);
  }, []);

  const handleUpdateName = async (e) => {
    e.preventDefault();
  
    // Trim and validate name
    const trimmedName = newDisplayName.trim();
    
    if (!trimmedName) {
      setNameError("Name cannot be empty");
      return;
    }
  
    // Check for special characters (only allow letters, numbers, and spaces)
    if (/[^a-zA-Z0-9 ]/.test(trimmedName)) {
      setNameError("Name cannot contain special characters");
      return;
    }
  
    try {
      setIsUpdatingName(true);
      const user = auth.currentUser;
  
      // Update in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        displayName: trimmedName
      });
  
      // Update in Auth
      await updateProfile(user, {
        displayName: trimmedName
      });
  
      // Update local state
      setUserFullName(trimmedName);
      setShowNameModal(false);
      setNewDisplayName("");
      
      // Show success toast
      toast.success("Name updated successfully! ✅", {
        position: "top-center",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error updating name:", error);
      setNameError(error.message);
      toast.error("Failed to update name ❌", {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy link.");
    });
  };

  const handleCreateRoom = async () => {
    const validationError = validateGroupName(groupName);
    if (validationError) {
      setJoinError(validationError);
      return;
    }

    setCreating(true);
    setJoinError("");

    try {
      // Check if a room with this name already exists
      const roomsRef = collection(db, "rooms");
      const q = query(roomsRef, where("name", "==", groupName.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setJoinError("A room with this name already exists");
        setCreating(false);
        return;
      }

      const roomId = uuidv4().slice(0, 8);
      await setDoc(doc(db, "rooms", roomId), {
        name: groupName.trim(),
        createdAt: serverTimestamp(),
      });
      setCreatedRoomId(roomId);
      localStorage.setItem("createdRoomId", roomId);

      // Construct the shareable link.
      // This link will be used to directly join the room. If the user is logged in, they go directly into the room.
      // Otherwise, they are redirected to login first, with the redirect query parameter set.
      const link = `${window.location.origin}/chat/${roomId}`;
      setShareableLink(link);
      setShowLinkModal(true);

      toast.success("Room created successfully!", {
        position: "top-center",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error creating room:", error);
      setJoinError("Failed to create room. Please try again.");
      toast.error("Failed to create room", {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setJoinError("");

    const roomId = e.target.elements.roomId.value.trim();
    if (!roomId) return;

    try {
      const docRef = doc(db, "rooms", roomId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // If the user is not logged in, redirect to login with the redirect set to the chat room.
        if (!auth.currentUser) {
          navigate(`/login?redirect=/chat/${roomId}`);
        } else {
          navigate(`/chat/${roomId}`);
        }
        toast.success("Joined room successfully!", {
          position: "top-center",
          autoClose: 3000,
        });
      } else {
        setJoinError("Invalid Room ID. Room does not exist.");
        toast.error("Room not found", {
          position: "top-center",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error checking room:", error);
      setJoinError("Something went wrong. Please try again.");
      toast.error("Failed to join room", {
        position: "top-center",
        autoClose: 3000,
      });
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    setSearchResult(null);
    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) {
      setSearching(false);
      return;
    }

    try {
      const matches = [];

      const docRef = doc(db, "rooms", trimmedSearch);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        matches.push({ id: docSnap.id, name: docSnap.data().name });
      }

      const roomsRef = collection(db, "rooms");
      const q = query(
        roomsRef,
        where("name", ">=", trimmedSearch),
        where("name", "<=", trimmedSearch + "\uf8ff")
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        if (!matches.find((match) => match.id === doc.id)) {
          matches.push({ id: doc.id, name: doc.data().name });
        }
      });

      setSearchResult(matches);
      if (matches.length === 0) {
        toast.info("No rooms found matching your search", {
          position: "top-center",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResult([]);
      toast.error("Search failed", {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleProfilePicUpdate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUpdatingProfile(true);
      const user = auth.currentUser;

      // Upload to ImgBB
      const imageURL = await uploadImageToImgBB(file);

      // Update Firebase Auth profile
      await updateProfile(user, { photoURL: imageURL });

      // Update Firestore
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: imageURL,
        photoBase64: null,
      });

      // Update local state
      setProfilePicUrl(imageURL);
      
      // Show success toast
      toast.success("Profile picture updated!", {
        position: "top-center",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error updating profile picture:", error);
      setJoinError("Failed to update profile picture");
      toast.error("Failed to update profile picture", {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // This function handles the "Enter Room" action from the shareable link modal.
  const navigateToChat = () => {
    if (!auth.currentUser) {
      // Redirect to login page with redirect query parameter pointing to the room.
      navigate(`/login?redirect=/chat/${createdRoomId}`);
    } else {
      navigate(`/chat/${createdRoomId}`);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const user = auth.currentUser;
      await updatePassword(user, newPassword);
      setPasswordError("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
      
      // Show success toast
      toast.success("Password updated successfully!", {
        position: "top-center",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error updating password:", error);
      setPasswordError(error.message);
      toast.error("Failed to update password", {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <p className="text-white text-lg">You're offline</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-gray-50 p-6">
      <ToastContainer position="top-center" autoClose={3000} />
      {/* Profile Dropdown */}
      <div className="absolute top-4 right-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none"
          >
            <img
              src={
                profilePicUrl ||
                auth.currentUser?.photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(userFullName || "U")}`
              }
              alt="User profile"
              className="w-9 h-9 rounded-full border border-gray-300 object-cover"
              onError={(e) => {
                e.target.src = "https://ui-avatars.com/api/?name=U&background=random";
              }}
            />
            <span className="text-sm font-medium text-gray-800 whitespace-nowrap max-w-[120px] truncate hidden sm:inline-block">
              {userFullName}
            </span>
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                <p className="font-medium">{userFullName}</p>
                <p className="text-gray-500 text-xs truncate">{auth.currentUser?.email}</p>
              </div>
              <button
                onClick={() => fileInputRef.current.click()}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                {isUpdatingProfile ? "Updating..." : "Update Profile Pic"}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePicUpdate}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => {
                  setShowNameModal(true);
                  setShowDropdown(false);
                  setNewDisplayName(userFullName);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Display Name
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(true);
                  setShowDropdown(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Reset Password
              </button>
              <button
                onClick={() => signOut(auth)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Name Update Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md" ref={modalRef}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Update Display Name</h3>
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setNameError("");
                  setNewDisplayName("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateName}>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                    required
                  />
                </div>
                {nameError && (
                  <p className="text-sm text-red-600">{nameError}</p>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNameModal(false);
                      setNameError("");
                      setNewDisplayName("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingName}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isUpdatingName ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : "Update Name"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md" ref={modalRef}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Reset Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handlePasswordReset}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordError("");
                      setNewPassword("");
                      setConfirmPassword("");
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isUpdatingPassword ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : "Update Password"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h1 className="text-2xl font-semibold text-gray-800 mt-4">Professional Chat</h1>
          <p className="text-gray-500 mt-1">Secure communication platform</p>
        </div>

        {/* Search Section */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 w-full max-w-2xl mx-auto">
          <h2 className="text-lg font-medium text-gray-700 mb-3">Find a Room</h2>
          <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
            <input
              type="text"
              placeholder="Search by Room ID or Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {searching ? (
                <span className="inline-flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Searching
                </span>
              ) : (
                'Search'
              )}
            </button>
          </div>
          {searchResult && (
            <div
              className={`mt-3 ${searchResult.length > 0 ? 'bg-blue-50' : 'bg-red-50'} p-3 rounded-md border ${searchResult.length > 0 ? 'border-blue-200' : 'border-red-200'}`}
            >
              {searchResult.length > 0 ? (
                <>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Matching Rooms:</h3>
                  <ul className="space-y-2">
                    {searchResult.map((room) => (
                      <li
                        key={room.id}
                        className="p-2 hover:bg-blue-100 rounded-md cursor-pointer transition-colors"
                        onClick={() => navigate(`/chat/${room.id}`)}
                      >
                        <div className="font-semibold text-blue-600">{room.name}</div>
                        <div className="text-xs text-gray-500 font-mono">ID: {room.id}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-red-600">No rooms found matching your search</p>
              )}
            </div>
          )}
        </div>

        {/* Room Management Section */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 space-y-4">
          <h2 className="text-lg font-medium text-gray-700">Room Management</h2>
          <div>
            <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
              Group Name
            </label>
            <input
              type="text"
              id="groupName"
              value={groupName}
              onChange={(e) => {
                const value = e.target.value;
                const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
                if (!specialChars.test(value)) {
                  setGroupName(value);
                }
              }}
              placeholder="Enter group name (no special characters)"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              required
            />
          </div>
          <button
            onClick={handleCreateRoom}
            disabled={creating}
            className={`w-full py-2.5 px-4 rounded-md text-white font-medium flex items-center justify-center ${creating ? 'bg-green-500' : 'bg-green-600 hover:bg-green-700'} transition-colors`}
          >
            {creating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Room...
              </>
            ) : "Create New Room"}
          </button>
          {joinError && (
            <p className="text-sm text-red-600 text-center">{joinError}</p>
          )}
          <form onSubmit={handleJoinRoom} className="space-y-3">
            <div>
              <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-1">
                Join Existing Room
              </label>
              <input
                type="text"
                id="roomId"
                name="roomId"
                placeholder="Enter Room ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>

      {/* Shareable Link Modal */}
      {showLinkModal && shareableLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Room Created Successfully!</h3>
            <p className="text-sm text-gray-700 mb-3">Share this link with participants. When they click it, they will join the room automatically. If they're not logged in, they'll be prompted to log in first.</p>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                readOnly
                value={shareableLink}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => copyToClipboard(shareableLink)}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={navigateToChat}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Enter Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}