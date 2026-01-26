import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import {
  Trophy,
  Users,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Shield,
  Play,
  CheckCircle,
} from "lucide-react";

export default function AdminPanel() {
  const { token, API } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [tournamentMatches, setTournamentMatches] = useState({});
  const [registrations, setRegistrations] = useState([]);

  // Tournament Form State
  const [tournamentForm, setTournamentForm] = useState({
    name: "",
    category: "4ta",
    date: "",
    max_capacity: 16,
    description: "",
  });
  const [editingTournament, setEditingTournament] = useState(null);
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [savingTournament, setSavingTournament] = useState(false);

  // Match Result State
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchResultForm, setMatchResultForm] = useState({
    set1_player1: 0,
    set1_player2: 0,
    set2_player1: 0,
    set2_player2: 0,
    set3_player1: null,
    set3_player2: null,
    winner_id: "",
  });
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);

  const getHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      
      const [tournamentsRes, usersRes] = await Promise.all([
        fetch(`${API}/tournaments`, { credentials: "include", headers }),
        fetch(`${API}/users`, { credentials: "include", headers }),
      ]);

      if (tournamentsRes.ok) {
        const data = await tournamentsRes.json();
        setTournaments(data);
      }
      
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data);
      } else {
        console.error("Users fetch failed:", usersRes.status);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const fetchTournamentDetails = async (tournamentId) => {
    try {
      const headers = getHeaders();
      
      const [matchesRes, regsRes] = await Promise.all([
        fetch(`${API}/tournaments/${tournamentId}/matches`, { credentials: "include", headers }),
        fetch(`${API}/tournaments/${tournamentId}/registrations`, { credentials: "include", headers }),
      ]);

      if (matchesRes.ok) setTournamentMatches(await matchesRes.json());
      if (regsRes.ok) setRegistrations(await regsRes.json());
    } catch (error) {
      console.error("Error fetching tournament details:", error);
    }
  };

  const handleSelectTournament = async (tournament) => {
    setSelectedTournament(tournament);
    await fetchTournamentDetails(tournament.tournament_id);
  };

  // Tournament CRUD
  const handleSaveTournament = async (e) => {
    e.preventDefault();
    setSavingTournament(true);

    try {
      const url = editingTournament
        ? `${API}/tournaments/${editingTournament.tournament_id}`
        : `${API}/tournaments`;
      const method = editingTournament ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: getHeaders(),
        body: JSON.stringify(tournamentForm),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Error de servidor");
      }

      if (!response.ok) throw new Error(data.detail || "Error al guardar torneo");

      toast.success(editingTournament ? "Torneo actualizado" : "Torneo creado");
      setTournamentDialogOpen(false);
      setEditingTournament(null);
      resetTournamentForm();
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingTournament(false);
    }
  };

  const handleEditTournament = (tournament) => {
    setEditingTournament(tournament);
    setTournamentForm({
      name: tournament.name,
      category: tournament.category,
      date: tournament.date,
      max_capacity: tournament.max_capacity,
      description: tournament.description || "",
    });
    setTournamentDialogOpen(true);
  };

  const handleDeleteTournament = async (tournamentId) => {
    try {
      const response = await fetch(`${API}/tournaments/${tournamentId}`, {
        method: "DELETE",
        credentials: "include",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Error al eliminar torneo");

      toast.success("Torneo eliminado");
      if (selectedTournament?.tournament_id === tournamentId) {
        setSelectedTournament(null);
      }
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const resetTournamentForm = () => {
    setTournamentForm({
      name: "",
      category: "4ta",
      date: "",
      max_capacity: 16,
      description: "",
    });
  };

  // Bracket Generation
  const handleGenerateBracket = async (tournamentId) => {
    try {
      const response = await fetch(`${API}/tournaments/${tournamentId}/generate-bracket`, {
        method: "POST",
        credentials: "include",
        headers: getHeaders(),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Error de servidor");
      }

      if (!response.ok) throw new Error(data.detail || "Error al generar cuadro");

      toast.success("Cuadro generado correctamente");
      fetchData();
      fetchTournamentDetails(tournamentId);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Match Result
  const handleOpenMatchResult = (match) => {
    setSelectedMatch(match);
    setMatchResultForm({
      set1_player1: match.sets?.[0]?.player1 || 0,
      set1_player2: match.sets?.[0]?.player2 || 0,
      set2_player1: match.sets?.[1]?.player1 || 0,
      set2_player2: match.sets?.[1]?.player2 || 0,
      set3_player1: match.sets?.[2]?.player1 || null,
      set3_player2: match.sets?.[2]?.player2 || null,
      winner_id: match.winner_id || "",
    });
    setMatchDialogOpen(true);
  };

  const handleSaveMatchResult = async (e) => {
    e.preventDefault();
    if (!matchResultForm.winner_id) {
      toast.error("Debes seleccionar un ganador");
      return;
    }

    setSavingMatch(true);
    try {
      const response = await fetch(`${API}/matches/${selectedMatch.match_id}/result`, {
        method: "PUT",
        credentials: "include",
        headers: getHeaders(),
        body: JSON.stringify(matchResultForm),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Error de servidor");
      }

      if (!response.ok) throw new Error(data.detail || "Error al guardar resultado");

      toast.success("Resultado guardado");
      setMatchDialogOpen(false);
      setSelectedMatch(null);
      fetchTournamentDetails(selectedTournament.tournament_id);
      fetchData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingMatch(false);
    }
  };

  // User Management
  const handleMakeAdmin = async (userId) => {
    try {
      const response = await fetch(`${API}/users/${userId}/make-admin`, {
        method: "POST",
        credentials: "include",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Error al promover usuario");

      toast.success("Usuario promovido a admin");
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await fetch(`${API}/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Error al eliminar usuario");

      toast.success("Usuario eliminado");
      fetchData();
    } catch (error) {
      toast.error(error.message);
    }
  };

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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || ""}`}>
        {labels[status] || status}
      </span>
    );
  };

  const ROUND_LABELS = {
    round_of_16: "Octavos",
    quarterfinals: "Cuartos",
    semifinals: "Semifinales",
    final: "Final",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="admin-panel">
      <Navbar />
      
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">
            Panel de Administración
          </h1>
          <p className="text-muted-foreground">Gestiona torneos, usuarios y resultados</p>
        </div>

        <Tabs defaultValue="tournaments" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tournaments" className="gap-2" data-testid="tab-tournaments">
              <Trophy className="w-4 h-4" />
              Torneos ({tournaments.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="w-4 h-4" />
              Usuarios ({users.length})
            </TabsTrigger>
          </TabsList>

          {/* Tournaments Tab */}
          <TabsContent value="tournaments" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-xl font-semibold">Lista de Torneos</h2>
              <Dialog open={tournamentDialogOpen} onOpenChange={setTournamentDialogOpen}>
                <Button
                  className="rounded-lg"
                  onClick={() => {
                    setEditingTournament(null);
                    resetTournamentForm();
                    setTournamentDialogOpen(true);
                  }}
                  data-testid="create-tournament-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Torneo
                </Button>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading">
                      {editingTournament ? "Editar Torneo" : "Crear Torneo"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTournament
                        ? "Modifica los datos del torneo"
                        : "Completa los datos para crear un nuevo torneo"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveTournament} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input
                        id="name"
                        value={tournamentForm.name}
                        onChange={(e) =>
                          setTournamentForm({ ...tournamentForm, name: e.target.value })
                        }
                        required
                        data-testid="tournament-name-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Categoría</Label>
                        <Select
                          value={tournamentForm.category}
                          onValueChange={(v) =>
                            setTournamentForm({ ...tournamentForm, category: v })
                          }
                        >
                          <SelectTrigger data-testid="tournament-category-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7ma">7ma</SelectItem>
                            <SelectItem value="6ta">6ta</SelectItem>
                            <SelectItem value="5ta">5ta</SelectItem>
                            <SelectItem value="4ta">4ta</SelectItem>
                            <SelectItem value="3ra">3ra</SelectItem>
                            <SelectItem value="2da">2da</SelectItem>
                            <SelectItem value="1ra">1ra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max_capacity">Cupo Máximo</Label>
                        <Input
                          id="max_capacity"
                          type="number"
                          min="2"
                          max="32"
                          value={tournamentForm.max_capacity}
                          onChange={(e) =>
                            setTournamentForm({
                              ...tournamentForm,
                              max_capacity: parseInt(e.target.value),
                            })
                          }
                          required
                          data-testid="tournament-capacity-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Fecha</Label>
                      <Input
                        id="date"
                        type="date"
                        value={tournamentForm.date}
                        onChange={(e) =>
                          setTournamentForm({ ...tournamentForm, date: e.target.value })
                        }
                        required
                        data-testid="tournament-date-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Input
                        id="description"
                        value={tournamentForm.description}
                        onChange={(e) =>
                          setTournamentForm({ ...tournamentForm, description: e.target.value })
                        }
                        placeholder="Opcional"
                        data-testid="tournament-description-input"
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={savingTournament} data-testid="save-tournament-btn">
                        {savingTournament ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Guardar"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Tournaments List */}
            {tournaments.length === 0 ? (
              <Card className="border-border">
                <CardContent className="py-12 text-center">
                  <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No hay torneos creados</p>
                  <Button className="mt-4" onClick={() => setTournamentDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primer torneo
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {tournaments.map((tournament) => (
                  <Card
                    key={tournament.tournament_id}
                    className={`border-border cursor-pointer transition-all ${
                      selectedTournament?.tournament_id === tournament.tournament_id
                        ? "ring-2 ring-primary"
                        : "hover:border-primary/30"
                    }`}
                    onClick={() => handleSelectTournament(tournament)}
                    data-testid={`tournament-admin-card-${tournament.tournament_id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-heading font-semibold">{tournament.name}</h3>
                            {getStatusBadge(tournament.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{tournament.category}</span>
                            <span>
                              {new Date(tournament.date).toLocaleDateString("es-AR")}
                            </span>
                            <span>
                              {tournament.current_registrations}/{tournament.max_capacity} inscriptos
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {tournament.status === "open" && tournament.current_registrations >= 2 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateBracket(tournament.tournament_id)}
                              data-testid={`generate-bracket-${tournament.tournament_id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Generar Cuadro
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTournament(tournament)}
                            data-testid={`edit-tournament-${tournament.tournament_id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                data-testid={`delete-tournament-${tournament.tournament_id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar torneo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción eliminará el torneo, inscripciones y partidos asociados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTournament(tournament.tournament_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Selected Tournament Details */}
            {selectedTournament && (
              <Card className="border-border mt-6">
                <CardHeader>
                  <CardTitle className="font-heading">
                    Gestión: {selectedTournament.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Registrations */}
                  <div>
                    <h4 className="font-semibold mb-3">
                      Inscriptos ({registrations.length})
                    </h4>
                    {registrations.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Sin inscripciones</p>
                    ) : (
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {registrations.map((reg) => (
                          <div
                            key={reg.user_id}
                            className="px-3 py-2 bg-muted/50 rounded-lg text-sm"
                          >
                            {reg.user_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Matches */}
                  {(selectedTournament.status === "in_progress" ||
                    selectedTournament.status === "finished") && (
                    <div>
                      <h4 className="font-semibold mb-3">Partidos</h4>
                      {Object.entries(tournamentMatches).map(([round, matches]) =>
                        matches.length > 0 ? (
                          <div key={round} className="mb-4">
                            <h5 className="text-sm font-medium text-muted-foreground mb-2">
                              {ROUND_LABELS[round] || round}
                            </h5>
                            <div className="grid gap-2">
                              {matches.map((match) => (
                                <div
                                  key={match.match_id}
                                  className={`p-3 rounded-lg border ${
                                    match.status === "completed"
                                      ? "bg-emerald-50 border-emerald-200"
                                      : "bg-amber-50 border-amber-200"
                                  }`}
                                  data-testid={`admin-match-${match.match_id}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 text-sm">
                                        <span
                                          className={
                                            match.winner_id === match.player1_id
                                              ? "font-semibold"
                                              : ""
                                          }
                                        >
                                          {match.player1_name || "TBD"}
                                        </span>
                                        <span className="text-muted-foreground">vs</span>
                                        <span
                                          className={
                                            match.winner_id === match.player2_id
                                              ? "font-semibold"
                                              : ""
                                          }
                                        >
                                          {match.player2_name || "TBD"}
                                        </span>
                                      </div>
                                      {match.sets && match.sets.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {match.sets
                                            .map((s) => `${s.player1}-${s.player2}`)
                                            .join(" / ")}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {match.status === "completed" ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                      ) : match.player1_id && match.player2_id ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleOpenMatchResult(match)}
                                          data-testid={`set-result-${match.match_id}`}
                                        >
                                          Cargar Resultado
                                        </Button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          Esperando jugadores
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <h2 className="font-heading text-xl font-semibold">Lista de Usuarios</h2>
            {users.length === 0 ? (
              <Card className="border-border">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No hay usuarios registrados</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="users-table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Nombre
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                            Email
                          </th>
                          <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                            Rol
                          </th>
                          <th className="text-center py-3 px-4 font-semibold text-muted-foreground">
                            Puntos
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-muted-foreground">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr
                            key={user.user_id}
                            className="border-b border-border/50 hover:bg-muted/50"
                            data-testid={`user-row-${user.user_id}`}
                          >
                            <td className="py-3 px-4">
                              {user.first_name} {user.last_name}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                            <td className="py-3 px-4 text-center">
                              {user.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                                  <Shield className="w-3 h-3" />
                                  Admin
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Usuario</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-medium">
                              {user.total_points || 0}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {user.role !== "admin" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMakeAdmin(user.user_id)}
                                    data-testid={`make-admin-${user.user_id}`}
                                  >
                                    <Shield className="w-4 h-4 mr-1" />
                                    Hacer Admin
                                  </Button>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      data-testid={`delete-user-${user.user_id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción eliminará el usuario y sus inscripciones.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteUser(user.user_id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Match Result Dialog */}
        <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">Cargar Resultado</DialogTitle>
              <DialogDescription>
                {selectedMatch?.player1_name} vs {selectedMatch?.player2_name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveMatchResult} className="space-y-4">
              {/* Sets */}
              <div className="space-y-3">
                <Label>Set 1</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    value={matchResultForm.set1_player1}
                    onChange={(e) =>
                      setMatchResultForm({
                        ...matchResultForm,
                        set1_player1: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-16 text-center"
                    data-testid="set1-player1-input"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    value={matchResultForm.set1_player2}
                    onChange={(e) =>
                      setMatchResultForm({
                        ...matchResultForm,
                        set1_player2: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-16 text-center"
                    data-testid="set1-player2-input"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Set 2</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    value={matchResultForm.set2_player1}
                    onChange={(e) =>
                      setMatchResultForm({
                        ...matchResultForm,
                        set2_player1: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-16 text-center"
                    data-testid="set2-player1-input"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    value={matchResultForm.set2_player2}
                    onChange={(e) =>
                      setMatchResultForm({
                        ...matchResultForm,
                        set2_player2: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-16 text-center"
                    data-testid="set2-player2-input"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Set 3 (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    value={matchResultForm.set3_player1 ?? ""}
                    onChange={(e) =>
                      setMatchResultForm({
                        ...matchResultForm,
                        set3_player1: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-16 text-center"
                    placeholder="-"
                    data-testid="set3-player1-input"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    min="0"
                    max="7"
                    value={matchResultForm.set3_player2 ?? ""}
                    onChange={(e) =>
                      setMatchResultForm({
                        ...matchResultForm,
                        set3_player2: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                    className="w-16 text-center"
                    placeholder="-"
                    data-testid="set3-player2-input"
                  />
                </div>
              </div>

              {/* Winner Selection */}
              <div className="space-y-3">
                <Label>Ganador</Label>
                <Select
                  value={matchResultForm.winner_id}
                  onValueChange={(v) =>
                    setMatchResultForm({ ...matchResultForm, winner_id: v })
                  }
                >
                  <SelectTrigger data-testid="winner-select">
                    <SelectValue placeholder="Seleccionar ganador" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedMatch?.player1_id && (
                      <SelectItem value={selectedMatch.player1_id}>
                        {selectedMatch.player1_name}
                      </SelectItem>
                    )}
                    {selectedMatch?.player2_id && (
                      <SelectItem value={selectedMatch.player2_id}>
                        {selectedMatch.player2_name}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMatchDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingMatch} data-testid="save-match-result-btn">
                  {savingMatch ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Resultado"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
