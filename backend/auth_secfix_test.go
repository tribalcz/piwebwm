package main

import (
	"os"
	"testing"
)

func TestIsWeakPassword(t *testing.T) {
	weak := []string{"", "changeme", "admin", "raspberry", "short", "1234567", "PASSWORD", "webdesk"}
	for _, p := range weak {
		if !isWeakPassword(p) {
			t.Errorf("expected %q to be flagged weak", p)
		}
	}
	strong := []string{"correct-horse-battery", "S3cur3P@ssw0rd!", "aVeryLongEnoughPassphrase"}
	for _, p := range strong {
		if isWeakPassword(p) {
			t.Errorf("expected %q to be accepted", p)
		}
	}
}

func TestSecureCookiesDefault(t *testing.T) {
	os.Unsetenv("WEBDESK_SECURE_COOKIE")
	if !secureCookies() {
		t.Error("cookies should be Secure by default")
	}
	for _, v := range []string{"0", "false", "no", "FALSE"} {
		os.Setenv("WEBDESK_SECURE_COOKIE", v)
		if secureCookies() {
			t.Errorf("WEBDESK_SECURE_COOKIE=%q should disable Secure", v)
		}
	}
	os.Setenv("WEBDESK_SECURE_COOKIE", "1")
	if !secureCookies() {
		t.Error("WEBDESK_SECURE_COOKIE=1 should keep Secure")
	}
	os.Unsetenv("WEBDESK_SECURE_COOKIE")
}
