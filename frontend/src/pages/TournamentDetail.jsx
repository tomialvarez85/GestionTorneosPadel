import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import { Calendar, Users, Trophy, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import TournamentBracket from "../components/TournamentBracket";

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token, API } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [matches, setMatches] = useState({});
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tournament
        const tournamentRes = await fetch(`${API}/tournaments/${id}`);
        if (!tournamentRes.ok) {
          toast.error("Torneo no encontrado");
          navigate("/tournaments");
          return;
        }
        const tournamentData = await tournamentRes.json();
        setTournament(tournamentData);

        // Fetch registrations
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const registrationsRes = await fetch(`${API}/tournaments/${id}/registrations`, {
          credentials: "include",
          headers,
        });
        if (registrationsRes.ok) {
          const regData = await registrationsRes.json();
          setRegistrations(regData);
        }

        // Check if user is registered
        if (user) {
          const checkRes = await fetch(`${API}/registrations/check/${id}`, {
            credentials: "include",
            headers,
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            setIsRegistered(checkData.is_registered);
          }
        }

        // Fetch matches if tournament has started
        if (tournamentData.status === "in_progress" || tournamentData.status === "finished") {
          const matchesRes = await fetch(`${API}/tournaments/${id}/matches`);
          if (matchesRes.ok) {
            const matchesData = await matchesRes.json();
            setMatches(matchesData);
          }
        }
      } catch (error) {
        console.error("Error fetching tournament:", error);
        toast.error("Error al cargar el torneo");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, token, API, navigate]);

  const handleRegister = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para inscribirte");
      navigate("/login", { state: { from: { pathname: `/tournaments/${id}` } } });
      return;
    }

    setRegistering(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(`${API}/tournaments/${id}/register`, {
        method: "POST",
        credentials: "include",
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al inscribirse");
      }

      setIsRegistered(true);
      setTournament((prev) => ({
        ...prev,
        current_registrations: prev.current_registrations + 1,
      }));
      setRegistrations((prev) => [
        ...prev,
        {
          user_id: user.user_id,
          user_name: `${user.first_name} ${user.last_name}`,
          registered_at: new Date().toISOString(),
        },
      ]);
      toast.success("¡Inscripción exitosa!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegistration = async () => {
    setRegistering(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API}/tournaments/${id}/register`, {
        method: "DELETE",
        credentials: "include",
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al cancelar inscripción");
      }

      setIsRegistered(false);
      setTournament((prev) => ({
        ...prev,
        current_registrations: prev.current_registrations - 1,
      }));
      setRegistrations((prev) => prev.filter((r) => r.user_id !== user.user_id));
      toast.success("Inscripción cancelada");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRegistering(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      open: "status-open",
      closed: "status-closed",
      in_progress: "status-in_progress",
      finished: "status-finished",
    };
    const labels = {
      open: "Abierto",
      closed: "Cerrado",
      in_progress: "En Progreso",
      finished: "Finalizado",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Cargando torneo...</div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return null;
  }

  const hasBracket = Object.values(matches).some((round) => round.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-6 py-8">
        {/* Back Button */}
        <Link
          to="/tournaments"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="back-to-tournaments-btn"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Torneos
        </Link>

        {/* Tournament Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary text-sm font-medium rounded-full mb-3">
                {tournament.category}
              </span>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-secondary">
                {tournament.name}
              </h1>
            </div>
            {getStatusBadge(tournament.status)}
          </div>

          {tournament.description && (
            <p className="text-muted-foreground max-w-2xl">{tournament.description}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tournament Info */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-3 gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha</p>
                      <p className="font-medium">
                        {new Date(tournament.date).toLocaleDateString("es-AR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Inscriptos</p>
                      <p className="font-medium">
                        {tournament.current_registrations} / {tournament.max_capacity}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Categoría</p>
                      <p className="font-medium">{tournament.category}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bracket */}
            {hasBracket && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="font-heading">Cuadro del Torneo</CardTitle>
                </CardHeader>
                <CardContent>
                  <TournamentBracket matches={matches} />
                </CardContent>
              </Card>
            )}

            {/* Registrations List */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-heading">
                  Jugadores Inscriptos ({registrations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {registrations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aún no hay jugadores inscriptos
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {registrations.map((reg, index) => (
                      <div
                        key={reg.user_id || index}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          reg.user_id === user?.user_id
                            ? "bg-primary/10 border border-primary/20"
                            : "bg-muted/50"
                        }`}
                        data-testid={`registration-${reg.user_id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                          <span className="font-medium text-secondary">
                            {reg.user_name?.charAt(0) || "?"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{reg.user_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(reg.registered_at).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        {reg.user_id === user?.user_id && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <Card className="border-border sticky top-6">
              <CardContent className="p-6">
                <h3 className="font-heading font-semibold text-lg mb-4">Inscripción</h3>

                {/* Capacity Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Cupos disponibles</span>
                    <span className="font-medium">
                      {tournament.max_capacity - tournament.current_registrations}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (tournament.current_registrations / tournament.max_capacity) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {tournament.status === "open" ? (
                  isRegistered ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Ya estás inscripto</span>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-lg"
                        onClick={handleCancelRegistration}
                        disabled={registering}
                        data-testid="cancel-registration-btn"
                      >
                        {registering ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Cancelando...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancelar Inscripción
                          </>
                        )}
                      </Button>
                    </div>
                  ) : tournament.current_registrations >= tournament.max_capacity ? (
                    <div className="text-center py-4">
                      <p className="text-amber-600 font-medium">Torneo completo</p>
                      <p className="text-sm text-muted-foreground">No hay cupos disponibles</p>
                    </div>
                  ) : (
                    <Button
                      className="w-full rounded-lg h-12"
                      onClick={handleRegister}
                      disabled={registering}
                      data-testid="register-tournament-btn"
                    >
                      {registering ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Inscribiendo...
                        </>
                      ) : (
                        "Inscribirme"
                      )}
                    </Button>
                  )
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">
                      {tournament.status === "finished"
                        ? "Este torneo ha finalizado"
                        : "Las inscripciones están cerradas"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* APA Points Info */}
            <Card className="border-border bg-secondary text-white">
              <CardContent className="p-6">
                <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent" />
                  Puntos APA
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Campeón</span>
                    <span className="font-bold">1000 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Finalista</span>
                    <span className="font-bold">600 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Semifinalista</span>
                    <span className="font-bold">360 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Cuartos</span>
                    <span className="font-bold">180 pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Octavos</span>
                    <span className="font-bold">90 pts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
