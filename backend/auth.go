package main

import (
	"bufio"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// Authenticator verifies a username/password pair. Implementations are meant
// to be swappable: today we ship file- and env-backed ones, a PAM-backed
// implementation (login with real system credentials) is the eventual goal.
type Authenticator interface {
	// Authenticate reports whether the credentials are valid. It must run in
	// (roughly) constant time with respect to whether the user exists, to
	// avoid leaking valid usernames through timing.
	Authenticate(username, password string) bool
	// Name is a short identifier used in startup logs.
	Name() string
}

// bcryptDummyHash is compared against when an unknown user logs in, so that a
// missing user costs about the same as a wrong password for an existing one.
// Generated from a random password; it can never match real input.
const bcryptDummyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// FileAuthenticator authenticates against a users file: one "username:bcrypt"
// entry per line, '#' comments and blank lines ignored. This is the temporary
// store until PAM lands.
type FileAuthenticator struct {
	path    string
	mu      sync.RWMutex
	entries map[string]string // username -> bcrypt hash
}

// LoadFileAuthenticator reads and parses the users file at path.
func LoadFileAuthenticator(path string) (*FileAuthenticator, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	entries := make(map[string]string)
	scanner := bufio.NewScanner(f)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on the FIRST colon only: bcrypt hashes contain colons? No, but
		// usernames must not, so first-colon split is the safe rule.
		idx := strings.IndexByte(line, ':')
		if idx <= 0 {
			return nil, fmt.Errorf("users file %s: malformed entry on line %d", path, lineNo)
		}
		username := strings.TrimSpace(line[:idx])
		hash := strings.TrimSpace(line[idx+1:])
		if username == "" || hash == "" {
			return nil, fmt.Errorf("users file %s: empty username or hash on line %d", path, lineNo)
		}
		entries[username] = hash
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("users file %s contains no usable entries", path)
	}

	return &FileAuthenticator{path: path, entries: entries}, nil
}

func (a *FileAuthenticator) Authenticate(username, password string) bool {
	a.mu.RLock()
	hash, ok := a.entries[username]
	a.mu.RUnlock()

	if !ok {
		// Spend the cost of a bcrypt comparison anyway to flatten timing.
		_ = bcrypt.CompareHashAndPassword([]byte(bcryptDummyHash), []byte(password))
		return false
	}

	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (a *FileAuthenticator) Name() string {
	return fmt.Sprintf("file (%s, %d user(s))", a.path, len(a.entries))
}

// EnvAuthenticator authenticates against a single credential pair supplied via
// environment variables (the "docker" fallback used when no users file exists).
type EnvAuthenticator struct {
	username string
	password string
}

func (a *EnvAuthenticator) Authenticate(username, password string) bool {
	// Constant-time on both fields so neither a wrong user nor a wrong
	// password short-circuits earlier than the other.
	userOK := subtle.ConstantTimeCompare([]byte(username), []byte(a.username)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(password), []byte(a.password)) == 1
	return userOK && passOK
}

func (a *EnvAuthenticator) Name() string {
	return fmt.Sprintf("env (user %q)", a.username)
}

// buildAuthenticator picks the credential source: the users file if present,
// otherwise the env fallback. It returns an error (fail-closed) when neither is
// configured, so the server never starts wide open.
func buildAuthenticator() (Authenticator, error) {
	usersPath := os.Getenv("WEBDESK_USERS_FILE")
	if usersPath == "" {
		usersPath = "/etc/webdesk/users"
	}

	if _, err := os.Stat(usersPath); err == nil {
		fa, err := LoadFileAuthenticator(usersPath)
		if err != nil {
			return nil, fmt.Errorf("failed to load users file: %w", err)
		}
		return fa, nil
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot access users file %s: %w", usersPath, err)
	}

	// Fallback: environment credentials (docker-compose style).
	envUser := os.Getenv("WEBDESK_USER")
	envPass := os.Getenv("WEBDESK_PASSWORD")
	if envUser != "" && envPass != "" {
		return &EnvAuthenticator{username: envUser, password: envPass}, nil
	}

	return nil, errors.New(
		"no authentication configured: create a users file (default /etc/webdesk/users, " +
			"or set WEBDESK_USERS_FILE) or set WEBDESK_USER and WEBDESK_PASSWORD")
}

// --- Sessions ---------------------------------------------------------------

const (
	sessionCookieName = "webdesk_session"
	sessionTTL        = 12 * time.Hour
)

type session struct {
	username string
	expires  time.Time
}

// SessionStore is an in-memory token store. Single-instance only; if the
// backend is ever scaled out this needs to move to a shared store.
type SessionStore struct {
	mu       sync.Mutex
	sessions map[string]session
}

func NewSessionStore() *SessionStore {
	s := &SessionStore{sessions: make(map[string]session)}
	go s.cleanupLoop()
	return s
}

func (s *SessionStore) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	for range ticker.C {
		now := time.Now()
		s.mu.Lock()
		for token, sess := range s.sessions {
			if now.After(sess.expires) {
				delete(s.sessions, token)
			}
		}
		s.mu.Unlock()
	}
}

func (s *SessionStore) Create(username string) (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	token := hex.EncodeToString(buf)

	s.mu.Lock()
	s.sessions[token] = session{username: username, expires: time.Now().Add(sessionTTL)}
	s.mu.Unlock()
	return token, nil
}

func (s *SessionStore) Validate(token string) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[token]
	if !ok {
		return "", false
	}
	if time.Now().After(sess.expires) {
		delete(s.sessions, token)
		return "", false
	}
	return sess.username, true
}

func (s *SessionStore) Delete(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

// --- Login rate limiting ----------------------------------------------------

// loginLimiter throttles failed login attempts per client IP to slow brute
// force. Successful logins reset the counter.
type loginLimiter struct {
	mu          sync.Mutex
	attempts    map[string][]time.Time
	maxAttempts int
	window      time.Duration
}

func newLoginLimiter() *loginLimiter {
	return &loginLimiter{
		attempts:    make(map[string][]time.Time),
		maxAttempts: 10,
		window:      5 * time.Minute,
	}
}

func (l *loginLimiter) allowed(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-l.window)
	kept := l.attempts[ip][:0]
	for _, t := range l.attempts[ip] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	l.attempts[ip] = kept
	return len(kept) < l.maxAttempts
}

func (l *loginLimiter) recordFailure(ip string) {
	l.mu.Lock()
	l.attempts[ip] = append(l.attempts[ip], time.Now())
	l.mu.Unlock()
}

func (l *loginLimiter) reset(ip string) {
	l.mu.Lock()
	delete(l.attempts, ip)
	l.mu.Unlock()
}

// --- HTTP handlers / middleware ---------------------------------------------

// secureCookies reports whether the session cookie should carry the Secure
// flag. Off by default (dev has no TLS); set WEBDESK_SECURE_COOKIE=1 in any
// TLS-terminated deployment.
func secureCookies() bool {
	return os.Getenv("WEBDESK_SECURE_COOKIE") == "1"
}

func loginHandler(auth Authenticator, sessions *SessionStore, limiter *loginLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.allowed(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many login attempts, try again later"})
			return
		}

		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		if !auth.Authenticate(req.Username, req.Password) {
			limiter.recordFailure(ip)
			// Deliberately vague: do not reveal whether the user exists.
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		token, err := sessions.Create(req.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
			return
		}
		limiter.reset(ip)

		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(sessionCookieName, token, int(sessionTTL.Seconds()), "/", "", secureCookies(), true)
		c.JSON(http.StatusOK, gin.H{"username": req.Username})
	}
}

func logoutHandler(sessions *SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if token, err := c.Cookie(sessionCookieName); err == nil {
			sessions.Delete(token)
		}
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(sessionCookieName, "", -1, "/", "", secureCookies(), true)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// meHandler reports the currently authenticated user, used by the frontend to
// decide whether to show the login screen.
func meHandler(sessions *SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(sessionCookieName)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		username, ok := sessions.Validate(token)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"username": username})
	}
}

// authMiddleware rejects requests without a valid session.
func authMiddleware(sessions *SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(sessionCookieName)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		username, ok := sessions.Validate(token)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}
		c.Set("username", username)
		c.Next()
	}
}
