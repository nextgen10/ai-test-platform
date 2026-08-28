"""SSRF guards for operator-supplied URLs (webhooks).

Delivery runs on the orchestrator, which has cluster network access. A webhook
URL is therefore a request the platform will make on the caller's behalf, and
must not be allowed to target localhost, link-local, RFC1918, or cloud metadata.
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse, urlunparse

BLOCKED_HOSTS = frozenset(
    {
        "localhost",
        "localhost.localdomain",
        "metadata.google.internal",
        "metadata.google.internal.",
        "kubernetes",
        "kubernetes.default",
        "kubernetes.default.svc",
        "postgres",
        "ai-test-orchestrator",
        "ai-test-ui",
    }
)


class UnsafeURL(ValueError):
    """The URL is not safe to fetch from the orchestrator."""


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or ip.is_link_local
        or (ip.version == 4 and ip == ipaddress.IPv4Address("169.254.169.254"))
        or (ip.version == 6 and ip in ipaddress.IPv6Network("fd00::/8"))
    )


def _hostname_looks_local(host: str) -> bool:
    lowered = host.strip(".").lower()
    if lowered in BLOCKED_HOSTS:
        return True
    if lowered.endswith(".local") or lowered.endswith(".internal"):
        return True
    if lowered.endswith(".svc") or lowered.endswith(".cluster.local"):
        return True
    return False


def optional_https_webhook(value: str | None) -> str | None:
    """Empty or whitespace becomes None; anything else must pass :func:`validate_webhook_url`."""
    if value is None or not str(value).strip():
        return None
    return validate_webhook_url(str(value).strip())


def validate_webhook_url(url: str) -> str:
    """Reject URLs that cannot possibly be a public HTTPS endpoint.

    DNS is *not* resolved here so a create request does not hang on a
    non-existent host. Resolution happens at send time via :func:`assert_safe_to_fetch`.
    """
    text = (url or "").strip()
    if not text:
        raise UnsafeURL("webhook URL is empty")
    parsed = urlparse(text)
    if parsed.scheme != "https":
        raise UnsafeURL("webhook URLs must use https")
    if parsed.username or parsed.password:
        raise UnsafeURL("webhook URLs must not contain credentials")
    host = parsed.hostname
    if not host:
        raise UnsafeURL("webhook URL is missing a host")
    if _hostname_looks_local(host):
        raise UnsafeURL("webhook host is not allowed")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None and _is_blocked_ip(ip):
        raise UnsafeURL("webhook host resolves to a private or reserved address")
    if parsed.port in {22, 2375, 2376, 4194, 6443, 10250, 10255, 5432, 3306, 6379, 9200, 27017}:
        raise UnsafeURL("webhook port is not allowed")
    return text


def assert_safe_to_fetch(url: str) -> str:
    """Resolve the host and refuse to connect to a private address.

    Called immediately before the POST so a DNS rebinding attack cannot sneak
    a public name that later points at the metadata service.
    """
    validate_webhook_url(url)
    parsed = urlparse(url)
    host = parsed.hostname or ""
    port = parsed.port or 443
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeURL(f"webhook host could not be resolved: {exc}") from exc
    if not infos:
        raise UnsafeURL("webhook host could not be resolved")
    for info in infos:
        sockaddr = info[4]
        ip_text = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_text)
        except ValueError:
            continue
        if _is_blocked_ip(ip):
            raise UnsafeURL(
                "webhook host resolved to a private or reserved address"
            )
    return url


def redact_url(url: str) -> str:
    """Drop query and fragment so deliveries can be listed without secrets in the URL."""
    parsed = urlparse(url)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, "", "", "")
    )
