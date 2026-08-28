"""Webhook URL guards: https to a public host, never loopback or metadata."""
import pytest

from app.services.url_guard import UnsafeURL, optional_https_webhook, validate_webhook_url


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/hook",
        "https://127.0.0.1/hook",
        "https://localhost/hook",
        "https://10.0.0.1/hook",
        "https://169.254.169.254/latest",
        "https://metadata.google.internal/",
        "https://postgres/hook",
        "ftp://example.com/hook",
        "https://user:pass@example.com/hook",
    ],
)
def test_validate_webhook_url_rejects_unsafe(url):
    with pytest.raises(UnsafeURL):
        validate_webhook_url(url)


def test_validate_webhook_url_accepts_public_https():
    assert (
        validate_webhook_url("https://example.invalid/hooks")
        == "https://example.invalid/hooks"
    )


def test_optional_https_webhook_treats_blank_as_none():
    assert optional_https_webhook(None) is None
    assert optional_https_webhook("  ") is None
