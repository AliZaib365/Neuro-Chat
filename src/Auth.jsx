import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, signInWithGoogle } from "./firebase";
import ChatBox from "./Component/ChatBox";
import { ChatRoom } from "./Component/ChatRoom";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import SignUp from "./Component/SignUp"; // Make sure this path is correct

function App() {
  const [user, loading] = useAuthState(auth);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    setIsAuthChecked(true);
  }, [loading]);

  useEffect(() => {
    if (!isAuthChecked) return;

    if (!user && location.pathname !== "/" && location.pathname !== "/sign-in") {
      navigate("/", { replace: true });
    }

    if (user && (location.pathname === "/" || location.pathname === "/sign-in")) {
      navigate("/box", { replace: true });
    }

    if (user) {
      const isOnBox = location.pathname === "/box";
      const isOnChat = location.pathname.startsWith("/chat/");
      if (!isOnBox && !isOnChat) {
        navigate("/box", { replace: true });
      }
    }
  }, [isAuthChecked, user, location.pathname, navigate]);

  if (!isAuthChecked) {
    return null;
  }

  // Handle email login
  const handleEmailSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAuthError("");
    } catch (error) {
      setAuthError("Invalid email or password");
    }
  };

  // Navigate to sign-in page when "Create Account" is clicked
  const navigateToSignIn = () => {
    navigate("/sign-in");
  };

  // Login Screen
  if (!user && location.pathname === "/") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="w-full max-w-md p-10 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col items-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h1 className="text-2xl font-semibold mt-4 text-gray-800">Professional Chat</h1>
            <p className="text-gray-500 mt-2 text-center">Secure enterprise messaging platform</p>
          </div>

          {/* Custom Email/Password Login Form */}
          <div className="space-y-4 mb-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-400"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-400"
            />
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleEmailSignIn}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
            >
              Sign In
            </button>
            <button
              onClick={navigateToSignIn}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 transition duration-200"
            >
              Create Account
            </button>
          </div>

          <div className="my-4 text-center text-sm text-gray-400">or</div>

          <button
            onClick={signInWithGoogle}
            className="w-full px-6 py-3 bg-white text-gray-700 rounded-md hover:bg-gray-50 flex items-center justify-center gap-3 transition duration-200 border border-gray-300 shadow-sm"
          >
            <img
              src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
              alt="Google logo"
              className="w-5 h-5"
            />
            <span className="font-medium">Continue with Google</span>
          </button>

          
        </div>
      </div>
    );
  }

  // Authenticated User View
  return (
    <div className="bg-gray-50 min-h-screen">
      <Routes>
        <Route path="/sign-in" element={<SignUp />} />
        <Route path="/box" element={<ChatBox />} />
        <Route path="/chat/:roomId" element={<ChatRoom />} />
        <Route path="*" element={<Navigate to={user ? "/box" : "/"} replace />} />
      </Routes>
    </div>
  );
}

export default App;