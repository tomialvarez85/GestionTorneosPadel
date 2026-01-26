import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import { Calendar, Users, Trophy, ArrowLeft } from "lucide-react";
import TournamentBracket from "../components/TournamentBracket";

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token, API } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [matches, setMatches] = useState({});
  const [loading, setLoading] = useState(true);

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

        // Fetch pairs
        const pairsRes = await fetch(`${API}/tournaments/${id}/pairs`);
        if (pairsRes.ok) {
          const pairsData = await pairsRes.json();
          setPairs(pairsData);
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
  }, [id, API, navigate]);

  const getStatusBadge = (status) => {
    const styles = {
      open: "bg-green-100 text-green-800",
      closed: "bg-yellow-100 text-yellow-800",
      in_progress: "bg-blue-100 text-blue-800",
      finished: "bg-gray-100 text-gray-800",
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
                      <p className="text-sm text-muted-foreground">Parejas</p>
                      <p className="font-medium">
                        {tournament.current_pairs || 0} / {tournament.max_pairs}
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

            {/* Pairs List */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-heading">
                  Parejas Inscriptas ({pairs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pairs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aún no hay parejas inscriptas
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {pairs.map((pair, index) => (
                      <div
                        key={pair.pair_id}
                        className="flex items-center gap-3 p-4 rounded-xl bg-muted/50"
                        data-testid={`pair-${pair.pair_id}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-bold text-primary">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{pair.pair_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {pair.player1_name} & {pair.player2_name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info Card */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-heading font-semibold text-lg mb-4">Información</h3>

                {/* Capacity Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Cupos disponibles</span>
                    <span className="font-medium">
                      {tournament.max_pairs - (tournament.current_pairs || 0)} parejas
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          ((tournament.current_pairs || 0) / tournament.max_pairs) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-center py-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {tournament.status === "open" 
                      ? "Inscripciones gestionadas por administradores"
                      : tournament.status === "finished"
                      ? "Este torneo ha finalizado"
                      : "Torneo en progreso"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* APA Points Info */}
            <Card className="border-border bg-secondary text-white">
              <CardContent className="p-6">
                <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-accent" />
                  Puntos APA
                </h3>
                <p className="text-sm text-slate-300 mb-4">
                  Cada jugador de la pareja recibe los puntos correspondientes
                </p>
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
