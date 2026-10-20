
import os
import requests
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# السماح للموقع المحلي بالتواصل مع الـ Backend
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": "http://127.0.0.1:8000"
        }
    }
)

API_TOKEN = os.getenv("FOOTBALL_API_TOKEN")
API_URL = "https://api.football-data.org/v4/matches"


@app.route("/")
def home():
    return "ST7 Backend is running!"


@app.route("/api/matches")
def get_matches():
    if not API_TOKEN:
        return jsonify({"error": "API token is missing"}), 500

    try:
        response = requests.get(
            API_URL,
            headers={"X-Auth-Token": API_TOKEN},
            timeout=15
        )

        if response.status_code != 200:
            return jsonify({
                "error": "Football API request failed",
                "status": response.status_code
            }), response.status_code

        data = response.json()
        matches = []

        for match in data.get("matches", []):
            home_team = match.get("homeTeam") or {}
            away_team = match.get("awayTeam") or {}
            score = match.get("score") or {}
            full_time = score.get("fullTime") or {}

            matches.append({
                "home": home_team.get("name", "غير معروف"),
                "away": away_team.get("name", "غير معروف"),
                "homeScore": full_time.get("home"),
                "awayScore": full_time.get("away"),
                "status": match.get("status"),
                "utcDate": match.get("utcDate"),
                "competition": (
                    match.get("competition") or {}
                ).get("name")
            })

        return jsonify({"matches": matches})

    except requests.RequestException:
        return jsonify({
            "error": "Could not connect to football API"
        }), 502


if __name__ == "__main__":
    app.run(debug=True)
