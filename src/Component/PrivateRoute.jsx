import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";

const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        // Only add ?redirect= for chat room join links
        if (location.pathname.startsWith("/chat/")) {
          navigate(`/sign-up?redirect=${encodeURIComponent(location.pathname)}`);
        } else {
          navigate("/sign-up");
        }
      }
    });

    return () => unsubscribe();
  }, [navigate, location]);

  return auth.currentUser ? children : null;
};

export default PrivateRoute;