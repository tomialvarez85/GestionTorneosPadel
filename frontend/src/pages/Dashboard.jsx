import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { Trophy, Calendar, Users, TrendingUp, ChevronRight } from "lucide-react";

export default function Dashboard() {
  const { user, token, API } = useAuth();
  const [myTournaments, setMyTournaments] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Fetch user's tournaments
        const tournamentsRes = await fetch(`${API}/users/${user.user_id}/tournaments`, {
          credentials: "include",
          headers,
        });
        if (tournamentsRes.ok) {
          const data = await tournamentsRes.json();
          setMyTournaments(data);
        }

        // Fetch ranking
        const rankingRes = await fetch(`${API}/ranking?limit=5`);
        if (rankingRes.ok) {
          const data = await rankingRes.json();
          setRanking(data);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, token, API]);

  const getUserRank = () => {
    const userRank = ranking.findIndex(r => r.user_id === user?.user_id);
    return userRank !== -1 ? userRank + 1 : "-";
  };

  const stats = [
    {
      title: "Puntos Totales",
      value: user?.total_points || 0,
      icon: Trophy,
      color: "text-amber-500",
      bgColor: "bg-amber-50",
    },
    {
      title: "Torneos Jugados",
      value: user?.tournaments_played || 0,
      icon: Calendar,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "Ranking Global",
      value: `#${getUserRank()}`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Inscripciones Activas",
      value: myTournaments.filter(t => t.status === "open" || t.status === "in_progress").length,
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
  ];

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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="user-dashboard">
      <Navbar />
      
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">
            ¡Hola, {user?.first_name}!
          </h1>
          <p className="text-muted-foreground">
            Bienvenido a tu panel de control
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="border-border card-hover">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="font-heading text-3xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* My Tournaments */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="font-heading text-xl">Mis Torneos</CardTitle>
              <Link to="/tournaments">
                <Button variant="ghost" size="sm" className="text-primary" data-testid="view-all-tournaments-btn">
                  Ver todos <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {myTournaments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No estás inscripto en ningún torneo</p>
                  <Link to="/tournaments">
                    <Button data-testid="browse-tournaments-btn">Explorar Torneos</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myTournaments.slice(0, 4).map((tournament) => (
                    <Link
                      key={tournament.tournament_id}
                      to={`/tournaments/${tournament.tournament_id}`}
                      className="block p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      data-testid={`tournament-item-${tournament.tournament_id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{tournament.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tournament.category} • {new Date(tournament.date).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        {getStatusBadge(tournament.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Ranking */}
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="font-heading text-xl">Top Ranking</CardTitle>
              <Link to="/ranking">
                <Button variant="ghost" size="sm" className="text-primary" data-testid="view-full-ranking-btn">
                  Ver completo <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {ranking.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No hay datos de ranking disponibles</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ranking.map((entry) => (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-4 p-3 rounded-xl ${
                        entry.user_id === user?.user_id ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                      }`}
                      data-testid={`ranking-entry-${entry.position}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-sm ${
                          entry.position === 1
                            ? "rank-1"
                            : entry.position === 2
                            ? "rank-2"
                            : entry.position === 3
                            ? "rank-3"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {entry.position}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.tournaments_played} torneos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading font-bold text-primary">{entry.total_points}</p>
                        <p className="text-xs text-muted-foreground">pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Admin Quick Access */}
        {user?.role === "admin" && (
          <Card className="mt-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-1">Panel de Administración</h3>
                  <p className="text-sm text-muted-foreground">
                    Gestiona torneos, usuarios y resultados
                  </p>
                </div>
                <Link to="/admin">
                  <Button className="rounded-lg" data-testid="admin-panel-btn">
                    Ir al Panel Admin
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
