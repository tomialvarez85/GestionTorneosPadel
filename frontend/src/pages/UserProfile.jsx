import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { Trophy, Calendar, TrendingUp, ArrowLeft, Medal, Award } from "lucide-react";

export default function UserProfile() {
  const { userId } = useParams();
  const { API } = useAuth();
  const [user, setUser] = useState(null);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user profile
        const userRes = await fetch(`${API}/users/${userId}/profile`);
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }

        // Fetch points history
        const historyRes = await fetch(`${API}/users/${userId}/points-history-public`);
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setPointsHistory(historyData);
        }

        // Fetch ranking to get position
        const rankingRes = await fetch(`${API}/ranking?limit=100`);
        if (rankingRes.ok) {
          const rankingData = await rankingRes.json();
          setRanking(rankingData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, API]);

  const getUserRank = () => {
    const userRank = ranking.find((r) => r.user_id === userId);
    return userRank?.position || "-";
  };

  const getResultBadge = (result) => {
    const styles = {
      champion: "bg-gradient-to-r from-amber-400 to-amber-500 text-white",
      finalist: "bg-gradient-to-r from-slate-300 to-slate-400 text-slate-800",
      semifinalist: "bg-gradient-to-r from-amber-600 to-amber-700 text-white",
      quarterfinalist: "bg-slate-600 text-white",
      round_of_16: "bg-slate-500 text-white",
    };
    const labels = {
      champion: "Campeón",
      finalist: "Finalista",
      semifinalist: "Semifinalista",
      quarterfinalist: "Cuartos",
      round_of_16: "Octavos",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[result] || "bg-muted"}`}>
        {labels[result] || result}
      </span>
    );
  };

  const getResultIcon = (result) => {
    switch (result) {
      case "champion":
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case "finalist":
        return <Medal className="w-5 h-5 text-slate-400" />;
      case "semifinalist":
        return <Award className="w-5 h-5 text-amber-700" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Cargando perfil...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 py-8">
          <div className="text-center py-16">
            <h2 className="font-heading text-2xl font-bold mb-2">Usuario no encontrado</h2>
            <Link to="/ranking" className="text-primary hover:underline">
              Volver al ranking
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-6 py-8">
        {/* Back Button */}
        <Link
          to="/ranking"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Ranking
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* User Info Card */}
          <div className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    {user.picture ? (
                      <img
                        src={user.picture}
                        alt={user.first_name}
                        className="w-24 h-24 rounded-full object-cover"
                      />
                    ) : (
                      <span className="font-heading text-4xl font-bold text-primary">
                        {user.first_name?.charAt(0) || "?"}
                      </span>
                    )}
                  </div>
                  <h1 className="font-heading font-bold text-2xl mb-1">
                    {user.first_name} {user.last_name}
                  </h1>
                  {getUserRank() !== "-" && (
                    <p className="text-muted-foreground">
                      Ranking #{getUserRank()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-heading font-semibold mb-4">Estadísticas</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span className="text-muted-foreground">Puntos Totales</span>
                    </div>
                    <span className="font-heading font-bold text-xl text-amber-600">
                      {user.total_points || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <span className="text-muted-foreground">Torneos Jugados</span>
                    </div>
                    <span className="font-heading font-bold text-xl text-blue-600">
                      {user.tournaments_played || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      <span className="text-muted-foreground">Promedio/Torneo</span>
                    </div>
                    <span className="font-heading font-bold text-xl text-emerald-600">
                      {user.tournaments_played
                        ? Math.round(user.total_points / user.tournaments_played)
                        : 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tournament History */}
          <div className="lg:col-span-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Historial de Torneos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pointsHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="font-heading text-lg font-semibold mb-2">Sin historial</h3>
                    <p className="text-muted-foreground">
                      Este jugador aún no ha participado en torneos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pointsHistory.map((entry, index) => (
                      <div
                        key={entry.history_id || index}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {getResultIcon(entry.result)}
                          </div>
                          <div>
                            <p className="font-medium">{entry.tournament_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(entry.created_at).toLocaleDateString("es-AR", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getResultBadge(entry.result)}
                          <span className="font-heading font-bold text-lg text-primary min-w-[80px] text-right">
                            +{entry.points} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
