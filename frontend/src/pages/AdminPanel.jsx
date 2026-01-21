import { useState, useEffect, useCallback } from "react";
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
  DialogTrigger,
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

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);

  const [matchResultForm, setMatchResultForm] = useState({
    set1_player1: 0,
    set1_player2: 0,
    set2_player1: 0,
    set2_player2: 0,
    set3_player1: null,
    set3_player2: null,
    winner_id: "",
  });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tournamentsRes, usersRes] = await Promise.all([
        fetch(`${API}/tournaments`, { headers, credentials: "include" }),
        fetch(`${API}/users`, { headers, credentials: "include" }),
      ]);

      if (tournamentsRes.ok) setTournaments(await tournamentsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [API, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchTournamentDetails = async (id) => {
    try {
      const [matchesRes, regsRes] = await Promise.all([
        fetch(`${API}/tournaments/${id}/matches`, { headers }),
        fetch(`${API}/tournaments/${id}/registrations`, { headers }),
      ]);

      if (matchesRes.ok) setTournamentMatches(await matchesRes.json());
      if (regsRes.ok) setRegistrations(await regsRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTournament = async (tournament) => {
    setSelectedTournament(tournament);
    await fetchTournamentDetails(tournament.tournament_id);
  };

  const handleSaveTournament = async (e) => {
    e.preventDefault();
    setSavingTournament(true);

    try {
      const url = editingTournament
        ? `${API}/tournaments/${editingTournament.tournament_id}`
        : `${API}/tournaments`;

      const response = await fetch(url, {
        method: editingTournament ? "PUT" : "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(tournamentForm),
      });

      if (!response.ok) throw new Error();

      toast.success(editingTournament ? "Torneo actualizado" : "Torneo creado");
      setTournamentDialogOpen(false);
      setEditingTournament(null);
      setTournamentForm({
        name: "",
        category: "4ta",
        date: "",
        max_capacity: 16,
        description: "",
      });
      fetchData();
    } catch {
      toast.error("Error al guardar torneo");
    } finally {
      setSavingTournament(false);
    }
  };

  const handleGenerateBracket = async (id) => {
    try {
      const res = await fetch(`${API}/tournaments/${id}/generate-bracket`, {
        method: "POST",
        headers,
      });

      if (!res.ok) throw new Error();
      toast.success("Cuadro generado");
      fetchData();
      fetchTournamentDetails(id);
    } catch {
      toast.error("Error al generar cuadro");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center h-[60vh]">
          Cargando panel…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* el resto del JSX queda IGUAL que el tuyo */}
    </div>
  );
}
