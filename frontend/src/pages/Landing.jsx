import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../App";
import { Trophy, Users, Calendar, TrendingUp } from "lucide-react";
import Navbar from "../components/Navbar";

export default function Landing() {
  const { user } = useAuth();

  const features = [
    {
      icon: Trophy,
      title: "Sistema APA",
      description: "Puntos oficiales de la Asociación Pádel Argentino"
    },
    {
      icon: Users,
      title: "Gestión de Jugadores",
      description: "Inscripciones y perfiles completos"
    },
    {
      icon: Calendar,
      title: "Torneos",
      description: "Organiza y participa en competencias"
    },
    {
      icon: TrendingUp,
      title: "Ranking Global",
      description: "Sigue tu progreso y compite por el top"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 court-pattern opacity-30" />
        <div className="container mx-auto px-6 py-20 md:py-32 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <Trophy className="w-4 h-4" />
                Sistema de Torneos de Pádel
              </div>
              
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-secondary leading-tight">
                Gestiona tus torneos de{" "}
                <span className="text-primary">Pádel</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg">
                Plataforma completa para organizar torneos, gestionar inscripciones, 
                generar brackets y llevar el ranking con el sistema de puntos APA.
              </p>
              
              <div className="flex flex-wrap gap-4">
                {user ? (
                  <Link to="/dashboard">
                    <Button 
                      size="lg" 
                      className="rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
                      data-testid="go-to-dashboard-btn"
                    >
                      Ir al Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/register">
                      <Button 
                        size="lg" 
                        className="rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
                        data-testid="register-btn"
                      >
                        Comenzar Ahora
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button 
                        variant="outline" 
                        size="lg" 
                        className="rounded-lg font-semibold"
                        data-testid="login-btn"
                      >
                        Iniciar Sesión
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
            
            <div className="relative hidden md:block">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/35261961/pexels-photo-35261961.jpeg"
                  alt="Padel match"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campeón</p>
                    <p className="font-heading font-bold text-xl">1000 pts</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-secondary mb-4">
              Todo lo que necesitas
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Una plataforma diseñada para jugadores y organizadores de torneos de pádel
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-background p-6 rounded-xl border border-border card-hover animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APA Points Section */}
      <section className="py-20 bg-secondary text-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                Sistema de Puntos APA
              </h2>
              <p className="text-slate-300 mb-8">
                Utilizamos el sistema oficial de la Asociación Pádel Argentino 
                para calcular los puntos de cada jugador según su rendimiento en torneos.
              </p>
              <Link to="/ranking">
                <Button 
                  variant="secondary" 
                  size="lg" 
                  className="rounded-lg font-semibold bg-white text-secondary hover:bg-slate-100"
                  data-testid="view-ranking-btn"
                >
                  Ver Ranking
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { position: "Campeón", points: 1000, style: "points-champion" },
                { position: "Finalista", points: 600, style: "points-finalist" },
                { position: "Semifinalista", points: 360, style: "points-semi" },
                { position: "Cuartos", points: 180, style: "bg-slate-700" },
              ].map((item, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-xl ${item.style} animate-fade-in-up`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <p className="text-sm opacity-80 mb-1">{item.position}</p>
                  <p className="font-heading text-2xl font-bold">{item.points} pts</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="relative rounded-2xl overflow-hidden">
            <img
              src="https://images.pexels.com/photos/35248387/pexels-photo-35248387.jpeg"
              alt="Padel player"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 to-secondary/70" />
            <div className="relative py-16 px-8 md:px-16 text-white">
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4 max-w-xl">
                ¿Listo para competir?
              </h2>
              <p className="text-slate-200 mb-8 max-w-lg">
                Únete a nuestra comunidad de jugadores y participa en los próximos torneos.
              </p>
              <Link to="/tournaments">
                <Button 
                  size="lg" 
                  className="rounded-lg font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
                  data-testid="view-tournaments-btn"
                >
                  Ver Torneos Disponibles
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-accent" />
              <span className="font-heading font-bold text-xl">PadelTorneos</span>
            </div>
            <nav className="flex flex-wrap gap-6 text-sm text-slate-300">
              <Link to="/tournaments" className="hover:text-white transition-colors">Torneos</Link>
              <Link to="/ranking" className="hover:text-white transition-colors">Ranking</Link>
              <Link to="/login" className="hover:text-white transition-colors">Iniciar Sesión</Link>
            </nav>
            <p className="text-sm text-slate-400">
              © 2024 PadelTorneos. Sistema APA.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
