import hmac
from django.conf import settings


def verify_internal_service_request(request) -> tuple[bool, str]:
    """
    Validates internal Node.js <-> Django shared secret via constant-time comparison.
    Never exposes or logs the secret.
    """
    configured_key = getattr(settings, "ML_INTERNAL_API_KEY", "") or ""
    if not configured_key:
        return False, "Internal service key is not configured on ML service"

    provided_key = (
        request.headers.get("X-Internal-Service-Key")
        or request.headers.get("X-Internal-Service-Secret")
        or ""
    ).strip()

    if not provided_key:
        auth_hdr = request.headers.get("Authorization", "").strip()
        if auth_hdr.lower().startswith("bearer "):
            provided_key = auth_hdr[7:].strip()

    if not provided_key:
        return False, "Missing internal service authentication header (X-Internal-Service-Key or X-Internal-Service-Secret)"

    if not hmac.compare_digest(provided_key.encode("utf-8"), configured_key.encode("utf-8")):
        return False, "Invalid internal service credentials"

    return True, ""
