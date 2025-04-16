import { auth, db, fileToBase64 } from "../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useParams, useNavigate } from "react-router-dom";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

export function ChatRoom() {
  // Helper function to get random color for usernames
  const getRandomColor = () => {
    const colors = [
      'text-red-700',
      'text-blue-700',
      'text-green-700',
      'text-yellow-700',
      'text-purple-700',
      'text-indigo-700',
      'text-pink-700',
      'text-teal-700',
      'text-orange-700',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // State management
  const [userFullName, setUserFullName] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [user, loading] = useAuthState(auth);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showLockButton, setShowLockButton] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);
  const [audioError, setAudioError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);

  // Refs for DOM elements and instances
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const audioElements = useRef({});
  const recordingStartTimeRef = useRef(0);
  const durationIntervalRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const inputRef = useRef(null);
  const recordingVisualizerRef = useRef(null);
  const animationRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const dropdownRef = useRef(null);
  const [roomName, setRoomName] = useState("");
  const { roomId } = useParams();
  const navigate = useNavigate();
  const messagesRef = collection(db, "rooms", roomId, "messages");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Check browser support for audio formats
  useEffect(() => {
    const checkBrowserSupport = () => {
      try {
        const supportedTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp3',
          'audio/mp4',
          'audio/ogg;codecs=opus'
        ].filter(type => {
          try {
            return MediaRecorder.isTypeSupported(type);
          } catch (e) {
            return false;
          }
        });

        if (supportedTypes.length === 0) {
          setBrowserSupported(false);
          console.warn("Browser doesn't support required audio formats");
        }
      } catch (e) {
        setBrowserSupported(false);
        console.error("Browser media capabilities check failed:", e);
      }
    };

    checkBrowserSupport();
  }, []);
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
            // Store the photoBase64 in state if it exists
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
  useEffect(() => {
    const fetchRoomName = async () => {
      try {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          setRoomName(roomSnap.data().name || "Chat Room");
        } else {
          setRoomName("Chat Room");
        }
      } catch (error) {
        console.error("Error fetching room name:", error);
        setRoomName("Chat Room");
      }
    };

    fetchRoomName();
  }, [roomId]);

  // Format duration in MM:SS format
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Get the best supported MIME type for recording
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp3',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    for (let type of types) {
      try {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch (e) {
        continue;
      }
    }
    return 'audio/webm'; // Default fallback
  };

  // Initialize audio element for a message
  const initializeAudioElement = (message) => {
    if (!message.audioURL || audioElements.current[message.id]) return;

    const audio = new Audio(message.audioURL);
    audio.preload = "metadata";

    audio.onended = () => {
      if (currentlyPlaying === message.id) {
        setCurrentlyPlaying(null);
        setCurrentTime(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
    };

    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      setAudioError(`Could not play audio message from ${message.displayName}`);
      handlePlaybackError(message.id, message.audioURL);
    };

    audioElements.current[message.id] = audio;
  };

  // Handle playback errors with format fallbacks
  const handlePlaybackError = (messageId, audioUrl) => {
    const formats = [
      { type: "audio/webm" },
      { type: "audio/mp3" },
      { type: "audio/mp4" },
      { type: "audio/ogg" }
    ];

    let attempts = 0;
    const tryNextFormat = () => {
      if (attempts >= formats.length) {
        setAudioError("Could not play audio. Try downloading it instead.");
        return;
      }

      const newAudio = new Audio();
      newAudio.src = audioUrl;
      newAudio.type = formats[attempts].type;
      newAudio.preload = "metadata";

      newAudio.onended = () => {
        setCurrentlyPlaying(null);
        setCurrentTime(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };

      newAudio.onerror = () => {
        attempts++;
        tryNextFormat();
      };

      newAudio.play()
        .then(() => {
          audioElements.current[messageId] = newAudio;
          setCurrentlyPlaying(messageId);
          startProgressTracking(messageId, newAudio);
        })
        .catch(() => {
          attempts++;
          tryNextFormat();
        });
    };

    tryNextFormat();
  };

  // Start tracking playback progress
  const startProgressTracking = (messageId, audioElement) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (audioElement && !isNaN(audioElement.duration)) {
        setCurrentTime((audioElement.currentTime / audioElement.duration) * 100);
      }
    }, 100);
  };

  // Load messages and initialize audio elements
  useEffect(() => {
    const q = query(messagesRef, orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messages);

      // Initialize audio elements for new messages
      messages.forEach(message => {
        if (message.audioURL) {
          initializeAudioElement(message);
        }
      });
    });

    return () => {
      unsubscribe();
      // Clean up audio elements
      Object.values(audioElements.current).forEach(audio => {
        audio.pause();
        audio.remove();
      });
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [roomId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        stopRecording();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji.native);
    inputRef.current.focus();
  };

  const startRecording = async () => {
    try {
      if (!browserSupported) {
        alert("Your browser doesn't support audio recording. Please use Chrome, Firefox, or Edge.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;

      const options = {
        mimeType: getSupportedMimeType(),
        audioBitsPerSecond: 128000
      };

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      setRecordingDuration(0);

      // Start visualizer
      const visualizeRecording = () => {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          animationRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);

          if (recordingVisualizerRef.current) {
            const levels = Array.from(dataArray).slice(0, 20);
            const bars = recordingVisualizerRef.current.querySelectorAll('.visualizer-bar');

            levels.forEach((level, i) => {
              if (bars[i]) {
                const height = Math.max(2, level / 2);
                bars[i].style.height = `${height}px`;
                bars[i].style.opacity = `${0.1 + (level / 255) * 0.9}`;
              }
            });
          }
        };

        draw();
      };

      visualizeRecording();

      // Start updating duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
      }, 1000);

      // Show lock button after 1 second
      recordingTimerRef.current = setTimeout(() => {
        setShowLockButton(true);
      }, 1000);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current.mimeType || 'audio/webm'
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        clearInterval(durationIntervalRef.current);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setNewMessage("");
      setAudioError(null);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Microphone access is required for voice messages");
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowLockButton(false);
      setIsLocked(false);

      if (cancel) {
        setAudioURL("");
        setRecordingDuration(0);
      }
    }
  };

  const toggleRecordingLock = () => {
    setIsLocked(!isLocked);
  };

  const togglePlayPause = (messageId) => {
    const audioElement = audioElements.current[messageId];

    if (!audioElement) return;

    if (currentlyPlaying === messageId) {
      audioElement.pause();
      setCurrentlyPlaying(null);
      setCurrentTime(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      // Pause any currently playing audio
      if (currentlyPlaying) {
        const currentAudio = audioElements.current[currentlyPlaying];
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }

      audioElement.currentTime = 0;
      audioElement.play()
        .then(() => {
          setCurrentlyPlaying(messageId);
          startProgressTracking(messageId, audioElement);
        })
        .catch(err => {
          console.error("Error playing audio:", err);
          handlePlaybackError(messageId, audioElement.src);
        });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newMessage.trim() === "" && !audioURL) return;

    try {
      await addDoc(messagesRef, {
        text: newMessage,
        audioURL: audioURL || null,
        duration: recordingDuration,
        timestamp: serverTimestamp(),
        uid: user.uid,
        displayName: user.displayName,
        photoURL:
          user.photoURL ||
          "https://ui-avatars.com/api/?name=" +
          encodeURIComponent(user.displayName || "U") +
          "&background=random",
      });

      setNewMessage("");
      setAudioURL("");
      setRecordingDuration(0);
      setAudioError(null);
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    navigate('/');
  };

  const handleExitRoom = () => {
    navigate('/');
  };

  const downloadAudio = (audioUrl, fileName) => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = fileName || `voice-message-${new Date().toISOString()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Icons for better readability
  const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  );

  const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );

  const DownloadButton = ({ url }) => (
    <button
      onClick={() => downloadAudio(url, `voice-message-${Date.now()}`)}
      className="ml-2 text-gray-500 hover:text-gray-700"
      title="Download voice message"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </button>
  );

  const renderAudioMessage = (message) => (
    <div className={`flex items-center ${message.uid === user.uid ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`flex items-center ${message.uid === user.uid ? 'bg-blue-200' : 'bg-gray-200'} rounded-full px-3 py-2`}>
        <button
          onClick={() => togglePlayPause(message.id)}
          className="focus:outline-none"
          disabled={!browserSupported}
        >
          {currentlyPlaying === message.id ? <PauseIcon /> : <PlayIcon />}
        </button>
        <div className="mx-2 w-24 h-2 bg-white rounded-full overflow-hidden">
          <div
            className={`h-full ${currentlyPlaying === message.id ? 'bg-blue-600' : 'bg-gray-400'}`}
            style={{
              width: currentlyPlaying === message.id ? `${currentTime}%` : '100%',
              transition: 'width 0.1s linear'
            }}
          ></div>
        </div>
        <span className="text-xs text-gray-600">
          {formatDuration(message.duration || 0)}
        </span>
        <DownloadButton url={message.audioURL} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h1 className="text-lg font-semibold text-gray-800">Room Name: {roomName}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExitRoom}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Exit Room
            </button>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-1 focus:outline-none"
              >
                <img
                  src={
                    profilePicUrl || // This will show the Base64 image if available
                    auth.currentUser?.photoURL || // Fallback to auth photoURL
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      userFullName || "U"
                    )}&background=random`
                  }
                  alt="User profile"
                  className="w-8 h-8 rounded-full border border-gray-200"
                  onError={(e) => {
                    e.target.src =
                      "https://ui-avatars.com/api/?name=U&background=random";
                  }}
                />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                    <p className="font-medium">{user.displayName || "User"}</p>
                    <p className="text-gray-500 text-xs">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error message display */}
      {audioError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="ml-3 text-sm text-red-700">{audioError}</p>
            </div>
            <button
              onClick={() => setAudioError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Browser compatibility warning */}
      {!browserSupported && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Your browser has limited audio support. For best results, use Chrome, Firefox, or Edge.
                Voice messages may not work properly in this browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.uid === user.uid ? "justify-end" : "justify-start"
                }`}
            >
              <div
                className={`flex max-w-[85%] ${message.uid === user.uid ? "flex-row-reverse" : ""
                  }`}
              >
                <div
                  className={`relative rounded-lg px-4 py-3 ${message.uid === user.uid
                    ? "bg-blue-100 border border-blue-200"
                    : "bg-gray-50 border border-gray-200"
                    }`}
                >
                  {message.uid !== user.uid && (
                    <span className={`block text-xs font-semibold ${getRandomColor()} mb-1`}>
                      {message.displayName || "Anonymous"}
                    </span>
                  )}

                  {message.text && (
                    <div className="mb-1">
                      <p className="text-gray-800">{message.text}</p>
                    </div>
                  )}

                  {message.audioURL && renderAudioMessage(message)}

                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-500">
                      {message.timestamp?.toDate()?.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      }) || "Just now"}
                    </span>
                    {message.uid === user.uid && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 text-gray-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <img
                      src={
                        profilePicUrl || // This will show the Base64 image if available
                        auth.currentUser?.photoURL || // Fallback to auth photoURL
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          userFullName || "U"
                        )}&background=random`
                      }
                      alt="User profile"
                      className="w-8 h-8 rounded-full border border-gray-200"
                      onError={(e) => {
                        e.target.src =
                          "https://ui-avatars.com/api/?name=U&background=random";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-white border-t border-gray-200 relative"
      >
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-4" ref={emojiPickerRef}>
            <div className="relative">
              <Picker
                data={data}
                onEmojiSelect={addEmoji}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
                perLine={8}
                emojiSize={22}
                emojiButtonSize={32}
              />
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {isRecording && (
          <div className="mb-3 flex items-center justify-between bg-red-50 p-3 rounded-lg">
            <div className="flex items-center space-x-3">
              <div
                ref={recordingVisualizerRef}
                className="flex items-end h-8 space-x-1"
              >
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="visualizer-bar w-1 bg-red-500 rounded-full transition-all duration-100"
                    style={{ height: '2px', opacity: 0.1 }}
                  />
                ))}
              </div>
              <span className="text-sm text-red-600 font-medium">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {showLockButton && (
                <button
                  type="button"
                  onClick={toggleRecordingLock}
                  className={`p-2 rounded-full ${isLocked ? 'bg-red-200 text-red-700' : 'bg-gray-200 text-gray-700'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="p-2 rounded-full bg-red-100 text-red-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>

              {isLocked && (
                <button
                  type="button"
                  onClick={() => stopRecording()}
                  className="p-2 rounded-full bg-red-600 text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {audioURL && !isRecording && (
          <div className="mb-3 flex items-center justify-between bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center">
              <button
                onClick={() => {
                  const audio = new Audio(audioURL);
                  audio.play();
                }}
                className="mr-2 text-blue-600 hover:text-blue-800"
              >
                <PlayIcon />
              </button>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500"></div>
              </div>
              <span className="ml-2 text-xs text-gray-600">
                {formatDuration(recordingDuration)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAudioURL("");
                setRecordingDuration(0);
              }}
              className="text-red-500 hover:text-red-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full"
            disabled={isRecording || !browserSupported}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isRecording ? "Recording voice message..." : "Type your message..."}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isRecording || !browserSupported}
          />

          {!isRecording ? (
            <>
              {/* <button
                type="button"
                onMouseDown={startRecording}
                onTouchStart={startRecording}
                className="p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                disabled={!browserSupported}
                title={!browserSupported ? "Voice messages not supported in this browser" : "Record voice message"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </button> */}

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={(!newMessage.trim() && !audioURL) || isRecording || !browserSupported}
              >
                Send
              </button>
            </>
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">
              {isLocked ? "Slide to cancel" : "Release to send"}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}