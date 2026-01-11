# PadelTorneos - Sistema de Gestión de Torneos de Pádel

## Descripción General
Sistema completo para gestionar torneos de pádel con inscripciones, brackets automáticos, sistema de puntos APA y ranking global.

## Stack Tecnológico
- **Backend**: FastAPI (Python) + MongoDB
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Autenticación**: JWT + Google Auth (Emergent)

## User Personas
1. **Jugador**: Se registra, participa en torneos, ve su ranking y puntos
2. **Admin**: Gestiona torneos, genera brackets, carga resultados

## Core Requirements
- Registro/Login con email y Google
- Gestión de torneos (CRUD)
- Sistema de inscripciones
- Generación automática de brackets
- Carga de resultados de partidos
- Avance automático de ganadores
- Sistema de puntos APA
- Ranking global

## Sistema de Puntos APA
- Campeón: 1000 pts
- Finalista: 600 pts
- Semifinalista: 360 pts
- Cuartos de final: 180 pts
- Octavos: 90 pts

## Implementación Completada (2025-01-11)

### Backend (/app/backend/server.py)
- ✅ Auth: register, login, logout, Google OAuth session
- ✅ Users: CRUD, make-admin, tournaments history
- ✅ Tournaments: CRUD, status management
- ✅ Registrations: register, cancel, check
- ✅ Matches: generate-bracket, update result
- ✅ Ranking: global leaderboard
- ✅ Seed data endpoint

### Frontend Pages
- ✅ Landing page con hero y features
- ✅ Login/Register con Google Auth
- ✅ Dashboard de usuario
- ✅ Listado de torneos con filtros
- ✅ Detalle de torneo con bracket
- ✅ Ranking global con podio
- ✅ Perfil de usuario
- ✅ Panel admin completo

### Features
- ✅ Bracket generation (2-32 players)
- ✅ Match result loading
- ✅ Automatic winner advancement
- ✅ APA points auto-assignment
- ✅ Tournament status flow (open→in_progress→finished)

## API Endpoints
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/session
GET  /api/auth/me
POST /api/auth/logout

GET  /api/users
GET  /api/users/:id
PUT  /api/users/:id
DELETE /api/users/:id
POST /api/users/:id/make-admin
GET  /api/users/:id/tournaments

POST /api/tournaments
GET  /api/tournaments
GET  /api/tournaments/:id
PUT  /api/tournaments/:id
DELETE /api/tournaments/:id
POST /api/tournaments/:id/register
DELETE /api/tournaments/:id/register
GET  /api/tournaments/:id/registrations
POST /api/tournaments/:id/generate-bracket
GET  /api/tournaments/:id/matches

PUT  /api/matches/:id/result

GET  /api/ranking
POST /api/seed
```

## Credenciales de Demo
- Admin: admin@padel.com / admin123
- User: juan@test.com / test123

## Backlog Priorizado

### P0 (Crítico) - Completado
- ✅ Auth completa
- ✅ CRUD torneos
- ✅ Inscripciones
- ✅ Bracket generation
- ✅ Match results
- ✅ APA points
- ✅ Ranking

### P1 (Importante) - Pendiente
- [ ] Notificaciones por email (resultados, inscripciones)
- [ ] Historial detallado de partidos
- [ ] Export de brackets a PDF/imagen
- [ ] Soporte para parejas (dobles)

### P2 (Nice to have) - Pendiente
- [ ] Estadísticas avanzadas de jugador
- [ ] Predicciones de brackets
- [ ] Integración con calendario
- [ ] App móvil (PWA)

## Next Tasks
1. Implementar notificaciones por email
2. Agregar soporte para modalidad dobles
3. Mejorar visualización del bracket con animaciones
4. Agregar historial completo de enfrentamientos entre jugadores
