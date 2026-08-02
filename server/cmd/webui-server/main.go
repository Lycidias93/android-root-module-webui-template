package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

var version = "dev"

const (
	maxBodyBytes   = 32 << 10
	maxOutputBytes = 256 << 10
)

type configuration struct {
	Enabled         bool   `json:"enabled"`
	Mode            string `json:"mode"`
	LogLevel        string `json:"log_level"`
	IntervalSeconds int    `json:"interval_seconds"`
}

type actionRequest struct {
	Name string `json:"name"`
}

type stateFile struct {
	Port      int    `json:"port"`
	PID       int    `json:"pid"`
	Version   string `json:"version"`
	StartedAt string `json:"started_at"`
}

type application struct {
	token       string
	webroot     string
	control     string
	moduleDir   string
	hostPort    string
	origin      string
	started     time.Time
	lastRequest atomic.Int64
	logger      *log.Logger
}

func main() {
	var listenAddress string
	var webroot string
	var control string
	var moduleDir string
	var token string
	var statePath string
	var pidPath string
	var idleTimeout time.Duration

	flag.StringVar(&listenAddress, "listen", "127.0.0.1:0", "loopback listen address")
	flag.StringVar(&webroot, "webroot", "", "static WebUI directory")
	flag.StringVar(&control, "control", "", "module-control executable")
	flag.StringVar(&moduleDir, "module-dir", "", "module directory")
	flag.StringVar(&token, "token", "", "session token")
	flag.StringVar(&statePath, "state-file", "", "atomic state file")
	flag.StringVar(&pidPath, "pid-file", "", "PID file")
	flag.DurationVar(&idleTimeout, "idle-timeout", 10*time.Minute, "idle shutdown duration")
	flag.Parse()

	logger := log.New(os.Stdout, "webui-server: ", log.LstdFlags|log.LUTC)

	if err := validateStartup(listenAddress, webroot, control, moduleDir, token, idleTimeout); err != nil {
		logger.Fatal(err)
	}

	listener, err := net.Listen("tcp4", listenAddress)
	if err != nil {
		logger.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	tcpAddress, ok := listener.Addr().(*net.TCPAddr)
	if !ok || !tcpAddress.IP.IsLoopback() {
		logger.Fatal("listener is not loopback")
	}

	app := &application{
		token:     token,
		webroot:   webroot,
		control:   control,
		moduleDir: moduleDir,
		hostPort:  net.JoinHostPort("127.0.0.1", strconv.Itoa(tcpAddress.Port)),
		origin:    "http://" + net.JoinHostPort("127.0.0.1", strconv.Itoa(tcpAddress.Port)),
		started:   time.Now().UTC(),
		logger:    logger,
	}
	app.touch()

	if err := writeRuntimeFile(statePath, stateFile{
		Port:      tcpAddress.Port,
		PID:       os.Getpid(),
		Version:   version,
		StartedAt: app.started.Format(time.RFC3339),
	}); err != nil {
		logger.Fatalf("state file: %v", err)
	}
	if err := writePIDFile(pidPath, os.Getpid()); err != nil {
		logger.Fatalf("pid file: %v", err)
	}
	defer os.Remove(statePath)
	defer os.Remove(pidPath)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", app.health)
	mux.HandleFunc("/api/v1/status", app.requireToken(app.status))
	mux.HandleFunc("/api/v1/config", app.requireToken(app.config))
	mux.HandleFunc("/api/v1/log", app.requireToken(app.moduleLog))
	mux.HandleFunc("/api/v1/action", app.requireToken(app.action))
	mux.Handle("/", app.static())

	server := &http.Server{
		Handler:           app.securityHeaders(app.localOnly(mux)),
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    8 << 10,
	}

	shutdown := make(chan struct{})
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				last := time.Unix(0, app.lastRequest.Load())
				if time.Since(last) >= idleTimeout {
					logger.Printf("idle timeout reached")
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					_ = server.Shutdown(ctx)
					cancel()
					return
				}
			case <-shutdown:
				return
			}
		}
	}()

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)
	go func() {
		<-signals
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = server.Shutdown(ctx)
		cancel()
	}()

	logger.Printf("version=%s listen=%s idle_timeout=%s", version, listener.Addr(), idleTimeout)
	err = server.Serve(listener)
	close(shutdown)
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Fatalf("serve: %v", err)
	}
	logger.Printf("stopped")
}

func validateStartup(listenAddress, webroot, control, moduleDir, token string, idleTimeout time.Duration) error {
	host, _, err := net.SplitHostPort(listenAddress)
	if err != nil {
		return fmt.Errorf("invalid listen address: %w", err)
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() || host != "127.0.0.1" {
		return errors.New("listen address must use 127.0.0.1")
	}
	if len(token) < 32 || len(token) > 128 {
		return errors.New("session token length must be 32..128")
	}
	for _, item := range []struct {
		name string
		path string
		dir  bool
	}{
		{"webroot", webroot, true},
		{"control", control, false},
		{"module-dir", moduleDir, true},
	} {
		if item.path == "" {
			return fmt.Errorf("%s is required", item.name)
		}
		info, err := os.Stat(item.path)
		if err != nil {
			return fmt.Errorf("%s: %w", item.name, err)
		}
		if item.dir != info.IsDir() {
			return fmt.Errorf("%s has wrong file type", item.name)
		}
	}
	if idleTimeout < time.Minute || idleTimeout > time.Hour {
		return errors.New("idle timeout must be between 1m and 1h")
	}
	return nil
}

func (a *application) touch() {
	a.lastRequest.Store(time.Now().UnixNano())
}

func (a *application) localOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, port, err := net.SplitHostPort(r.Host)
		if err != nil || port == "" {
			http.Error(w, "invalid host", http.StatusBadRequest)
			return
		}
		if !hostAllowed(host) || net.JoinHostPort("127.0.0.1", port) != a.hostPort {
			http.Error(w, "host rejected", http.StatusForbidden)
			return
		}

		remoteHost, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			http.Error(w, "invalid peer", http.StatusForbidden)
			return
		}
		remoteIP := net.ParseIP(remoteHost)
		if remoteIP == nil || !remoteIP.IsLoopback() {
			http.Error(w, "peer rejected", http.StatusForbidden)
			return
		}

		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			origin := r.Header.Get("Origin")
			if origin != "" && origin != a.origin {
				http.Error(w, "origin rejected", http.StatusForbidden)
				return
			}
		}

		a.touch()
		next.ServeHTTP(w, r)
	})
}

func hostAllowed(host string) bool {
	return host == "127.0.0.1"
}

func (a *application) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
		next.ServeHTTP(w, r)
	})
}

func (a *application) requireToken(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided := r.Header.Get("X-WebUI-Token")
		if len(provided) != len(a.token) || subtle.ConstantTimeCompare([]byte(provided), []byte(a.token)) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid session token"})
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		next(w, r)
	}
}

func (a *application) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "version": version})
}

func (a *application) status(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	output, err := a.runControl(r.Context(), "status")
	if err != nil {
		a.controlError(w, err)
		return
	}
	writeValidatedJSON(w, output)
}

func (a *application) config(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		output, err := a.runControl(r.Context(), "config-get")
		if err != nil {
			a.controlError(w, err)
			return
		}
		writeValidatedJSON(w, output)
	case http.MethodPost:
		var request configuration
		if err := decodeJSON(w, r, &request); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		if err := validateConfiguration(request); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}
		pairs := [][2]string{
			{"enabled", strconv.FormatBool(request.Enabled)},
			{"mode", request.Mode},
			{"log_level", request.LogLevel},
			{"interval_seconds", strconv.Itoa(request.IntervalSeconds)},
		}
		for _, pair := range pairs {
			if _, err := a.runControl(r.Context(), "config-set", pair[0], pair[1]); err != nil {
				a.controlError(w, err)
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "config": request})
	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func validateConfiguration(config configuration) error {
	switch config.Mode {
	case "balanced", "performance", "battery":
	default:
		return errors.New("invalid mode")
	}
	switch config.LogLevel {
	case "error", "info", "debug":
	default:
		return errors.New("invalid log_level")
	}
	if config.IntervalSeconds < 15 || config.IntervalSeconds > 3600 {
		return errors.New("interval_seconds must be 15..3600")
	}
	return nil
}

func (a *application) moduleLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, http.MethodGet)
		return
	}
	lines := 200
	if raw := r.URL.Query().Get("lines"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 1000 {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "lines must be 1..1000"})
			return
		}
		lines = value
	}
	output, err := a.runControl(r.Context(), "log", strconv.Itoa(lines))
	if err != nil {
		a.controlError(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(output)
}

func (a *application) action(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, http.MethodPost)
		return
	}
	var request actionRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	switch request.Name {
	case "apply", "rotate-log", "reset-config":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "unsupported action"})
		return
	}
	output, err := a.runControl(r.Context(), "action", request.Name)
	if err != nil {
		a.controlError(w, err)
		return
	}
	writeValidatedJSON(w, output)
}

func (a *application) static() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			methodNotAllowed(w, http.MethodGet, http.MethodHead)
			return
		}
		cleaned := filepath.Clean("/" + r.URL.Path)
		if strings.Contains(cleaned, "/.") {
			http.NotFound(w, r)
			return
		}
		relative := strings.TrimPrefix(cleaned, "/")
		if relative == "" {
			relative = "index.html"
		}
		full := filepath.Join(a.webroot, filepath.FromSlash(relative))
		rel, err := filepath.Rel(a.webroot, full)
		if err != nil || strings.HasPrefix(rel, "..") {
			http.NotFound(w, r)
			return
		}
		info, err := os.Stat(full)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		if relative == "index.html" {
			w.Header().Set("Cache-Control", "no-store")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		http.ServeFile(w, r, full)
	}
}

func (a *application) runControl(parent context.Context, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Second)
	defer cancel()

	command := exec.CommandContext(ctx, a.control, args...)
	command.Env = append(os.Environ(), "MODDIR="+a.moduleDir)
	buffer := &limitedBuffer{limit: maxOutputBytes}
	command.Stdout = buffer
	command.Stderr = buffer

	err := command.Run()
	if ctx.Err() != nil {
		return nil, errors.New("backend timed out")
	}
	if buffer.exceeded {
		return nil, errors.New("backend output limit exceeded")
	}
	if err != nil {
		message := strings.TrimSpace(buffer.String())
		if message == "" {
			message = err.Error()
		}
		return nil, fmt.Errorf("backend failed: %s", message)
	}
	return bytes.TrimSpace(buffer.Bytes()), nil
}

func (a *application) controlError(w http.ResponseWriter, err error) {
	a.logger.Printf("backend error: %v", err)
	writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid JSON: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request must contain one JSON object")
	}
	return nil
}

func writeValidatedJSON(w http.ResponseWriter, payload []byte) {
	if !json.Valid(payload) {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": "backend returned invalid JSON"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func methodNotAllowed(w http.ResponseWriter, allowed ...string) {
	w.Header().Set("Allow", strings.Join(allowed, ", "))
	writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
}

func writeRuntimeFile(path string, state stateFile) error {
	if path == "" {
		return errors.New("state-file is required")
	}
	payload, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return writeAtomic(path, append(payload, '\n'), 0o600)
}

func writePIDFile(path string, pid int) error {
	if path == "" {
		return errors.New("pid-file is required")
	}
	return writeAtomic(path, []byte(strconv.Itoa(pid)+"\n"), 0o600)
}

func writeAtomic(path string, payload []byte, mode os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".webui-*")
	if err != nil {
		return err
	}
	tempName := temp.Name()
	defer os.Remove(tempName)

	if err := temp.Chmod(mode); err != nil {
		temp.Close()
		return err
	}
	if _, err := temp.Write(payload); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempName, path)
}

type limitedBuffer struct {
	buffer   bytes.Buffer
	limit    int
	exceeded bool
}

func (b *limitedBuffer) Write(payload []byte) (int, error) {
	if b.exceeded {
		return len(payload), nil
	}
	remaining := b.limit - b.buffer.Len()
	if remaining <= 0 {
		b.exceeded = true
		return len(payload), nil
	}
	if len(payload) > remaining {
		_, _ = b.buffer.Write(payload[:remaining])
		b.exceeded = true
		return len(payload), nil
	}
	return b.buffer.Write(payload)
}

func (b *limitedBuffer) Bytes() []byte {
	return b.buffer.Bytes()
}

func (b *limitedBuffer) String() string {
	return b.buffer.String()
}
