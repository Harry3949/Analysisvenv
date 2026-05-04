import os
import librosa
import numpy as np
import datetime
import shutil
import time
from typing import Optional
from fastapi import FastAPI, Form, Request, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from passlib.context import CryptContext
from jose import JWTError, jwt
import random

# --- 配置・設定 ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SONGS_DIR = os.path.join(BASE_DIR, "songs")
ICONS_DIR = os.path.join(BASE_DIR, "static", "img", "icons")
os.makedirs(SONGS_DIR, exist_ok=True)
os.makedirs(ICONS_DIR, exist_ok=True)

DATABASE_URL = "sqlite:///./analysis_lab.db"
SECRET_KEY = "crypton_future_media_tribute_key"
ALGORITHM = "HS256"

# --- データベース設定 ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    icon_url = Column(String, default="https://api.dicebear.com/7.x/avataaars/svg?seed=default")

class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    song_name = Column(String)
    bpm = Column(Float)
    key = Column(String)
    mood = Column(String)
    comment = Column(String)
    freq_balance = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

# --- 認証設定 ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = db.query(User).filter(User.username == username).first()
        return user
    except JWTError:
        return None

# --- アプリケーション初期化 ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/songs", StaticFiles(directory=SONGS_DIR), name="songs")
templates = Jinja2Templates(directory="templates")

# --- 翻訳データ ---
TRANSLATIONS = {
    "ja": {
        "lang_code": "ja",
        "subtitle": "楽曲を解析し、音の特性を視覚化します",
        "btn_analyze": "解析開始",
        "btn_upload": ".WAVをアップロード",
        "upload_text": "自分の曲を解析する:",
        "community_title": "コミュニティ最近の解析",
        "login_btn": "ログイン / 新規登録",
        "logout": "ログアウト",
        "back": "← 楽曲選択に戻る",
        "auth_login": "ログイン",
        "auth_signup": "新規登録",
        "auth_cancel": "キャンセル",
        "auth_no_account": "アカウントをお持ちでない方: 新規登録",
        "auth_has_account": "既にアカウントをお持ちの方: ログイン",
        "stat_track": "曲名",
        "stat_bpm": "BPM",
        "stat_key": "キー",
        "stat_mood": "雰囲気 / 音色",
        "stat_freq": "周波数バランス",
        "community_nav": "音楽性診断",
        "community_title": "AI音楽性診断",
        "mypage_nav": "マイページ",
        "my_history": "あなたの解析履歴",
        "update_icon": "アイコンを更新",
        "delete_confirm": "本当に削除しますか？",
    },
    "en": {
        "lang_code": "en",
        "subtitle": "Analyze tracks and visualize audio characteristics",
        "btn_analyze": "ANALYSIS START",
        "btn_upload": "UPLOAD .WAV",
        "upload_text": "Own your music? Upload here:",
        "community_title": "COMMUNITY RECENT ANALYSES",
        "login_btn": "LOGIN / SIGNUP",
        "logout": "LOGOUT",
        "back": "← Back to Selection",
        "auth_login": "LOGIN",
        "auth_signup": "SIGNUP",
        "auth_cancel": "CANCEL",
        "auth_no_account": "Don't have an account? Signup",
        "auth_has_account": "Already have an account? Login",
        "stat_track": "Track Name",
        "stat_bpm": "BPM",
        "stat_key": "Key",
        "stat_mood": "Mood / Tone",
        "stat_freq": "Frequency Balance",
        "community_nav": "DIAGNOSIS",
        "community_title": "AI MUSIC DIAGNOSIS",
        "mypage_nav": "MY PAGE",
        "my_history": "YOUR HISTORY",
        "update_icon": "UPDATE ICON",
        "delete_confirm": "Are you sure you want to delete this?",
    }
}

# --- ルート設定 ---

@app.get("/")
async def index(request: Request, lang: Optional[str] = None, user=Depends(get_current_user)):
    # 言語設定の取得 (クエリ -> クッキー -> デフォルトja)
    current_lang = lang or request.cookies.get("lang", "ja")
    if current_lang not in TRANSLATIONS:
        current_lang = "ja"
    
    t = TRANSLATIONS[current_lang]
    response = templates.TemplateResponse(request=request, name="index.html", context={"user": user, "t": t})
    response.set_cookie(key="lang", value=current_lang)
    return response

@app.get("/diagnosis")
async def diagnosis_page(request: Request, lang: Optional[str] = None, user=Depends(get_current_user)):
    current_lang = lang or request.cookies.get("lang", "ja")
    if current_lang not in TRANSLATIONS:
        current_lang = "ja"
    
    t = TRANSLATIONS[current_lang]
    return templates.TemplateResponse(request=request, name="diagnosis.html", context={"user": user, "t": t})

@app.get("/mypage")
async def mypage(request: Request, lang: Optional[str] = None, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        return RedirectResponse(url="/")
    
    current_lang = lang or request.cookies.get("lang", "ja")
    if current_lang not in TRANSLATIONS:
        current_lang = "ja"
    t = TRANSLATIONS[current_lang]
    
    # 自分の解析履歴を取得
    history = db.query(Analysis).filter(Analysis.user_id == user.id).order_by(Analysis.created_at.desc()).all()
    
    return templates.TemplateResponse(request=request, name="mypage.html", context={"user": user, "t": t, "history": history})

@app.post("/delete_analysis/{analysis_id}")
async def delete_analysis(analysis_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id, Analysis.user_id == user.id).first()
    if not analysis:
        raise HTTPException(status_code=404)
    db.delete(analysis)
    db.commit()
    return {"message": "Deleted"}

@app.post("/update_profile")
async def update_profile(icon_file: UploadFile = File(...), user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401)
    
    # ファイル保存
    ext = icon_file.filename.split(".")[-1]
    filename = f"user_{user.id}.{ext}"
    file_path = os.path.join(ICONS_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(icon_file.file, buffer)
    
    user.icon_url = f"/static/img/icons/{filename}?t={int(time.time())}"
    db.commit()
    return RedirectResponse(url="/mypage", status_code=303)

@app.get("/set_lang/{lang}")
async def set_lang(lang: str):
    response = RedirectResponse(url="/")
    response.set_cookie(key="lang", value=lang)
    return response

@app.post("/signup")
async def signup(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    hashed_password = pwd_context.hash(password)
    # デフォルトアイコンとしてロゴを使用
    icon_url = "/static/img/logo.png"
    db_user = User(username=username, hashed_password=hashed_password, icon_url=icon_url)
    try:
        db.add(db_user)
        db.commit()
    except:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": "User created"}

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not pwd_context.verify(password, user.hashed_password):
        return JSONResponse(status_code=400, content={"detail": "Incorrect username or password"})
    
    token = jwt.encode({"sub": user.username}, SECRET_KEY, algorithm=ALGORITHM)
    response = JSONResponse(content={"message": "Logged in"})
    response.set_cookie(key="access_token", value=token, httponly=True)
    return response

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/")
    response.delete_cookie("access_token")
    return response

@app.get("/samples")
async def get_samples():
    files = [f for f in os.listdir(SONGS_DIR) if f.endswith(".wav")]
    return {"samples": sorted(files)}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not file.filename.endswith(".wav"):
        raise HTTPException(status_code=400, detail="Only .wav files are allowed")
    
    file_path = os.path.join(SONGS_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"filename": file.filename}

@app.post("/analyze")
async def analyze(request: Request, song_name: str = Form(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    file_path = os.path.join(SONGS_DIR, song_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # 解析 (librosa)
    y, sr = librosa.load(file_path, sr=22050, duration=15)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(tempo) if not isinstance(tempo, np.ndarray) else float(tempo[0])
    
    # 周波数特性
    S = np.abs(librosa.stft(y))
    low, mid, high = np.mean(S[:len(S)//3]), np.mean(S[len(S)//3:2*len(S)//3]), np.mean(S[2*len(S)//3:])
    total = low + mid + high
    low_p, mid_p, high_p = (low/total)*100, (mid/total)*100, (high/total)*100
    
    # キー
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    key = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][np.argmax(np.mean(chroma, axis=1))]
    
    # 判定
    mood_type = "Energetic" if bpm > 120 else "Ambient / Calm" if np.mean(librosa.feature.rms(y=y)) < 0.02 else "Balanced"
    tone_type = "Bright" if np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)) > 2000 else "Dark"
    mood_full = f"{mood_type} / {tone_type}"

    # 言語に応じた動的コメント生成 (ランダム性と組み合わせでバリエーションを最大化)
    lang = request.cookies.get("lang", "ja")
    
    if lang == "ja":
        # 1. テンポの印象 (パーツをリスト化してランダムに選択)
        if bpm > 150:
            t_parts = [
                f"BPM {int(bpm)}という非常に高いテンポが緊張感を生み出しており、",
                f"高速なビートが楽曲全体をアッパーに牽引しており、",
                f"圧倒的な疾走感を持つリズムセクションが特徴で、"
            ]
        elif bpm > 110:
            t_parts = [
                f"BPM {int(bpm)}の安定したリズムキープが非常に心地よく、",
                "標準的でノリの良いグルーヴ感が楽曲の土台を支えており、",
                "親しみやすいテンポ設定がリスナーを選ばない構成で、"
            ]
        else:
            t_parts = [
                f"BPM {int(bpm)}のゆったりとした時間が流れるようなテンポ感で、",
                "落ち着いたリズムの刻みが深い没入感を演出しており、",
                "メロウなテンポ設定が心地よいチルな空気を醸し出しており、"
            ]

        # 2. 周波数の印象
        if low_p > 55:
            f_parts = [
                "地響きのような重厚なサブベースがサウンドの核となっています。",
                "腹に響くローエンドの処理が非常にパワフルで印象的です。",
                "低域のエネルギーが極めて強く、クラブサウンドのような迫力があります。"
            ]
        elif mid_p > 45:
            f_parts = [
                "中音域の密度が濃く、ボーカルの微細なニュアンスまで聞き取れます。",
                "メロディ楽器の帯域が非常に豊かで、温かみのある音像です。",
                "ミッドレンジが際立っており、存在感のある芯の太いサウンドです。"
            ]
        elif high_p > 35:
            f_parts = [
                "きらびやかな高域が空気感を演出し、非常にクリアな印象です。",
                "ハイエンドの抜けが良く、現代的でクリスタルな輝きを持っています。",
                "高音域の解像度が高く、シンバルや倍音が非常に美しく響きます。"
            ]
        else:
            f_parts = [
                "全帯域が緻密に計算された、フラットで美しいミックスです。",
                "特定の帯域に偏りのない、オーディオファイル向けのバランスです。",
                "非常に整理された音像で、どんな再生環境でも一貫した響きを見せます。"
            ]

        # 3. 雰囲気の結論
        if "Energetic" in mood_full:
            c_parts = [
                "聴く人を鼓舞するような、生命力に満ちた仕上がりです。",
                "ダンスフロアを沸かせるような、圧倒的なパワーを感じます。",
                "ポジティブなエネルギーが爆発する、インパクトの強い一曲です。"
            ]
        elif "Ambient" in mood_full:
            c_parts = [
                "静寂の中に深い広がりを感じる、リラックスに最適な響きです。",
                "瞑想的な没入感があり、作業用やチルタイムに極上の体験を提供します。",
                "空間を包み込むような優しさがあり、非常に心地よい余韻を残します。"
            ]
        else:
            c_parts = [
                "洗練されたオーディオバランスで、高い完成度を誇る一曲です。",
                "職人技のような調整が光る、隙のないサウンドプロダクションです。",
                "日常のあらゆるシーンに馴染む、極めて汎用性の高い音作りです。"
            ]
        
        comment = random.choice(t_parts) + random.choice(f_parts) + random.choice(c_parts)
    else:
        # English versions with randomness
        if bpm > 150:
            t_parts = [f"The high-speed BPM of {int(bpm)} creates an intense energy, ", "A fast-paced beat drives the track with incredible momentum, ", "Driven by a rapid-fire rhythmic section, "]
        elif bpm > 110:
            t_parts = [f"The steady groove at {int(bpm)} BPM feels natural and catchy, ", "A standard yet punchy tempo provides a solid foundation, ", "The accessible tempo ensures a smooth listening experience, "]
        else:
            t_parts = [f"The slow BPM of {int(bpm)} creates a spacious atmosphere, ", "A calm and measured rhythmic pulse encourages deep focus, ", "The mellow tempo delivers a perfect chill-out vibe, "]

        if low_p > 55:
            f_parts = ["the sub-bass is heavy and powerful enough to shake the room. ", "the low-end processing is remarkably punchy and impressive. ", "it features a dominant bass energy characteristic of club music. "]
        elif mid_p > 45:
            f_parts = ["the dense mid-range brings out every detail of the vocals. ", "the rich middle frequencies add warmth and character to the mix. ", "a strong mid-presence ensures the melodies are clear and bold. "]
        elif high_p > 35:
            f_parts = ["brilliant high frequencies provide a crystal-clear sense of air. ", "the crisp high-end delivers a modern and sparkling production. ", "excellent treble resolution makes the cymbals and harmonics shine. "]
        else:
            f_parts = ["the frequency distribution is perfectly balanced and flat. ", "the audio profile is well-mixed and professional across the board. ", "a meticulously organized soundstage ensures consistency on any device. "]

        if "Energetic" in mood_full:
            c_parts = ["It's a high-impact track bursting with positive energy.", "The powerful sound production is sure to light up any dance floor.", "An invigorating piece that leaves the listener feeling empowered."]
        elif "Ambient" in mood_full:
            c_parts = ["The immersive atmosphere is ideal for relaxation or deep focus.", "It creates a gentle, spatial surround feeling that is very soothing.", "A meditative experience that lingers long after the music stops."]
        else:
            c_parts = ["It boasts a sophisticated balance with professional-grade production.", "The sound design is versatile and polished for any listening scenario.", "A flawlessly executed track that fits perfectly into any curated playlist."]

        comment = random.choice(t_parts) + random.choice(f_parts) + random.choice(c_parts)

    # DB保存 (ユーザーがいれば)
    if user:
        existing = db.query(Analysis).filter(Analysis.user_id == user.id, Analysis.song_name == song_name).first()
        if existing:
            existing.bpm = round(bpm, 2)
            existing.key = key
            existing.mood = mood_full
            existing.comment = comment
            existing.freq_balance = f"Low {low_p:.1f}% / Mid {mid_p:.1f}% / High {high_p:.1f}%"
            existing.created_at = datetime.datetime.now()
        else:
            analysis = Analysis(
                user_id=user.id,
                song_name=song_name,
                bpm=round(bpm, 2),
                key=key,
                mood=mood_full,
                comment=comment,
                freq_balance=f"Low {low_p:.1f}% / Mid {mid_p:.1f}% / High {high_p:.1f}%"
            )
            db.add(analysis)
        db.commit()

    return {
        "song": song_name,
        "analysis": {
            "bpm": round(bpm, 2),
            "key": key,
            "mood": mood_full,
            "frequency_balance": f"Low {low_p:.1f}% / Mid {mid_p:.1f}% / High {high_p:.1f}%",
            "comment": comment
        }
    }

@app.get("/ranking")
async def get_ranking(db: Session = Depends(get_db)):
    # 最近の解析10件をユーザー情報付きで取得
    results = db.query(Analysis, User).join(User).order_by(Analysis.created_at.desc()).limit(10).all()
    ranking = []
    for analysis, user in results:
        ranking.append({
            "username": user.username,
            "icon_url": user.icon_url,
            "song_name": analysis.song_name,
            "bpm": analysis.bpm,
            "key": analysis.key,
            "mood": analysis.mood,
            "created_at": analysis.created_at.strftime("%Y-%m-%d %H:%M")
        })
    return {"ranking": ranking}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)