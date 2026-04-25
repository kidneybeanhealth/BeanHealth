from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
import os, bcrypt, jwt, logging, random
from datetime import datetime, timezone, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, mr_id: str) -> str:
    payload = {
        "sub": user_id,
        "mr_id": mr_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


def serialize_doc(doc: dict) -> dict:
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.patients.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


app = FastAPI()
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class PatientRegister(BaseModel):
    mr_id: str
    name: str
    father_name: str
    dob: str
    diagnosis: str
    password: str


class PatientLogin(BaseModel):
    mr_id: str
    password: str


class VitalCreate(BaseModel):
    vital_type: str
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: Optional[str] = None


class VitalUpdate(BaseModel):
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None


class MedicationCheck(BaseModel):
    prescription_id: str
    medication_name: str
    date: str
    taken: bool


# ── Auth Routes ───────────────────────────────────────────────────────────────

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token", value=access_token, httponly=True,
        secure=True, samesite="none", max_age=28800, path="/"
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token, httponly=True,
        secure=True, samesite="none", max_age=604800, path="/"
    )


@api_router.post("/auth/register")
async def register(data: PatientRegister, response: Response):
    mr_id = data.mr_id.upper().strip()
    if await db.patients.find_one({"mr_id": mr_id}):
        raise HTTPException(status_code=400, detail="MR ID already registered")
    patient = {
        "mr_id": mr_id,
        "name": data.name.strip(),
        "father_name": data.father_name.strip(),
        "dob": data.dob,
        "diagnosis": data.diagnosis.strip(),
        "password_hash": hash_password(data.password),
        "doctor_id": None,
        "doctor_name": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.patients.insert_one(patient)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, mr_id)
    refresh_token_val = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token_val)
    return {
        "id": user_id, "mr_id": mr_id, "name": data.name,
        "father_name": data.father_name, "dob": data.dob,
        "diagnosis": data.diagnosis, "token": access_token,
    }


@api_router.post("/auth/login")
async def login(data: PatientLogin, response: Response):
    mr_id = data.mr_id.upper().strip()
    user = await db.patients.find_one({"mr_id": mr_id})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid MR ID or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, mr_id)
    refresh_token_val = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token_val)
    return {
        "id": user_id,
        "mr_id": user["mr_id"],
        "name": user.get("name", ""),
        "father_name": user.get("father_name", ""),
        "dob": user.get("dob", ""),
        "diagnosis": user.get("diagnosis", ""),
        "doctor_id": user.get("doctor_id"),
        "doctor_name": user.get("doctor_name"),
        "token": access_token,
    }


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", samesite="none", secure=True)
    response.delete_cookie("refresh_token", path="/", samesite="none", secure=True)
    return {"message": "Logged out"}


@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.patients.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(str(user["_id"]), user["mr_id"])
        response.set_cookie(
            key="access_token", value=new_access, httponly=True,
            secure=True, samesite="none", max_age=28800, path="/"
        )
        return {"token": new_access}
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Vitals Routes ─────────────────────────────────────────────────────────────

@api_router.get("/vitals/today")
async def get_today_vitals(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    vitals = await db.vitals.find({
        "patient_id": current_user["_id"] if "_id" in current_user else current_user["id"],
        "recorded_at": {"$regex": f"^{today}"}
    }).to_list(100)
    return [serialize_doc(v) for v in vitals]


@api_router.get("/vitals")
async def get_vitals(
    vital_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    pid = current_user.get("id") or current_user.get("_id")
    query: dict = {"patient_id": pid}
    if vital_type:
        query["vital_type"] = vital_type
    date_filter: dict = {}
    if from_date:
        date_filter["$gte"] = from_date
    if to_date:
        date_filter["$lte"] = to_date + "T23:59:59"
    if date_filter:
        query["recorded_at"] = date_filter
    vitals = await db.vitals.find(query).sort("recorded_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(v) for v in vitals]


@api_router.post("/vitals")
async def create_vital(data: VitalCreate, current_user: dict = Depends(get_current_user)):
    pid = current_user.get("id") or current_user.get("_id")
    recorded_at = data.recorded_at or datetime.now(timezone.utc).isoformat()
    vital = {
        "patient_id": pid,
        "vital_type": data.vital_type,
        "systolic": data.systolic,
        "diastolic": data.diastolic,
        "value": data.value,
        "unit": data.unit or "",
        "notes": data.notes or "",
        "recorded_at": recorded_at,
    }
    result = await db.vitals.insert_one(vital)
    vital["id"] = str(result.inserted_id)
    vital.pop("_id", None)
    return vital


@api_router.put("/vitals/{vital_id}")
async def update_vital(
    vital_id: str, data: VitalUpdate, current_user: dict = Depends(get_current_user)
):
    pid = current_user.get("id") or current_user.get("_id")
    existing = await db.vitals.find_one({"_id": ObjectId(vital_id), "patient_id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="Vital not found")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.vitals.update_one({"_id": ObjectId(vital_id)}, {"$set": update_data})
    updated = await db.vitals.find_one({"_id": ObjectId(vital_id)})
    return serialize_doc(updated)


@api_router.delete("/vitals/{vital_id}")
async def delete_vital(vital_id: str, current_user: dict = Depends(get_current_user)):
    pid = current_user.get("id") or current_user.get("_id")
    existing = await db.vitals.find_one({"_id": ObjectId(vital_id), "patient_id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="Vital not found")
    await db.vitals.delete_one({"_id": ObjectId(vital_id)})
    return {"message": "Deleted"}


# ── Prescriptions Routes ──────────────────────────────────────────────────────

@api_router.get("/prescriptions")
async def get_prescriptions(current_user: dict = Depends(get_current_user)):
    pid = current_user.get("id") or current_user.get("_id")
    prescriptions = await db.prescriptions.find({"patient_id": pid}).sort("date", -1).to_list(50)
    return [serialize_doc(p) for p in prescriptions]


# ── Medication Routes ─────────────────────────────────────────────────────────

@api_router.get("/medication/today")
async def get_today_medication(current_user: dict = Depends(get_current_user)):
    pid = current_user.get("id") or current_user.get("_id")
    latest = await db.prescriptions.find_one({"patient_id": pid}, sort=[("date", -1)])
    if not latest:
        return {"prescription": None, "checklist": []}
    prescription_id = str(latest["_id"])
    today = datetime.now(timezone.utc).date().isoformat()
    adherence = await db.medication_adherence.find({
        "patient_id": pid, "prescription_id": prescription_id, "date": today
    }).to_list(100)
    adherence_map = {r["medication_name"]: r["taken"] for r in adherence}
    checklist = [
        {
            "medication_name": med["name"],
            "dosage": med.get("dosage", ""),
            "frequency": med.get("frequency", ""),
            "notes": med.get("notes", ""),
            "taken": adherence_map.get(med["name"], False),
            "date": today,
        }
        for med in latest.get("medications", [])
    ]
    return {
        "prescription": {
            "id": prescription_id,
            "doctor_name": latest.get("doctor_name", ""),
            "date": latest.get("date", ""),
            "notes": latest.get("notes", ""),
        },
        "checklist": checklist,
    }


@api_router.post("/medication/check")
async def check_medication(data: MedicationCheck, current_user: dict = Depends(get_current_user)):
    pid = current_user.get("id") or current_user.get("_id")
    existing = await db.medication_adherence.find_one({
        "patient_id": pid, "prescription_id": data.prescription_id,
        "date": data.date, "medication_name": data.medication_name,
    })
    if existing:
        await db.medication_adherence.update_one(
            {"_id": existing["_id"]},
            {"$set": {"taken": data.taken, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        await db.medication_adherence.insert_one({
            "patient_id": pid, "prescription_id": data.prescription_id,
            "date": data.date, "medication_name": data.medication_name,
            "taken": data.taken, "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"message": "Updated"}


@api_router.get("/medication/adherence")
async def get_adherence(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    pid = current_user.get("id") or current_user.get("_id")
    query: dict = {"patient_id": pid}
    date_filter: dict = {}
    if from_date:
        date_filter["$gte"] = from_date
    if to_date:
        date_filter["$lte"] = to_date
    if date_filter:
        query["date"] = date_filter
    records = await db.medication_adherence.find(query).sort("date", -1).to_list(500)
    return [serialize_doc(r) for r in records]


# ── Profile Routes ────────────────────────────────────────────────────────────

@api_router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return current_user


# ── Seed & Startup ────────────────────────────────────────────────────────────

async def seed_demo_data():
    if await db.patients.find_one({"mr_id": "MR001"}):
        return
    random.seed(42)
    patient = {
        "mr_id": "MR001",
        "name": "Ramesh Kumar",
        "father_name": "Suresh Kumar",
        "dob": "1975-06-15",
        "diagnosis": "End Stage Renal Disease - Post Kidney Transplant (2022)",
        "password_hash": hash_password("demo123"),
        "doctor_id": None,
        "doctor_name": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.patients.insert_one(patient)
    pid = str(result.inserted_id)

    presc_date = (datetime.now(timezone.utc) - timedelta(days=10)).date().isoformat()
    presc_result = await db.prescriptions.insert_one({
        "patient_id": pid,
        "doctor_id": None,
        "doctor_name": "Dr. Arvind Sharma",
        "date": presc_date,
        "medications": [
            {"name": "Tacrolimus 1mg", "dosage": "1mg", "frequency": "Twice daily", "notes": "Take 12 hours apart"},
            {"name": "Mycophenolate Mofetil 500mg", "dosage": "500mg", "frequency": "Twice daily", "notes": ""},
            {"name": "Prednisolone 5mg", "dosage": "5mg", "frequency": "Once daily (morning)", "notes": ""},
            {"name": "Amlodipine 5mg", "dosage": "5mg", "frequency": "Once daily", "notes": ""},
            {"name": "Pantoprazole 40mg", "dosage": "40mg", "frequency": "Once daily (before breakfast)", "notes": ""},
        ],
        "notes": "Continue immunosuppression. Monitor BP daily. Low-potassium, low-phosphorus diet.",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    presc_id = str(presc_result.inserted_id)

    # Add older prescription too
    older_date = (datetime.now(timezone.utc) - timedelta(days=40)).date().isoformat()
    await db.prescriptions.insert_one({
        "patient_id": pid,
        "doctor_id": None,
        "doctor_name": "Dr. Arvind Sharma",
        "date": older_date,
        "medications": [
            {"name": "Tacrolimus 1mg", "dosage": "1mg", "frequency": "Twice daily", "notes": ""},
            {"name": "Mycophenolate Mofetil 500mg", "dosage": "500mg", "frequency": "Twice daily", "notes": ""},
            {"name": "Prednisolone 10mg", "dosage": "10mg", "frequency": "Once daily (morning)", "notes": "Tapered dose"},
            {"name": "Amlodipine 5mg", "dosage": "5mg", "frequency": "Once daily", "notes": ""},
        ],
        "notes": "Initial post-transplant protocol. Reduce prednisolone over next month.",
        "created_at": (datetime.now(timezone.utc) - timedelta(days=40)).isoformat(),
    })

    bp_vals = [(128, 80), (135, 85), (130, 82), (138, 88), (132, 83), (127, 79), (133, 84), (136, 86), (129, 81), (131, 82), (140, 90), (126, 78), (134, 85), (137, 87)]
    weights = [72.4, 72.6, 72.3, 72.8, 72.5, 72.7, 72.4, 72.9, 72.6, 72.3, 72.5, 72.8, 72.4, 72.6]
    glucoses = [105, 118, 110, 132, 108, 115, 122, 128, 112, 108, 135, 103, 120, 117]
    urines = [1450, 1380, 1520, 1490, 1410, 1560, 1430, 1480, 1510, 1390, 1470, 1540, 1460, 1420]

    for i in range(14):
        day = (datetime.now(timezone.utc) - timedelta(days=14 - i)).date().isoformat()
        rec = f"{day}T08:00:00+00:00"
        await db.vitals.insert_many([
            {"patient_id": pid, "vital_type": "bp", "systolic": bp_vals[i][0], "diastolic": bp_vals[i][1], "value": None, "unit": "mmHg", "notes": "", "recorded_at": rec},
            {"patient_id": pid, "vital_type": "weight", "systolic": None, "diastolic": None, "value": weights[i], "unit": "kg", "notes": "", "recorded_at": rec},
            {"patient_id": pid, "vital_type": "glucose", "systolic": None, "diastolic": None, "value": glucoses[i], "unit": "mg/dL", "notes": "", "recorded_at": rec},
            {"patient_id": pid, "vital_type": "urine", "systolic": None, "diastolic": None, "value": urines[i], "unit": "mL/24h", "notes": "", "recorded_at": rec},
        ])

    # Seed some medication adherence for past 3 days
    med_names = ["Tacrolimus 1mg", "Mycophenolate Mofetil 500mg", "Prednisolone 5mg", "Amlodipine 5mg", "Pantoprazole 40mg"]
    for i in range(3):
        day = (datetime.now(timezone.utc) - timedelta(days=i + 1)).date().isoformat()
        for med in med_names:
            await db.medication_adherence.insert_one({
                "patient_id": pid, "prescription_id": presc_id,
                "date": day, "medication_name": med,
                "taken": True, "updated_at": datetime.now(timezone.utc).isoformat(),
            })

    logger.info("Demo data seeded: MR001 / demo123")


@app.on_event("startup")
async def startup():
    await db.patients.create_index("mr_id", unique=True)
    await db.vitals.create_index([("patient_id", 1), ("recorded_at", -1)])
    await db.medication_adherence.create_index([("patient_id", 1), ("date", -1)])
    await seed_demo_data()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api_router)
