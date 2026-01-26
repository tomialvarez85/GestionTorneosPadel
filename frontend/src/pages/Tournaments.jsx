import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { Calendar, Users, Search, Trophy, Filter } from "lucide-react";

export default function Tournaments() {
  const { API } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const response = await fetch(`${API}/tournaments`);
        if (response.ok) {
          const data = await response.json();
          setTournaments(data);
        }
      } catch (error) {
        console.error("Error fetching tournaments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [API]);

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
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  const filteredTournaments = tournaments.filter((tournament) => {
    const matchesSearch = tournament.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || tournament.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || tournament.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = [...new Set(tournaments.map((t) => t.category))];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Cargando torneos...</div>
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
          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">Torneos</h1>
          <p className="text-muted-foreground">Explora y participa en los torneos disponibles</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar torneos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-lg"
              data-testid="search-tournaments-input"
            />
          </div>
          
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-11 rounded-lg" data-testid="status-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abiertos</SelectItem>
                <SelectItem value="in_progress">En Progreso</SelectItem>
                <SelectItem value="finished">Finalizados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-11 rounded-lg" data-testid="category-filter">
                <Trophy className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tournaments Grid */}
        {filteredTournaments.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-heading text-xl font-semibold mb-2">No se encontraron torneos</h3>
            <p className="text-muted-foreground">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? "Intenta con otros filtros de búsqueda"
                : "No hay torneos disponibles en este momento"}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament, index) => (
              <Card
                key={tournament.tournament_id}
                className="border-border card-hover overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${index * 0.05}s` }}
                data-testid={`tournament-card-${tournament.tournament_id}`}
              >
                <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-2 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded mb-2">
                        {tournament.category}
                      </span>
                      <h3 className="font-heading font-semibold text-lg line-clamp-1">
                        {tournament.name}
                      </h3>
                    </div>
                    {getStatusBadge(tournament.status)}
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(tournament.date).toLocaleDateString("es-AR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>
                        {tournament.current_pairs || 0} / {tournament.max_pairs} parejas
                      </span>
                    </div>
                  </div>

                  {/* Capacity Progress */}
                  <div className="mb-6">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
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

                  <Link to={`/tournaments/${tournament.tournament_id}`}>
                    <Button
                      className="w-full rounded-lg"
                      variant={tournament.status === "open" ? "default" : "outline"}
                      data-testid={`view-tournament-${tournament.tournament_id}-btn`}
                    >
                      {tournament.status === "open" ? "Ver e Inscribirse" : "Ver Detalles"}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
