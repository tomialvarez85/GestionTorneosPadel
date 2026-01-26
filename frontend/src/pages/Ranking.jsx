import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

export default function Ranking() {
  const { API } = useAuth();
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const response = await fetch(`${API}/ranking?limit=100`);
        if (response.ok) {
          const data = await response.json();
          setRanking(data);
        }
      } catch (error) {
        console.error("Error fetching ranking:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [API]);

  const getPositionIcon = (position) => {
    switch (position) {
      case 1:
        return <Trophy className="w-6 h-6 text-amber-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-slate-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-700" />;
      default:
        return null;
    }
  };

  const getPositionStyle = (position) => {
    switch (position) {
      case 1:
        return "rank-1";
      case 2:
        return "rank-2";
      case 3:
        return "rank-3";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Cargando ranking...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">
            Ranking Global
          </h1>
          <p className="text-muted-foreground">
            Clasificación basada en el sistema de puntos APA
          </p>
        </div>

        {/* Top 3 Podium */}
        {ranking.length >= 3 && (
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {/* Second Place */}
            <Card className="border-border card-hover order-2 md:order-1 md:mt-8">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rank-2 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Medal className="w-8 h-8" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">2° Lugar</p>
                <Link to={`/players/${ranking[1].user_id}`} className="hover:text-primary transition-colors">
                  <h3 className="font-heading font-bold text-xl mb-2">{ranking[1].name}</h3>
                </Link>
                <p className="font-heading text-2xl text-primary font-bold">
                  {ranking[1].total_points}
                </p>
                <p className="text-sm text-muted-foreground">puntos</p>
              </CardContent>
            </Card>

            {/* First Place */}
            <Card className="border-border card-hover border-2 border-amber-300 order-1 md:order-2">
              <div className="h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300" />
              <CardContent className="p-6 text-center">
                <div className="w-20 h-20 rank-1 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Trophy className="w-10 h-10" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Campeón</p>
                <Link to={`/players/${ranking[0].user_id}`} className="hover:text-primary transition-colors">
                  <h3 className="font-heading font-bold text-2xl mb-2">{ranking[0].name}</h3>
                </Link>
                <p className="font-heading text-3xl text-primary font-bold">
                  {ranking[0].total_points}
                </p>
                <p className="text-sm text-muted-foreground">puntos</p>
              </CardContent>
            </Card>

            {/* Third Place */}
            <Card className="border-border card-hover order-3 md:mt-12">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rank-3 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">3° Lugar</p>
                <Link to={`/players/${ranking[2].user_id}`} className="hover:text-primary transition-colors">
                  <h3 className="font-heading font-bold text-xl mb-2">{ranking[2].name}</h3>
                </Link>
                <p className="font-heading text-2xl text-primary font-bold">
                  {ranking[2].total_points}
                </p>
                <p className="text-sm text-muted-foreground">puntos</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Full Ranking Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Tabla de Posiciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-heading text-xl font-semibold mb-2">Sin datos de ranking</h3>
                <p className="text-muted-foreground">
                  Aún no hay jugadores con puntos registrados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="ranking-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-4 px-4 font-semibold text-muted-foreground">Pos</th>
                      <th className="text-left py-4 px-4 font-semibold text-muted-foreground">Jugador</th>
                      <th className="text-center py-4 px-4 font-semibold text-muted-foreground">Torneos</th>
                      <th className="text-right py-4 px-4 font-semibold text-muted-foreground">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((entry, index) => (
                      <tr
                        key={entry.user_id}
                        className="border-b border-border/50 table-row-hover animate-fade-in-up"
                        style={{ animationDelay: `${index * 0.03}s` }}
                        data-testid={`ranking-row-${entry.position}`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getPositionStyle(
                                entry.position
                              )}`}
                            >
                              {entry.position}
                            </div>
                            {getPositionIcon(entry.position)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                              <span className="font-medium text-secondary">
                                {entry.name?.charAt(0) || "?"}
                              </span>
                            </div>
                            <span className="font-medium">{entry.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-muted-foreground">
                          {entry.tournaments_played}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-heading font-bold text-lg text-primary">
                            {entry.total_points}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* APA Points Legend */}
        <Card className="mt-8 border-border bg-muted/30">
          <CardContent className="p-6">
            <h3 className="font-heading font-semibold mb-4">Sistema de Puntos APA</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Campeón", points: 1000, color: "points-champion" },
                { label: "Finalista", points: 600, color: "points-finalist" },
                { label: "Semifinalista", points: 360, color: "points-semi" },
                { label: "Cuartos", points: 180, color: "bg-slate-600 text-white" },
                { label: "Octavos", points: 90, color: "bg-slate-500 text-white" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`p-3 rounded-lg text-center ${item.color}`}
                >
                  <p className="text-xs opacity-80 mb-1">{item.label}</p>
                  <p className="font-heading font-bold">{item.points} pts</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
