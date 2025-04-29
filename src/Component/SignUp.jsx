import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signUpWithEmail } from "../firebase"; // Ensure you import the firebase methods
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [authError, setAuthError] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAuthError("");

    // Validate image file type
    if (!file.type.match('image.(jpeg|jpg|png)')) {
      setAuthError("Please select a valid image (JPEG/PNG only)");
      return;
    }

    // Validate image file size (5MB limit in code comment is an error; message still says 2MB)
    if (file.size > 5 * 1024 * 1024) {
      setAuthError("Image size must be less than 2MB");
      return;
    }

    try {
      setIsUploading(true);

      // Upload image to ImgBB (you can use your ImgBB API here)
      const imageURL = await uploadImageToImgBB(file);
      setProfilePicUrl(imageURL); // Store the image URL
      toast.success("Profile picture uploaded successfully!"); // Toast notification

    } catch (error) {
      console.error("Image upload error:", error);
      setAuthError("Failed to upload image");
      toast.error("Failed to upload profile picture."); // Toast notification
    } finally {
      setIsUploading(false);
    }
  };

  // Upload image to ImgBB and return the URL
  const uploadImageToImgBB = async (file) => {
    const uploadFormData = new FormData();
    uploadFormData.append('image', file);

    try {
      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${process.env.REACT_APP_IMGBB_API_KEY}`,
        {
          method: "POST",
          body: uploadFormData
        }
      );
      const data = await response.json();
      if (data.success) {
        return data.data.url; // Return the URL of the uploaded image
      } else {
        throw new Error("Image upload failed");
      }
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");

    // Validation checks
    const usernameRegex = /^[a-zA-Z0-9]{1,8}$/; // Only letters and numbers, max 8 characters

    if (!formData.name.trim()) {
      setAuthError("Please enter your full name");
      return;
    }
    if (!usernameRegex.test(formData.name)) {
      setAuthError("Username must be alphanumeric and up to 8 characters only");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setAuthError("Please enter a valid email address");
      return;
    }

    try {
      setIsSubmitting(true);

      // Sign up user with email, password, name, and profile picture URL
      await signUpWithEmail(
        formData.email,
        formData.password,
        formData.name,
        profilePicUrl // Send profilePicUrl to save in Firebase Authentication and Firestore
      );

      // Show success toast and redirect
      toast.success("Account created successfully!");
      navigate("/dashboard");

    } catch (error) {
      console.error("Sign up error:", error);
      switch (error.code) {
        case "auth/email-already-in-use":
          setAuthError("This email is already registered");
          break;
        case "auth/invalid-email":
          setAuthError("Invalid email format");
          break;
        case "auth/weak-password":
          setAuthError("Password must be at least 6 characters");
          break;
        default:
          setAuthError("Account creation failed. Please try again.");
      }
      toast.error(authError || "Account creation failed."); // Toast notification
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dummy handler for joining a room
  const handleJoinRoom = (e) => {
    e.preventDefault();
    // Your logic to join room can be added here.
    toast.info("Join Room functionality is not implemented yet.");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const goBackToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="w-full max-w-md p-10 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col items-center mb-6">
          {/* Profile Picture Preview */}
          <div className="relative mb-4 group">
            <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-gray-200">
              {profilePicUrl ? (
                <img
                  src={profilePicUrl}
                  alt="Profile preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                  <svg
                    className="h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 cursor-pointer transition-colors">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploading || isSubmitting}
              />
            </label>
            {isUploading && (
              <div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>

          <h1 className="text-2xl font-semibold text-gray-800">Create Account</h1>
          <p className="text-gray-500 mt-2 text-center">
            {profilePicUrl ? "Profile picture ready!" : "Add a profile picture (optional)"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div className="relative">
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              required
            />
          </div>
          <div className="relative">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              required
            />
          </div>
          <div className="relative">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              required
            />
          </div>
          <div className="relative">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              required
            />
          </div>
          {authError && (
            <div className="text-red-500 text-sm py-2 px-3 bg-red-50 rounded-md">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading || isSubmitting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 mb-4 flex items-center justify-center gap-2 disabled:opacity-75"
          >
            {(isUploading || isSubmitting) ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isUploading ? "Uploading..." : "Creating Account..."}
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Back Button to Login using the same style as the main buttons */}
        <div className="flex justify-center">
          <button
            onClick={goBackToLogin}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}