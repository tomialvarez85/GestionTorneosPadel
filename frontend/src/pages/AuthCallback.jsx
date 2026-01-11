import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { login, API } = useAuth();

  useEffect(() => {
    // Use useRef to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = window.location.hash;
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];

        if (!sessionId) {
          toast.error("No se encontró sesión de autenticación");
          navigate("/login", { replace: true });
          return;
        }

        // Exchange session_id for user data and session token
        const response = await fetch(`${API}/auth/session`, {
          method: "GET",
          credentials: "include",
          headers: {
            "X-Session-ID": sessionId,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Error de autenticación");
        }

        const userData = await response.json();
        
        // Login with user data
        login(userData, null); // Cookie-based auth, no token needed
        
        toast.success(`¡Bienvenido, ${userData.first_name || userData.name}!`);
        
        // Navigate to dashboard with user data to skip auth check
        navigate("/dashboard", { 
          replace: true,
          state: { user: userData }
        });

      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error(error.message || "Error al procesar autenticación");
        navigate("/login", { replace: true });
      }
    };

    processAuth();
  }, [API, login, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Procesando autenticación...</p>
      </div>
    </div>
  );
}
