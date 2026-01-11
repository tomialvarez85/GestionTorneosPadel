import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../App";
import Navbar from "../components/Navbar";
import { toast } from "sonner";
import { User, Mail, Trophy, Calendar, Save, Loader2 } from "lucide-react";

export default function Profile() {
  const { user, token, API, login } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [pointsHistory, setPointsHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPointsHistory = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${API}/users/${user.user_id}/points-history`, {
          credentials: "include",
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          setPointsHistory(data);
        }
      } catch (error) {
        console.error("Error fetching points history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPointsHistory();
  }, [user, token, API]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(`${API}/users/${user.user_id}`, {
        method: "PUT",
        credentials: "include",
        headers,
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error al actualizar perfil");
      }

      login({ ...user, first_name: firstName, last_name: lastName, email }, token);
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const getResultBadge = (result) => {
    const styles = {
      champion: "points-champion",
      finalist: "points-finalist",
      semifinalist: "points-semi",
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-secondary mb-2">Mi Perfil</h1>
          <p className="text-muted-foreground">Gestiona tu información personal</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Form */}
          <div className="lg:col-span-2">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="font-heading">Información Personal</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="pl-10 h-11 rounded-lg"
                          data-testid="profile-first-name-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-11 rounded-lg"
                        data-testid="profile-last-name-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 rounded-lg"
                        data-testid="profile-email-input"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="rounded-lg"
                    disabled={saving}
                    data-testid="save-profile-btn"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Points History */}
            <Card className="border-border mt-6">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Historial de Puntos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-pulse text-muted-foreground">Cargando historial...</div>
                  </div>
                ) : pointsHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No tienes puntos registrados aún</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pointsHistory.map((entry, index) => (
                      <div
                        key={entry.history_id || index}
                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50"
                        data-testid={`points-history-${index}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{entry.tournament_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {getResultBadge(entry.result)}
                          <span className="font-heading font-bold text-lg text-primary">
                            +{entry.points}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="font-heading text-3xl font-bold text-primary">
                      {user?.first_name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-xl">
                    {user?.first_name} {user?.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4">{user?.email}</p>
                  {user?.role === "admin" && (
                    <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                      Administrador
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-heading font-semibold mb-4">Estadísticas</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Puntos Totales</span>
                    <span className="font-heading font-bold text-xl text-primary">
                      {user?.total_points || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Torneos Jugados</span>
                    <span className="font-heading font-bold text-xl">
                      {user?.tournaments_played || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Promedio por Torneo</span>
                    <span className="font-heading font-bold text-xl">
                      {user?.tournaments_played
                        ? Math.round(user.total_points / user.tournaments_played)
                        : 0}
                    </span>
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
