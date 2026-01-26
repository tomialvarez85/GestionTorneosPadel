from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
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
JWT_EXPIRATION_HOURS = 24 * 7

# APA Points System - Points per player (both players in pair get same points)
APA_POINTS = {
    "champion": 1000,
    "finalist": 600,
    "semifinalist": 360,
    "quarterfinalist": 180,
    "round_of_16": 90
}

app = FastAPI(title="Padel Tournament System API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
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

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None

class TournamentCreate(BaseModel):
    name: str
    category: str
    date: str
    max_pairs: int  # Changed from max_capacity to max_pairs
    description: Optional[str] = None

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    max_pairs: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None

class PairCreate(BaseModel):
    player1_id: str
    player2_id: str

class MatchResultUpdate(BaseModel):
    set1_pair1: int
    set1_pair2: int
    set2_pair1: int
    set2_pair2: int
    set3_pair1: Optional[int] = None
    set3_pair2: Optional[int] = None
    winner_pair_id: str

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

async def get_current_user_optional(request: Request) -> Optional[dict]:
    """Get current user without raising exception if not authenticated"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
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
        "user": {k: v for k, v in user_doc.items() if k not in ["_id", "password_hash"]}
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["user_id"], user["role"])
    
    return {
        "token": token,
        "user": {k: v for k, v in user.items() if k != "password_hash"}
    }

@api_router.get("/auth/session")
async def get_session_data(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    async with httpx.AsyncClient() as http_client:
        auth_response = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        session_data = auth_response.json()
    
    email = session_data["email"]
    name = session_data.get("name", "")
    picture = session_data.get("picture", "")
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user:
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
        if picture and user.get("picture") != picture:
            await db.users.update_one({"user_id": user_id}, {"$set": {"picture": picture}})
    
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {**user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {k: v for k, v in user.items() if k != "password_hash"}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== USER ENDPOINTS ====================

@api_router.get("/users")
async def get_users(request: Request):
    await get_admin_user(request)
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str):
    """Get public user profile - PUBLIC (no auth required)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0, "email": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.get("/users/{user_id}/points-history-public")
async def get_user_points_history_public(user_id: str):
    """Get public points history - PUBLIC (no auth required)"""
    history = await db.points_history.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return history

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
    return {"message": "User deleted"}

@api_router.post("/users/{user_id}/make-admin")
async def make_admin(user_id: str, request: Request):
    await get_admin_user(request)
    result = await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User promoted to admin"}

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
        "max_pairs": tournament_data.max_pairs,
        "current_pairs": 0,
        "status": "open",
        "description": tournament_data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tournaments.insert_one(tournament_doc)
    return {k: v for k, v in tournament_doc.items() if k != "_id"}

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
    
    await db.pairs.delete_many({"tournament_id": tournament_id})
    await db.matches.delete_many({"tournament_id": tournament_id})
    
    return {"message": "Tournament deleted"}

# ==================== PAIRS ENDPOINTS (ADMIN ONLY) ====================

@api_router.post("/tournaments/{tournament_id}/pairs")
async def create_pair(tournament_id: str, pair_data: PairCreate, request: Request):
    """Create a pair for a tournament - ADMIN ONLY"""
    await get_admin_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] != "open":
        raise HTTPException(status_code=400, detail="Tournament is not open for registration")
    
    if tournament["current_pairs"] >= tournament["max_pairs"]:
        raise HTTPException(status_code=400, detail="Tournament is full")
    
    # Check players exist
    player1 = await db.users.find_one({"user_id": pair_data.player1_id}, {"_id": 0})
    player2 = await db.users.find_one({"user_id": pair_data.player2_id}, {"_id": 0})
    
    if not player1 or not player2:
        raise HTTPException(status_code=404, detail="One or both players not found")
    
    if pair_data.player1_id == pair_data.player2_id:
        raise HTTPException(status_code=400, detail="A pair must have two different players")
    
    # Check if either player is already in a pair for this tournament
    existing = await db.pairs.find_one({
        "tournament_id": tournament_id,
        "$or": [
            {"player1_id": pair_data.player1_id},
            {"player2_id": pair_data.player1_id},
            {"player1_id": pair_data.player2_id},
            {"player2_id": pair_data.player2_id}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="One or both players are already in a pair for this tournament")
    
    pair_id = f"pair_{uuid.uuid4().hex[:12]}"
    pair_doc = {
        "pair_id": pair_id,
        "tournament_id": tournament_id,
        "player1_id": pair_data.player1_id,
        "player1_name": f"{player1['first_name']} {player1['last_name']}",
        "player2_id": pair_data.player2_id,
        "player2_name": f"{player2['first_name']} {player2['last_name']}",
        "pair_name": f"{player1['first_name']}/{player2['first_name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pairs.insert_one(pair_doc)
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$inc": {"current_pairs": 1}}
    )
    
    return {k: v for k, v in pair_doc.items() if k != "_id"}

@api_router.get("/tournaments/{tournament_id}/pairs")
async def get_tournament_pairs(tournament_id: str):
    """Get all pairs for a tournament - PUBLIC"""
    pairs = await db.pairs.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    return pairs

@api_router.delete("/tournaments/{tournament_id}/pairs/{pair_id}")
async def delete_pair(tournament_id: str, pair_id: str, request: Request):
    """Delete a pair from a tournament - ADMIN ONLY"""
    await get_admin_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament["status"] != "open":
        raise HTTPException(status_code=400, detail="Cannot remove pairs from non-open tournament")
    
    result = await db.pairs.delete_one({"pair_id": pair_id, "tournament_id": tournament_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pair not found")
    
    await db.tournaments.update_one(
        {"tournament_id": tournament_id},
        {"$inc": {"current_pairs": -1}}
    )
    
    return {"message": "Pair deleted"}

# ==================== BRACKET/MATCH ENDPOINTS ====================

@api_router.post("/tournaments/{tournament_id}/generate-bracket")
async def generate_bracket(tournament_id: str, request: Request):
    """Generate bracket - ADMIN ONLY"""
    await get_admin_user(request)
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    pairs = await db.pairs.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    num_pairs = len(pairs)
    
    if num_pairs < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 pairs to generate bracket")
    
    # Determine bracket size and starting round
    bracket_sizes = [2, 4, 8, 16, 32]
    bracket_size = min([s for s in bracket_sizes if s >= num_pairs], default=32)
    
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
    
    # Shuffle pairs
    import random
    random.shuffle(pairs)
    
    matches = []
    for i in range(matches_count):
        match_id = f"match_{uuid.uuid4().hex[:12]}"
        
        pair1 = pairs[i * 2] if i * 2 < len(pairs) else None
        pair2 = pairs[i * 2 + 1] if i * 2 + 1 < len(pairs) else None
        
        match = {
            "match_id": match_id,
            "tournament_id": tournament_id,
            "round": starting_round,
            "match_number": i + 1,
            "pair1_id": pair1["pair_id"] if pair1 else None,
            "pair1_name": pair1["pair_name"] if pair1 else "BYE",
            "pair1_players": [pair1["player1_id"], pair1["player2_id"]] if pair1 else [],
            "pair2_id": pair2["pair_id"] if pair2 else None,
            "pair2_name": pair2["pair_name"] if pair2 else "BYE",
            "pair2_players": [pair2["player1_id"], pair2["player2_id"]] if pair2 else [],
            "winner_pair_id": None,
            "winner_pair_name": None,
            "winner_players": [],
            "sets": [],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Auto-win for BYEs
        if pair1 and not pair2:
            match["winner_pair_id"] = pair1["pair_id"]
            match["winner_pair_name"] = pair1["pair_name"]
            match["winner_players"] = [pair1["player1_id"], pair1["player2_id"]]
            match["status"] = "completed"
        elif pair2 and not pair1:
            match["winner_pair_id"] = pair2["pair_id"]
            match["winner_pair_name"] = pair2["pair_name"]
            match["winner_players"] = [pair2["player1_id"], pair2["player2_id"]]
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
                "pair1_id": None,
                "pair1_name": "TBD",
                "pair1_players": [],
                "pair2_id": None,
                "pair2_name": "TBD",
                "pair2_players": [],
                "winner_pair_id": None,
                "winner_pair_name": None,
                "winner_players": [],
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
    
    completed = await db.matches.find({
        "tournament_id": tournament_id,
        "round": round_name,
        "status": "completed"
    }, {"_id": 0}).to_list(100)
    
    next_matches = await db.matches.find({
        "tournament_id": tournament_id,
        "round": next_round
    }, {"_id": 0}).sort("match_number", 1).to_list(100)
    
    for match in completed:
        if not match["winner_pair_id"]:
            continue
            
        next_match_num = (match["match_number"] - 1) // 2 + 1
        
        if next_match_num <= len(next_matches):
            next_match = next_matches[next_match_num - 1]
            is_slot_1 = match["match_number"] % 2 == 1
            
            update_fields = {}
            if is_slot_1:
                update_fields["pair1_id"] = match["winner_pair_id"]
                update_fields["pair1_name"] = match["winner_pair_name"]
                update_fields["pair1_players"] = match["winner_players"]
            else:
                update_fields["pair2_id"] = match["winner_pair_id"]
                update_fields["pair2_name"] = match["winner_pair_name"]
                update_fields["pair2_players"] = match["winner_players"]
            
            await db.matches.update_one(
                {"match_id": next_match["match_id"]},
                {"$set": update_fields}
            )

@api_router.get("/tournaments/{tournament_id}/matches")
async def get_tournament_matches(tournament_id: str):
    """Get all matches - PUBLIC"""
    matches = await db.matches.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    
    rounds_order = ["round_of_16", "quarterfinals", "semifinals", "final"]
    result = {r: [] for r in rounds_order}
    
    for match in matches:
        round_name = match["round"]
        if round_name in result:
            result[round_name].append(match)
    
    for round_name in result:
        result[round_name].sort(key=lambda x: x["match_number"])
    
    return result

@api_router.put("/matches/{match_id}/result")
async def update_match_result(match_id: str, result: MatchResultUpdate, request: Request):
    """Update match result - ADMIN ONLY"""
    await get_admin_user(request)
    
    match = await db.matches.find_one({"match_id": match_id}, {"_id": 0})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if result.winner_pair_id not in [match["pair1_id"], match["pair2_id"]]:
        raise HTTPException(status_code=400, detail="Winner must be one of the pairs")
    
    sets = [
        {"pair1": result.set1_pair1, "pair2": result.set1_pair2},
        {"pair1": result.set2_pair1, "pair2": result.set2_pair2}
    ]
    if result.set3_pair1 is not None and result.set3_pair2 is not None:
        sets.append({"pair1": result.set3_pair1, "pair2": result.set3_pair2})
    
    winner_name = match["pair1_name"] if result.winner_pair_id == match["pair1_id"] else match["pair2_name"]
    winner_players = match["pair1_players"] if result.winner_pair_id == match["pair1_id"] else match["pair2_players"]
    
    await db.matches.update_one(
        {"match_id": match_id},
        {"$set": {
            "winner_pair_id": result.winner_pair_id,
            "winner_pair_name": winner_name,
            "winner_players": winner_players,
            "sets": sets,
            "status": "completed"
        }}
    )
    
    # Advance winner to next round
    await advance_winner(match["tournament_id"], match["round"], match["match_number"], 
                        result.winner_pair_id, winner_name, winner_players)
    
    # Check if tournament is complete
    await check_tournament_completion(match["tournament_id"])
    
    return {"message": "Result saved", "winner": winner_name}

async def advance_winner(tournament_id: str, current_round: str, match_number: int, 
                        winner_id: str, winner_name: str, winner_players: list):
    """Advance winner to next round"""
    rounds_order = ["round_of_16", "quarterfinals", "semifinals", "final"]
    
    if current_round not in rounds_order:
        return
    
    current_idx = rounds_order.index(current_round)
    if current_idx >= len(rounds_order) - 1:
        return
    
    next_round = rounds_order[current_idx + 1]
    next_match_num = (match_number - 1) // 2 + 1
    
    next_match = await db.matches.find_one({
        "tournament_id": tournament_id,
        "round": next_round,
        "match_number": next_match_num
    })
    
    if not next_match:
        return
    
    is_slot_1 = match_number % 2 == 1
    
    update_fields = {}
    if is_slot_1:
        update_fields["pair1_id"] = winner_id
        update_fields["pair1_name"] = winner_name
        update_fields["pair1_players"] = winner_players
    else:
        update_fields["pair2_id"] = winner_id
        update_fields["pair2_name"] = winner_name
        update_fields["pair2_players"] = winner_players
    
    await db.matches.update_one(
        {"match_id": next_match["match_id"]},
        {"$set": update_fields}
    )

async def check_tournament_completion(tournament_id: str):
    """Check if tournament is complete and assign points"""
    final = await db.matches.find_one({
        "tournament_id": tournament_id,
        "round": "final"
    }, {"_id": 0})
    
    if not final or final["status"] != "completed":
        return
    
    tournament = await db.tournaments.find_one({"tournament_id": tournament_id}, {"_id": 0})
    matches = await db.matches.find({"tournament_id": tournament_id}, {"_id": 0}).to_list(100)
    
    # Track pair results
    pair_results = {}
    
    for match in matches:
        if match["status"] != "completed":
            continue
            
        round_name = match["round"]
        winner_id = match.get("winner_pair_id")
        loser_id = match["pair1_id"] if match["pair2_id"] == winner_id else match["pair2_id"]
        loser_players = match["pair1_players"] if match["pair2_id"] == winner_id else match["pair2_players"]
        
        if winner_id:
            if winner_id not in pair_results:
                pair_results[winner_id] = {
                    "best_round": round_name, 
                    "is_winner": False,
                    "players": match["winner_players"]
                }
            
            if round_name == "final":
                pair_results[winner_id]["is_winner"] = True
                pair_results[winner_id]["best_round"] = "champion"
        
        if loser_id and loser_players:
            if loser_id not in pair_results:
                pair_results[loser_id] = {
                    "best_round": round_name, 
                    "is_winner": False,
                    "players": loser_players
                }
            
            if round_name == "final":
                pair_results[loser_id]["best_round"] = "finalist"
            elif round_name == "semifinals":
                pair_results[loser_id]["best_round"] = "semifinalist"
            elif round_name == "quarterfinals":
                pair_results[loser_id]["best_round"] = "quarterfinalist"
            elif round_name == "round_of_16":
                pair_results[loser_id]["best_round"] = "round_of_16"
    
    # Assign points to EACH PLAYER in the pair - BY CATEGORY
    category = tournament.get("category", "4ta")
    
    for pair_id, result in pair_results.items():
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
            # Update points for BOTH players in the pair
            for player_id in result.get("players", []):
                # Update total points and category-specific points
                await db.users.update_one(
                    {"user_id": player_id},
                    {
                        "$inc": {
                            "total_points": points, 
                            "tournaments_played": 1,
                            f"points_by_category.{category}": points
                        }
                    }
                )
                
                # Record points history with category
                await db.points_history.insert_one({
                    "history_id": f"ph_{uuid.uuid4().hex[:12]}",
                    "user_id": player_id,
                    "pair_id": pair_id,
                    "tournament_id": tournament_id,
                    "tournament_name": tournament.get("name", ""),
                    "category": category,
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
async def get_ranking(category: Optional[str] = None, limit: int = 50):
    """Get ranking - PUBLIC. Filter by category if provided."""
    
    if category:
        # Ranking by specific category
        users = await db.users.find(
            {f"points_by_category.{category}": {"$gt": 0}},
            {"_id": 0, "password_hash": 0}
        ).to_list(1000)
        
        # Sort by category points
        users.sort(key=lambda x: x.get("points_by_category", {}).get(category, 0), reverse=True)
        users = users[:limit]
        
        ranking = []
        for idx, user in enumerate(users, 1):
            category_points = user.get("points_by_category", {}).get(category, 0)
            ranking.append({
                "position": idx,
                "user_id": user["user_id"],
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "total_points": category_points,
                "tournaments_played": user.get("tournaments_played", 0),
                "category": category
            })
    else:
        # Global ranking (all categories combined)
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
                "tournaments_played": user.get("tournaments_played", 0),
                "category": "all"
            })
    
    return ranking

@api_router.get("/categories")
async def get_categories():
    """Get all available categories - PUBLIC"""
    return ["7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"]

@api_router.get("/users/{user_id}/points-history")
async def get_user_points_history(user_id: str, request: Request):
    await get_current_user(request)
    history = await db.points_history.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return history

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed database with sample data"""
    await db.users.delete_many({})
    await db.tournaments.delete_many({})
    await db.pairs.delete_many({})
    await db.matches.delete_many({})
    await db.points_history.delete_many({})
    await db.user_sessions.delete_many({})
    
    # Create admin
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
        "points_by_category": {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin)
    
    # Create sample players with points distributed across categories
    players_data = [
        {"first_name": "Juan", "last_name": "Martín", "email": "juan@test.com", 
         "points": 2600, "points_by_category": {"4ta": 1600, "5ta": 1000}},
        {"first_name": "Carlos", "last_name": "Rodríguez", "email": "carlos@test.com", 
         "points": 2200, "points_by_category": {"4ta": 1600, "3ra": 600}},
        {"first_name": "Miguel", "last_name": "Fernández", "email": "miguel@test.com", 
         "points": 1560, "points_by_category": {"5ta": 1200, "4ta": 360}},
        {"first_name": "Pablo", "last_name": "García", "email": "pablo@test.com", 
         "points": 1200, "points_by_category": {"5ta": 1200}},
        {"first_name": "Diego", "last_name": "López", "email": "diego@test.com", 
         "points": 1080, "points_by_category": {"4ta": 720, "3ra": 360}},
        {"first_name": "Andrés", "last_name": "Sánchez", "email": "andres@test.com", 
         "points": 720, "points_by_category": {"5ta": 720}},
        {"first_name": "Lucas", "last_name": "Martínez", "email": "lucas@test.com", 
         "points": 540, "points_by_category": {"4ta": 360, "5ta": 180}},
        {"first_name": "Mateo", "last_name": "González", "email": "mateo@test.com", 
         "points": 360, "points_by_category": {"5ta": 360}},
        {"first_name": "Tomás", "last_name": "Díaz", "email": "tomas@test.com", 
         "points": 180, "points_by_category": {"4ta": 180}},
        {"first_name": "Nicolás", "last_name": "Ruiz", "email": "nicolas@test.com", 
         "points": 180, "points_by_category": {"5ta": 180}},
    ]
    
    user_ids = []
    for p in players_data:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_ids.append(user_id)
        await db.users.insert_one({
            "user_id": user_id,
            "first_name": p["first_name"],
            "last_name": p["last_name"],
            "email": p["email"],
            "password_hash": hash_password("test123"),
            "role": "user",
            "total_points": p["points"],
            "tournaments_played": p["points"] // 360 + 1,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Create sample tournaments
    tournaments_data = [
        {"name": "Torneo de Verano 2024", "category": "4ta", "date": "2024-12-15", "max_pairs": 8, "status": "open"},
        {"name": "Copa Navidad", "category": "5ta", "date": "2024-12-22", "max_pairs": 4, "status": "open"},
        {"name": "Master Series Otoño", "category": "3ra", "date": "2024-11-30", "max_pairs": 8, "status": "finished"},
    ]
    
    for t in tournaments_data:
        tournament_id = f"tournament_{uuid.uuid4().hex[:12]}"
        await db.tournaments.insert_one({
            "tournament_id": tournament_id,
            "name": t["name"],
            "category": t["category"],
            "date": t["date"],
            "max_pairs": t["max_pairs"],
            "current_pairs": 0,
            "status": t["status"],
            "description": f"Torneo de pádel categoría {t['category']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "message": "Database seeded successfully",
        "admin_credentials": {"email": "admin@padel.com", "password": "admin123"},
        "test_user_credentials": {"email": "juan@test.com", "password": "test123"},
        "note": "Players created without pairs - use admin panel to create pairs"
    }

# Include router and configure CORS
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:3000",
        "https://localhost:3000",
    ] + [origin.strip() for origin in os.environ.get('CORS_ORIGINS', '').split(',') if origin.strip() and origin.strip() != '*'],
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
