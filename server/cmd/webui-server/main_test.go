package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestValidateConfiguration(t *testing.T) {
	valid := configuration{
		Enabled:         true,
		Mode:            "balanced",
		LogLevel:        "info",
		IntervalSeconds: 60,
	}
	if err := validateConfiguration(valid); err != nil {
		t.Fatalf("valid configuration rejected: %v", err)
	}

	cases := []configuration{
		{Enabled: true, Mode: "invalid", LogLevel: "info", IntervalSeconds: 60},
		{Enabled: true, Mode: "balanced", LogLevel: "verbose", IntervalSeconds: 60},
		{Enabled: true, Mode: "balanced", LogLevel: "info", IntervalSeconds: 14},
		{Enabled: true, Mode: "balanced", LogLevel: "info", IntervalSeconds: 3601},
	}
	for _, test := range cases {
		if err := validateConfiguration(test); err == nil {
			t.Fatalf("invalid configuration accepted: %#v", test)
		}
	}
}

func TestHostAllowed(t *testing.T) {
	if !hostAllowed("127.0.0.1") {
		t.Fatal("loopback host rejected")
	}
	for _, host := range []string{"localhost", "0.0.0.0", "::1", "example.com"} {
		if hostAllowed(host) {
			t.Fatalf("unexpected host accepted: %s", host)
		}
	}
}

func TestValidateStartupRejectsNonLoopback(t *testing.T) {
	temp := t.TempDir()
	control := filepath.Join(temp, "control")
	if err := os.WriteFile(control, []byte("#!/bin/sh\n"), 0o700); err != nil {
		t.Fatal(err)
	}

	err := validateStartup("0.0.0.0:0", temp, control, temp, "0123456789abcdef0123456789abcdef", 10*time.Minute)
	if err == nil {
		t.Fatal("non-loopback listener accepted")
	}
}

func TestLimitedBuffer(t *testing.T) {
	buffer := &limitedBuffer{limit: 4}
	if _, err := buffer.Write([]byte("abcdef")); err != nil {
		t.Fatal(err)
	}
	if !buffer.exceeded {
		t.Fatal("limit exceedance not recorded")
	}
	if got := buffer.String(); got != "abcd" {
		t.Fatalf("unexpected content: %q", got)
	}
}
