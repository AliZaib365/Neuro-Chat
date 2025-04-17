import Auth from "./Auth";
import { useState, useEffect } from "react";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center text-center px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-24 w-24 text-gray-400 mb-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.53 16.11a4.5 4.5 0 016.94 0M5.42 13.42a9 9 0 0113.16 0M2.34 10.65a13.5 13.5 0 0119.32 0M12 20h.01M12 20a.75.75 0 10-.01 0z"
          />
        </svg>
        <h1 className="text-2xl font-semibold text-white mb-2">You're Offline</h1>
        <p className="text-gray-400 text-sm max-w-sm">
          It looks like your internet connection is lost. Please check your Wi-Fi or network and try again.
        </p>
        <div className="mt-8">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="App">
      {/* Add ToastContainer here - this is the only change */}
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <Auth />
    </div>
  );
}

export default App;