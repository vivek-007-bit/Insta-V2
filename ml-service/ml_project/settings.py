import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-ml-service-secret-change-in-prod")
DEBUG = os.environ.get("DEBUG", os.environ.get("DJANGO_DEBUG", "false")).strip().lower() == "true"

def _clean_host(h: str) -> str:
    h = h.strip()
    if h.startswith("http://"):
        h = h[7:]
    elif h.startswith("https://"):
        h = h[8:]
    # strip port if present (e.g., localhost:8000 -> localhost)
    if ":" in h and not h.startswith("["):
        h = h.split(":")[0]
    return h.strip()


raw_allowed = (
    os.environ.get("ALLOWED_HOSTS")
    or os.environ.get("DJANGO_ALLOWED_HOSTS")
    or "localhost,127.0.0.1,.onrender.com"
)
parsed_hosts = [_clean_host(h) for h in raw_allowed.split(",") if _clean_host(h)]

# Always ensure local loopback hosts are accepted for development and internal communication
for default_host in ["127.0.0.1", "localhost", "0.0.0.0", "testserver"]:
    if default_host not in parsed_hosts:
        parsed_hosts.append(default_host)

if "*" not in parsed_hosts and ".onrender.com" not in parsed_hosts:
    parsed_hosts.append(".onrender.com")

ALLOWED_HOSTS = parsed_hosts

ML_INTERNAL_API_KEY = (
    os.environ.get("INTERNAL_SERVICE_SECRET")
    or os.environ.get("ML_INTERNAL_API_KEY")
    or ""
).strip()

PORT = int(os.environ.get("PORT", "8001"))

# Respect Render's reverse proxy for SSL
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "recommendations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "ml_project.urls"

TEMPLATES = []

WSGI_APPLICATION = "ml_project.wsgi.application"

# Minimal SQLite DB only for Django's test runner; recommendation data comes via secured Node context
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "UNAUTHENTICATED_USER": None,
}
