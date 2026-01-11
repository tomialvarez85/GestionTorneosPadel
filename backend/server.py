from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'padel-tournament-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# APA Points System
APA_POINTS = {
    "champion": 1000,
    "finalist": 600,
    "semifinalist": 360,
    "quarterfinalist": 180,
    "round_of_16": 90
}

# Create the main app
app = FastAPI(title="Padel Tournament System API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: str
    role: str
    total_points: int = 0
    tournaments_played: int = 0
    created_at: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

class TournamentCreate(BaseModel):
    name: str
    category: str  # 5ta, 4ta, 3ra, etc.
    date: str  # ISO format
    max_capacity: int
    description: Optional[str] = None

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    max_capacity: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None

class TournamentResponse(BaseModel):
    tournament_id: str
    name: str
    category: str
    date: str
    max_capacity: int
    current_registrations: int
    status: str  # open, closed, in_progress, finished
    description: Optional[str] = None
    created_at: str

class MatchResultUpdate(BaseModel):
    set1_player1: int
    set1_player2: int
    set2_player1: int
    set2_player2: int
    set3_player1: Optional[int] = None
    set3_player2: Optional[int] = None
    winner_id: str

class MatchResponse(BaseModel):
    match_id: str
    tournament_id: str
    round: str  # round_of_16, quarterfinals, semifinals, final
    player1_id: Optional[str] = None
    player1_name: Optional[str] = None
    player2_id: Optional[str] = None
    player2_name: Optional[str] = None
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    sets: Optional[List[dict]] = None
    match_number: int
    status: str  # pending, completed

class RankingEntry(BaseModel):
    position: int
    user_id: str
    name: str
    total_points: int
    tournaments_played: int

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> dict:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
                if user:
                    return user
    
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    payload = decode_jwt_token(token)
    
    user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "role": "user",
        "total_points": 0,
        "tournaments_played": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id, "user")
    
    return {
        "token": token,
        "user": {
            "user_id": user_id,
            "first_name": user_data.first_name,
            "last_name": user_data.last_name,
            "email": user_data.email,
            "role": "user",
            "total_points": 0,
            "tournaments_played": 0
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["user_id"], user["role"])
    
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "email": user["email"],
            "role": user["role"],
            "total_points": user.get("total_points", 0),
            "tournaments_played": user.get("tournaments_played", 0)
        }
    }

@api_router.get("/auth/session")
async def get_session_data(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Fetch user data from Emergent Auth
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        session_data = auth_response.json()
    
    email = session_data["email"]
    name = session_data.get("name", "")
    picture = session_data.get("picture", "")
    
    # Check if user exists
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
        # Create new user
        name_parts = name.split(" ", 1)
        first_name = name_parts[0] if name_parts else "User"
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "picture": picture,
            "role": "user",
            "total_points": 0,
            "tournaments_played": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    else:
        user_id = user["user_id"]
        # Update picture if changed
        if picture and user.get("picture") != picture:
            await db.users.update_one({"user_id": user_id}, {"$set": {"picture": picture}})
    
    # Create session token
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    # Get fresh user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
        "picture": user.get("picture", ""),
        "role": user.get("role", "user"),
        "total_points": user.get("total_points", 0),
        "tournaments_played": user.get("tournaments_played", 0),
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "user_id": user["user_id"],
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "email": user["email"],
        "picture": user.get("picture", ""),
        "role": user.get("role", "user"),
        "total_points": user.get("total_points", 0),
        "tournaments_played": user.get("tournaments_played", 0)
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== USER ENDPOINTS ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(request: Request):
    await get_admin_user(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/users/{user_id}")
async def get_user(user_id: str, request: Request):
    await get_current_user(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, update_data: UserUpdate, request: Request):
    current_user = await get_current_user(request)
    
    # Users can only update themselves unless admin
    if current_user["user_id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot update other users")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.users.update_one({"user_id": user_id}, {"$set": update_dict})
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    await get_admin_user(request)
    
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete user's registrations
    await db.registrations.delete_many({"user_id": user_id})
    
    return {"message": "User deleted"}

@api_router.post("/users/{user_id}/make-admin")
async def make_admin(user_id: str, request: Request):
    await get_admin_user(request)
    
    result = await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User promoted to admin"}

@api_router.get("/users/{user_id}/tournaments")
async def get_user_tournaments(user_id: str, request: Request):
    await get_current_user(request)
    
    registrations = await db.registrations.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    tournament_ids = [r["tournament_id"] for r in registrations]
    
    tournaments = await db.tournaments.find({"tournament_id": {"$in": tournament_ids}}, {"_id": 0}).to_list(100)
    return tournaments

# ==================== TOURNAMENT ENDPOINTS ====================

@api_router.post("/tournaments")
async def create_tournament(tournament_data: TournamentCreate, request: Request):
    await get_admin_user(request)
    
    tournament_id = f"tournament_{uuid.uuid4().hex[:12]}"
    tournament_doc = {
        "tournament_id": tournament_id,
        "name": tournament_data.name,
        "category": tournament_data.category,
        "date": tournament_data.date,
        "max_capacity": tournament_data.max_capacity,
        "current_registrations": 0,
        "status": "open",
        "description": tournament_data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tournaments.insert_one(tournament_doc)
    return tournament_doc

@api_router.get("/tournaments")
async def get_tournaments(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    
    tournaments = await db.tournaments.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    return tournaments

@api_router.get("/tournaments/{tournament_id}")
async def get_tournament(tournament_id: str):
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return tournament

@api_router.put("/tournaments/{tournament_id}")
async def update_tournament(tournament_id: str, update_data: TournamentUpdate, request: Request):
    await get_admin_user(request)
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.tournaments.update_one({"tournament_id": tournament_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    return tournament

@api_router.delete("/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str, request: Request):
    await get_admin_user(request)
    
    result = await db.tournaments.delete_one({"tournament_id": tournament_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Delete all related data
    await db.registrations.delete_many({"tournament_id": tournament_id})
    await db.matches.delete_many({"tournament_id": tournament_id})
    
    return {"message": "Tournament deleted"}

# ==================== REGISTRATION ENDPOINTS ====================

@api_router.post("/tournaments/{tournament_id}/register")
async def register_for_tournament(tournament_id: str, request: Request):
    user = await get_current_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] != "open":
        raise HTTPException(status_code=400, detail="Tournament is not open for registration")
    
    if tournament["current_registrations"] >= tournament["max_capacity"]:
        raise HTTPException(status_code=400, detail="Tournament is full")
    
    # Check if already registered
    existing = await db.registrations.find_one({
        "tournament_id": tournament_id,
        "user_id": user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already registered")
    
    registration_id = f"reg_{uuid.uuid4().hex[:12]}"
    registration = {
        "registration_id": registration_id,
        "tournament_id": tournament_id,
        "user_id": user["user_id"],
        "user_name": f"{user['first_name']} {user['last_name']}",
        "registered_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.registrations.insert_one(registration)
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$inc": {"current_registrations": 1}}
    )
    
    return {"message": "Registered successfully", "registration_id": registration_id}

@api_router.delete("/tournaments/{tournament_id}/register")
async def cancel_registration(tournament_id: str, request: Request):
    user = await get_current_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] != "open":
        raise HTTPException(status_code=400, detail="Cannot cancel registration for non-open tournament")
    
    result = await db.registrations.delete_one({
        "tournament_id": tournament_id,
        "user_id": user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$inc": {"current_registrations": -1}}
    )
    
    return {"message": "Registration cancelled"}

@api_router.get("/tournaments/{tournament_id}/registrations")
async def get_tournament_registrations(tournament_id: str, request: Request):
    await get_current_user(request)
    
    registrations = await db.registrations.find(
        {"tournament_id": tournament_id},
        {"_id": 0}
    ).to_list(100)
    
    return registrations

@api_router.get("/registrations/check/{tournament_id}")
async def check_registration(tournament_id: str, request: Request):
    user = await get_current_user(request)
    
    registration = await db.registrations.find_one({
        "tournament_id": tournament_id,
        "user_id": user["user_id"]
    })
    
    return {"is_registered": registration is not None}

# ==================== MATCH/BRACKET ENDPOINTS ====================

@api_router.post("/tournaments/{tournament_id}/generate-bracket")
async def generate_bracket(tournament_id: str, request: Request):
    await get_admin_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Get all registrations
    registrations = await db.registrations.find(
        {"tournament_id": tournament_id},
        {"_id": 0}
    ).to_list(100)
    
    num_players = len(registrations)
    if num_players < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")
    
    # Determine bracket size (power of 2)
    bracket_sizes = [2, 4, 8, 16, 32]
    bracket_size = min([s for s in bracket_sizes if s >= num_players], default=32)
    
    # Determine starting round
    if bracket_size <= 2:
        starting_round = "final"
        matches_count = 1
    elif bracket_size <= 4:
        starting_round = "semifinals"
        matches_count = 2
    elif bracket_size <= 8:
        starting_round = "quarterfinals"
        matches_count = 4
    else:
        starting_round = "round_of_16"
        matches_count = 8
    
    # Delete existing matches
    await db.matches.delete_many({"tournament_id": tournament_id})
    
    # Create matches for first round
    import random
    random.shuffle(registrations)
    
    matches = []
    for i in range(matches_count):
        match_id = f"match_{uuid.uuid4().hex[:12]}"
        
        player1 = registrations[i * 2] if i * 2 < len(registrations) else None
        player2 = registrations[i * 2 + 1] if i * 2 + 1 < len(registrations) else None
        
        match = {
            "match_id": match_id,
            "tournament_id": tournament_id,
            "round": starting_round,
            "match_number": i + 1,
            "player1_id": player1["user_id"] if player1 else None,
            "player1_name": player1["user_name"] if player1 else "BYE",
            "player2_id": player2["user_id"] if player2 else None,
            "player2_name": player2["user_name"] if player2 else "BYE",
            "winner_id": None,
            "winner_name": None,
            "sets": [],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Auto-win for BYEs
        if player1 and not player2:
            match["winner_id"] = player1["user_id"]
            match["winner_name"] = player1["user_name"]
            match["status"] = "completed"
        elif player2 and not player1:
            match["winner_id"] = player2["user_id"]
            match["winner_name"] = player2["user_name"]
            match["status"] = "completed"
        
        matches.append(match)
    
    # Create placeholder matches for subsequent rounds
    rounds_order = ["round_of_16", "quarterfinals", "semifinals", "final"]
    start_idx = rounds_order.index(starting_round)
    
    for round_idx in range(start_idx + 1, len(rounds_order)):
        round_name = rounds_order[round_idx]
        num_matches_in_round = matches_count // (2 ** (round_idx - start_idx))
        
        if num_matches_in_round < 1:
            break
            
        for i in range(num_matches_in_round):
            match_id = f"match_{uuid.uuid4().hex[:12]}"
            match = {
                "match_id": match_id,
                "tournament_id": tournament_id,
                "round": round_name,
                "match_number": i + 1,
                "player1_id": None,
                "player1_name": "TBD",
                "player2_id": None,
                "player2_name": "TBD",
                "winner_id": None,
                "winner_name": None,
                "sets": [],
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            matches.append(match)
    
    if matches:
        await db.matches.insert_many(matches)
    
    # Update tournament status
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$set": {"status": "in_progress"}}
    )
    
    # Process auto-advances from BYEs
    await process_bye_advances(tournament_id, starting_round)
    
    return {"message": "Bracket generated", "matches_count": len(matches)}

async def process_bye_advances(tournament_id: str, round_name: str):
    """Process automatic advances from BYE matches"""
    rounds_order = ["round_of_16", "quarterfinals", "semifinals", "final"]
    
    if round_name not in rounds_order:
        return
    
    current_idx = rounds_order.index(round_name)
    if current_idx >= len(rounds_order) - 1:
        return
    
    next_round = rounds_order[current_idx + 1]
    
    # Get completed matches in current round
    completed = await db.matches.find({
        "tournament_id": tournament_id,
        "round": round_name,
        "status": "completed"
    }, {"_id": 0}).to_list(100)
    
    # Get next round matches
    next_matches = await db.matches.find({
        "tournament_id": tournament_id,
        "round": next_round
    }, {"_id": 0}).sort("match_number", 1).to_list(100)
    
    for match in completed:
        if not match["winner_id"]:
            continue
            
        # Calculate which next round match this winner goes to
        next_match_num = (match["match_number"] - 1) // 2 + 1
        
        if next_match_num <= len(next_matches):
            next_match = next_matches[next_match_num - 1]
            
            # Determine if player goes to slot 1 or 2
            is_slot_1 = match["match_number"] % 2 == 1
            
            update_fields = {}
            if is_slot_1:
                update_fields["player1_id"] = match["winner_id"]
                update_fields["player1_name"] = match["winner_name"]
            else:
                update_fields["player2_id"] = match["winner_id"]
                update_fields["player2_name"] = match["winner_name"]
            
            await db.matches.update_one(
                {"match_id": next_match["match_id"]},
                {"$set": update_fields}
            )

@api_router.get("/tournaments/{tournament_id}/matches")
async def get_tournament_matches(tournament_id: str):
    matches = await db.matches.find(
        {"tournament_id": tournament_id},
        {"_id": 0}
    ).to_list(100)
    
    # Group by round
    rounds_order = ["round_of_16", "quarterfinals", "semifinals", "final"]
    result = {r: [] for r in rounds_order}
    
    for match in matches:
        round_name = match["round"]
        if round_name in result:
            result[round_name].append(match)
    
    # Sort each round by match number
    for round_name in result:
        result[round_name].sort(key=lambda x: x["match_number"])
    
    return result

@api_router.put("/matches/{match_id}/result")
async def update_match_result(match_id: str, result: MatchResultUpdate, request: Request):
    await get_admin_user(request)
    
    match = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Validate winner is one of the players
    if result.winner_id not in [match["player1_id"], match["player2_id"]]:
        raise HTTPException(status_code=400, detail="Winner must be one of the players")
    
    # Build sets
    sets = [
        {"player1": result.set1_player1, "player2": result.set1_player2},
        {"player1": result.set2_player1, "player2": result.set2_player2}
    ]
    if result.set3_player1 is not None and result.set3_player2 is not None:
        sets.append({"player1": result.set3_player1, "player2": result.set3_player2})
    
    winner_name = match["player1_name"] if result.winner_id == match["player1_id"] else match["player2_name"]
    
    # Update match
    await db.matches.update_one(
        {"match_id": match_id},
        {"$set": {
            "winner_id": result.winner_id,
            "winner_name": winner_name,
            "sets": sets,
            "status": "completed"
        }}
    )
    
    # Advance winner to next round
    await advance_winner(match["tournament_id"], match["round"], match["match_number"], result.winner_id, winner_name)
    
    # Check if tournament is complete
    await check_tournament_completion(match["tournament_id"])
    
    return {"message": "Result saved", "winner": winner_name}

async def advance_winner(tournament_id: str, current_round: str, match_number: int, winner_id: str, winner_name: str):
    """Advance winner to next round"""
    rounds_order = ["round_of_16", "quarterfinals", "semifinals", "final"]
    
    if current_round not in rounds_order:
        return
    
    current_idx = rounds_order.index(current_round)
    if current_idx >= len(rounds_order) - 1:
        return  # Final, no next round
    
    next_round = rounds_order[current_idx + 1]
    next_match_num = (match_number - 1) // 2 + 1
    
    # Find next match
    next_match = await db.matches.find_one({
        "tournament_id": tournament_id,
        "round": next_round,
        "match_number": next_match_num
    })
    
    if not next_match:
        return
    
    # Determine slot (odd match numbers go to player1, even to player2)
    is_slot_1 = match_number % 2 == 1
    
    update_fields = {}
    if is_slot_1:
        update_fields["player1_id"] = winner_id
        update_fields["player1_name"] = winner_name
    else:
        update_fields["player2_id"] = winner_id
        update_fields["player2_name"] = winner_name
    
    await db.matches.update_one(
        {"match_id": next_match["match_id"]},
        {"$set": update_fields}
    )

async def check_tournament_completion(tournament_id: str):
    """Check if all matches are complete and assign points"""
    # Find final match
    final = await db.matches.find_one({
        "tournament_id": tournament_id,
        "round": "final"
    }, {"_id": 0})
    
    if not final or final["status"] != "completed":
        return
    
    # Tournament is complete - assign points
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    
    # Get all matches
    matches = await db.matches.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    
    # Track player results
    player_results = {}
    
    for match in matches:
        if match["status"] != "completed":
            continue
            
        round_name = match["round"]
        winner_id = match.get("winner_id")
        loser_id = match["player1_id"] if match["player2_id"] == winner_id else match["player2_id"]
        
        if winner_id:
            if winner_id not in player_results:
                player_results[winner_id] = {"best_round": round_name, "is_winner": False}
            
            if round_name == "final":
                player_results[winner_id]["is_winner"] = True
                player_results[winner_id]["best_round"] = "champion"
        
        if loser_id:
            if loser_id not in player_results:
                player_results[loser_id] = {"best_round": round_name, "is_winner": False}
            
            # Loser's best round is where they lost
            if round_name == "final":
                player_results[loser_id]["best_round"] = "finalist"
            elif round_name == "semifinals":
                player_results[loser_id]["best_round"] = "semifinalist"
            elif round_name == "quarterfinals":
                player_results[loser_id]["best_round"] = "quarterfinalist"
            elif round_name == "round_of_16":
                player_results[loser_id]["best_round"] = "round_of_16"
    
    # Assign points
    for user_id, result in player_results.items():
        points = 0
        if result.get("is_winner"):
            points = APA_POINTS["champion"]
        elif result["best_round"] == "finalist":
            points = APA_POINTS["finalist"]
        elif result["best_round"] == "semifinalist":
            points = APA_POINTS["semifinalist"]
        elif result["best_round"] == "quarterfinalist":
            points = APA_POINTS["quarterfinalist"]
        elif result["best_round"] == "round_of_16":
            points = APA_POINTS["round_of_16"]
        
        if points > 0:
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$inc": {"total_points": points, "tournaments_played": 1}
                }
            )
            
            # Record points history
            await db.points_history.insert_one({
                "history_id": f"ph_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "tournament_id": tournament_id,
                "tournament_name": tournament.get("name", ""),
                "points": points,
                "result": result["best_round"],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Mark tournament as finished
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$set": {"status": "finished"}}
    )

# ==================== RANKING ENDPOINT ====================

@api_router.get("/ranking")
async def get_ranking(limit: int = 50):
    users = await db.users.find(
        {"total_points": {"$gt": 0}},
        {"_id": 0, "password_hash": 0}
    ).sort("total_points", -1).limit(limit).to_list(limit)
    
    ranking = []
    for idx, user in enumerate(users, 1):
        ranking.append({
            "position": idx,
            "user_id": user["user_id"],
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "total_points": user.get("total_points", 0),
            "tournaments_played": user.get("tournaments_played", 0)
        })
    
    return ranking

@api_router.get("/users/{user_id}/points-history")
async def get_user_points_history(user_id: str, request: Request):
    await get_current_user(request)
    
    history = await db.points_history.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return history

# ==================== SEED DATA ENDPOINT ====================

@api_router.post("/seed")
async def seed_data():
    """Seed the database with sample data"""
    
    # Clear existing data
    await db.users.delete_many({})
    await db.tournaments.delete_many({})
    await db.registrations.delete_many({})
    await db.matches.delete_many({})
    await db.points_history.delete_many({})
    await db.user_sessions.delete_many({})
    
    # Create admin user
    admin_id = f"user_{uuid.uuid4().hex[:12]}"
    admin = {
        "user_id": admin_id,
        "first_name": "Admin",
        "last_name": "Padel",
        "email": "admin@padel.com",
        "password_hash": hash_password("admin123"),
        "role": "admin",
        "total_points": 0,
        "tournaments_played": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin)
    
    # Create sample users
    sample_users = [
        {"first_name": "Juan", "last_name": "Martín", "email": "juan@test.com", "points": 1600},
        {"first_name": "Carlos", "last_name": "Rodríguez", "email": "carlos@test.com", "points": 1200},
        {"first_name": "Miguel", "last_name": "Fernández", "email": "miguel@test.com", "points": 960},
        {"first_name": "Pablo", "last_name": "García", "email": "pablo@test.com", "points": 720},
        {"first_name": "Diego", "last_name": "López", "email": "diego@test.com", "points": 540},
        {"first_name": "Andrés", "last_name": "Sánchez", "email": "andres@test.com", "points": 360},
        {"first_name": "Lucas", "last_name": "Martínez", "email": "lucas@test.com", "points": 270},
        {"first_name": "Mateo", "last_name": "González", "email": "mateo@test.com", "points": 180},
    ]
    
    user_ids = []
    for u in sample_users:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_ids.append(user_id)
        user_doc = {
            "user_id": user_id,
            "first_name": u["first_name"],
            "last_name": u["last_name"],
            "email": u["email"],
            "password_hash": hash_password("test123"),
            "role": "user",
            "total_points": u["points"],
            "tournaments_played": u["points"] // 360 + 1,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create sample tournaments
    tournaments_data = [
        {"name": "Torneo de Verano 2024", "category": "4ta", "date": "2024-12-15", "max_capacity": 16, "status": "open"},
        {"name": "Copa Navidad", "category": "5ta", "date": "2024-12-22", "max_capacity": 8, "status": "open"},
        {"name": "Master Series Otoño", "category": "3ra", "date": "2024-11-30", "max_capacity": 16, "status": "finished"},
        {"name": "Torneo Primavera", "category": "4ta", "date": "2025-01-10", "max_capacity": 16, "status": "open"},
    ]
    
    for t in tournaments_data:
        tournament_id = f"tournament_{uuid.uuid4().hex[:12]}"
        tournament_doc = {
            "tournament_id": tournament_id,
            "name": t["name"],
            "category": t["category"],
            "date": t["date"],
            "max_capacity": t["max_capacity"],
            "current_registrations": 0,
            "status": t["status"],
            "description": f"Torneo de pádel categoría {t['category']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.tournaments.insert_one(tournament_doc)
        
        # Add some registrations for open tournaments
        if t["status"] == "open":
            import random
            num_registrations = random.randint(2, min(6, t["max_capacity"]))
            selected_users = random.sample(user_ids, num_registrations)
            
            for user_id in selected_users:
                user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
                registration = {
                    "registration_id": f"reg_{uuid.uuid4().hex[:12]}",
                    "tournament_id": tournament_id,
                    "user_id": user_id,
                    "user_name": f"{user['first_name']} {user['last_name']}",
                    "registered_at": datetime.now(timezone.utc).isoformat()
                }
                await db.registrations.insert_one(registration)
            
            await db.tournaments.update_one(
                {"tournament_id": tournament_id},
                {"$set": {"current_registrations": num_registrations}}
            )
    
    return {
        "message": "Database seeded successfully",
        "admin_credentials": {"email": "admin@padel.com", "password": "admin123"},
        "test_user_credentials": {"email": "juan@test.com", "password": "test123"}
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
